<?php
namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Services\EmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Public (anonymous) admin-login gate. Runs BEFORE authentication to stop
 * brute-force attacks on the console entrance. Mirrors the former
 * login-security.server.ts helpers (getIpStatus / recordAttempt / isConsoleEmail).
 */
class LoginGateController extends Controller
{
    private const ATTEMPT_WINDOW_SECONDS = 15 * 60;
    private const ATTEMPTS_PER_WARNING = 5;
    private const MAX_WARNINGS = 3;
    private const BAN_SECONDS = 24 * 60 * 60;

    private function clientIp(Request $r): string
    {
        return $r->ip() ?? '0.0.0.0';
    }

    private function subnetOf(string $ip): string
    {
        if ($ip === '0.0.0.0' || $ip === 'unknown') return 'unknown';
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $parts = explode(':', $ip);
            return implode(':', array_slice($parts, 0, 3)) . '::/48';
        }
        $p = explode('.', $ip);
        if (count($p) !== 4) return $ip;
        return "{$p[0]}.{$p[1]}.{$p[2]}.0/24";
    }

    private function activeBan(string $ip): ?object
    {
        $subnet = $this->subnetOf($ip);
        return DB::table('ip_bans')
            ->whereNull('unbanned_at')
            ->whereNull('unbanned_by')
            ->where(function ($q) use ($ip, $subnet) {
                $q->where('ip', $ip)->orWhere('subnet', $subnet);
            })
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->orderByDesc('banned_at')
            ->first();
    }

    private function recentFailures(string $ip): int
    {
        return DB::table('login_attempts')
            ->where('ip', $ip)
            ->where('created_at', '>', now()->subSeconds(self::ATTEMPT_WINDOW_SECONDS))
            ->whereIn('outcome', ['email_unknown', 'bad_password', 'reset_unknown', 'blocked_input'])
            ->count();
    }

    private function warningMessage(int $warnings, int $attemptsLeft): ?string
    {
        if ($warnings <= 0) return null;
        if ($warnings >= self::MAX_WARNINGS) {
            return 'This network has been blocked for 24 hours.';
        }
        $remaining = self::MAX_WARNINGS - $warnings;
        $s = $remaining === 1 ? '' : 's';
        return "Warning {$warnings} of " . self::MAX_WARNINGS . ": too many failed attempts. {$remaining} more warning{$s} and this network will be blocked for 24 hours. {$attemptsLeft} attempt" . ($attemptsLeft === 1 ? '' : 's') . " left before the next warning.";
    }

    private function ipStatus(Request $r, string $ip): array
    {
        $ban = $this->activeBan($ip);
        if ($ban) {
            return [
                'banned' => true,
                'bannedUntil' => $ban->expires_at,
                'warnings' => (int) ($ban->warning_count ?? self::MAX_WARNINGS),
                'recentFailures' => 0,
                'attemptsLeft' => 0,
                'message' => 'This network has been blocked because of repeated failed sign-in attempts.',
            ];
        }
        $failures = $this->recentFailures($ip);
        $warnings = min(self::MAX_WARNINGS - 1, intdiv($failures, self::ATTEMPTS_PER_WARNING));
        $attemptsLeft = max(0, self::ATTEMPTS_PER_WARNING - ($failures % self::ATTEMPTS_PER_WARNING));
        return [
            'banned' => false,
            'bannedUntil' => null,
            'warnings' => $warnings,
            'recentFailures' => $failures,
            'attemptsLeft' => $attemptsLeft,
            'message' => $this->warningMessage($warnings, $attemptsLeft),
        ];
    }

    private function recordAttempt(Request $r, string $ip, ?string $email, string $outcome): array
    {
        try {
            DB::table('login_attempts')->insert([
                'id' => Str::uuid()->toString(),
                'ip' => $ip,
                'subnet' => $this->subnetOf($ip),
                'email_tried' => $email ? substr($email, 0, 254) : null,
                'outcome' => $outcome,
                'portal' => 'admin',
                'user_agent' => $r->userAgent(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            logger()->warning('login attempt log failed: ' . $e->getMessage());
        }

        if ($outcome === 'success') {
            try {
                DB::table('login_attempts')
                    ->where('ip', $ip)
                    ->whereIn('outcome', ['email_unknown', 'bad_password', 'reset_unknown', 'blocked_input'])
                    ->delete();
                DB::table('ip_bans')
                    ->where('ip', $ip)
                    ->whereNull('expires_at')
                    ->update(['warning_count' => 0, 'strikes' => 0, 'updated_at' => now()]);
            } catch (\Throwable $e) {
                /* noop */
            }
            return [
                'banned' => false, 'bannedUntil' => null, 'warnings' => 0,
                'recentFailures' => 0, 'attemptsLeft' => self::ATTEMPTS_PER_WARNING, 'message' => null,
            ];
        }

        if (in_array($outcome, ['email_ok', 'reset_requested'], true)) {
            return $this->ipStatus($r, $ip);
        }

        $failures = $this->recentFailures($ip);
        $warnings = min(self::MAX_WARNINGS, intdiv($failures, self::ATTEMPTS_PER_WARNING));
        $attemptsLeft = max(0, self::ATTEMPTS_PER_WARNING - ($failures % self::ATTEMPTS_PER_WARNING));

        if ($warnings <= 0) {
            return [
                'banned' => false, 'bannedUntil' => null, 'warnings' => 0,
                'recentFailures' => $failures, 'attemptsLeft' => $attemptsLeft, 'message' => null,
            ];
        }

        $existing = DB::table('ip_bans')->where('ip', $ip)->first();
        $shouldBan = $warnings >= self::MAX_WARNINGS;
        $expiresAt = $shouldBan ? now()->addSeconds(self::BAN_SECONDS) : null;

        $payload = [
            'ip' => $ip,
            'subnet' => $this->subnetOf($ip),
            'warning_count' => $warnings,
            'strikes' => $failures,
            'last_email_tried' => $email ? substr($email, 0, 254) : ($existing->last_email_tried ?? null),
            'reason' => $shouldBan ? 'Automatic: repeated failed admin sign-in attempts' : 'Warnings issued',
            'updated_at' => now(),
        ];
        if ($shouldBan) {
            $payload['banned_at'] = now();
            $payload['expires_at'] = $expiresAt;
            $payload['unbanned_at'] = null;
            $payload['unbanned_by'] = null;
        }

        try {
            if ($existing) {
                DB::table('ip_bans')->where('id', $existing->id)->update($payload);
            } else {
                $payload['id'] = Str::uuid()->toString();
                $payload['created_at'] = now();
                DB::table('ip_bans')->insert($payload);
            }
        } catch (\Throwable $e) {
            /* noop */
        }

        if ($shouldBan) {
            try {
                DB::table('activity_log')->insert([
                    'id' => Str::uuid()->toString(),
                    'user_id' => null,
                    'event_type' => 'login_ip_banned',
                    'detail' => "{$ip} ({$payload['subnet']}) blocked for 24h after {$failures} failed attempts",
                    'ip_address' => $ip === 'unknown' ? null : $ip,
                    'user_agent' => $r->userAgent(),
                    'created_at' => now(),
                ]);
            } catch (\Throwable $e) {
                /* noop */
            }
        }

        return [
            'banned' => $shouldBan,
            'bannedUntil' => $expiresAt ? $expiresAt->toISOString() : null,
            'warnings' => $warnings,
            'recentFailures' => $failures,
            'attemptsLeft' => $shouldBan ? 0 : $attemptsLeft,
            'message' => $this->warningMessage($warnings, $attemptsLeft),
        ];
    }

    /** GET /api/public/login-security/gate — caller's ban/warning state. */
    public function gate(Request $r)
    {
        $ip = $this->clientIp($r);
        return response()->json($this->ipStatus($r, $ip));
    }

    /** POST /api/public/login-security/check-email — is this a console account? */
    public function checkEmail(Request $r)
    {
        $v = $r->validate(['email' => 'required|email']);
        $ip = $this->clientIp($r);

        $status = $this->ipStatus($r, $ip);
        if ($status['banned']) {
            return response()->json(['banned' => true, 'ok' => false, 'status' => $status]);
        }

        $user = DB::table('users')->where('email', $v['email'])->first();
        $exists = (bool) $user && DB::table('user_roles')
            ->where('user_id', $user->id)
            ->whereIn('role', ['admin', 'superadmin', 'developer', 'staff', 'finance', 'ceo', 'coordinator'])
            ->exists();

        $status = $this->recordAttempt($r, $ip, $v['email'], $exists ? 'email_ok' : 'email_unknown');

        return response()->json([
            'banned' => $status['banned'],
            'ok' => $exists,
            'error' => $exists ? null : 'This email is not recognised for admin access.',
            'status' => $status,
        ]);
    }

    /** POST /api/public/login-security/record-outcome — password result. */
    public function recordOutcome(Request $r)
    {
        $v = $r->validate(['email' => 'required|email', 'success' => 'required|boolean']);
        $ip = $this->clientIp($r);
        $status = $this->recordAttempt($r, $ip, $v['email'], $v['success'] ? 'success' : 'bad_password');
        return response()->json($status);
    }

    /** POST /api/public/login-security/request-reset — console-only reset email. */
    public function requestReset(Request $r)
    {
        $v = $r->validate(['email' => 'required|email']);
        $ip = $this->clientIp($r);

        $status = $this->ipStatus($r, $ip);
        if ($status['banned']) {
            return response()->json(['ok' => false, 'banned' => true, 'status' => $status]);
        }

        $user = DB::table('users')->where('email', $v['email'])->first();
        $exists = (bool) $user && DB::table('user_roles')
            ->where('user_id', $user->id)
            ->whereIn('role', ['admin', 'superadmin', 'developer', 'staff', 'finance', 'ceo', 'coordinator'])
            ->exists();

        if (!$exists) {
            $status = $this->recordAttempt($r, $ip, $v['email'], 'reset_unknown');
            return response()->json([
                'ok' => false, 'banned' => $status['banned'],
                'error' => 'This email is not recognised for admin access.', 'status' => $status,
            ]);
        }

        $token = Str::random(64);
        DB::table('password_reset_tokens')->where('email', $user->email)->delete();
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email, 'token' => $token, 'created_at' => now(),
        ]);

        try {
            app(EmailService::class)->sendPasswordReset($user->email, $token);
        } catch (\Throwable $e) {
            logger()->warning('public reset email failed: ' . $e->getMessage());
        }

        $this->recordAttempt($r, $ip, $v['email'], 'reset_requested');

        return response()->json(['ok' => true, 'banned' => false, 'status' => $this->ipStatus($r, $ip)]);
    }
}