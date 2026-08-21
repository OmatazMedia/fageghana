<?php
namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SessionService
{
    public function recordSession(string $userId, Request $request = null): void
    {
        DB::table('user_sessions')->insert([
            'id' => Str::uuid()->toString(), 'user_id' => $userId,
            'session_fingerprint' => (string) Str::uuid(),
            'ip_address' => $request?->ip() ?? '0.0.0.0',
            'suspicious' => false,
            'last_seen_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function trackLoginAttempt(string $email, string $ip, bool $success): void
    {
        DB::table('login_attempts')->insert([
            'id' => Str::uuid()->toString(), 'email_tried' => $email,
            'ip' => $ip, 'subnet' => self::subnetOf($ip),
            'outcome' => $success ? 'success' : 'failed',
            'created_at' => now(),
        ]);

        if (!$success) {
            $recentFails = DB::table('login_attempts')
                ->where('email_tried', $email)->where('outcome', 'failed')
                ->where('created_at', '>', now()->subMinutes(15))->count();

            if ($recentFails >= 5) {
                DB::table('ip_bans')->insertOrIgnore([
                    'id' => Str::uuid()->toString(), 'ip' => $ip, 'subnet' => self::subnetOf($ip),
                    'reason' => "Brute force: {$recentFails} failed attempts",
                    'banned_at' => now(), 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    private static function subnetOf(string $ip): string
    {
        $ip = trim($ip);
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = explode('.', $ip);
            return implode('.', [$parts[0], $parts[1], $parts[2], '0']);
        }
        return $ip;
    }

    public function isIpBanned(string $ip): bool
    {
        return DB::table('ip_bans')
            ->where('ip', $ip)
            ->whereNull('unbanned_at')
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->exists();
    }

    public function revokeSession(string $sessionId): void
    {
        DB::table('user_sessions')->where('id', $sessionId)
            ->update(['revoked_at' => now(), 'revoked_reason' => 'manual', 'updated_at' => now()]);
    }

    public function revokeAllSessions(string $userId): int
    {
        return DB::table('user_sessions')->where('user_id', $userId)->whereNull('revoked_at')
            ->update(['revoked_at' => now(), 'revoked_reason' => 'manual', 'updated_at' => now()]);
    }

    public function purgeOldAttempts(): int
    {
        return DB::table('login_attempts')->where('created_at', '<', now()->subDays(30))->delete();
    }

    public function purgeOldSessions(): int
    {
        return DB::table('user_sessions')->where('last_seen_at', '<', now()->subDays(30))->delete();
    }
}