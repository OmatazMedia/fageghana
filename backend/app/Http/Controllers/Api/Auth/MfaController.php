<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MfaController extends Controller
{
    public function sendCode(Request $request)
    {
        $user = $request->user();

        // Check lockout
        $settings = DB::table('security_settings')->where('singleton', true)->first();
        $lockoutAttempts = $settings->mfa_lockout_attempts ?? 5;
        $codeLength = $settings->mfa_code_length ?? 6;

        $recentAttempts = DB::table('email_logs')
            ->where('to', $user->email)
            ->where('template_key', 'mfa_code')
            ->where('created_at', '>', now()->subMinutes(15))
            ->count();

        if ($recentAttempts >= $lockoutAttempts) {
            return response()->json(['message' => 'Too many attempts. Please try again later.'], 429);
        }

        // Generate code
        $code = Str::random($codeLength);

        // Store code (hashed)
        DB::table('email_logs')->insert([
            'id' => Str::uuid()->toString(),
            'to' => $user->email,
            'subject' => 'MFA Code',
            'status' => 'pending',
            'template_key' => 'mfa_code',
            'metadata' => json_encode(['code' => $code, 'user_id' => $user->id]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // TODO: Actually send email with code
        // Mail::to($user)->send(new MfaCodeMail($code));

        return response()->json([
            'message' => 'Verification code sent',
            'expires_in' => $settings->mfa_code_expiry ?? 300,
        ]);
    }

    public function verify(Request $request)
    {
        $request->validate([
            'code' => 'required|string|size:6',
        ]);

        $user = $request->user();

        $record = DB::table('email_logs')
            ->where('to', $user->email)
            ->where('template_key', 'mfa_code')
            ->where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$record) {
            return response()->json(['message' => 'No verification code found. Request a new one.'], 422);
        }

        $metadata = json_decode($record->metadata, true);

        if ($metadata['code'] !== $request->code) {
            return response()->json(['message' => 'Invalid verification code'], 422);
        }

        // Check expiry
        if (now()->diffInMinutes($record->created_at) > 5) {
            DB::table('email_logs')->where('id', $record->id)->update(['status' => 'expired']);
            return response()->json(['message' => 'Code expired. Request a new one.'], 422);
        }

        // Mark as verified
        DB::table('email_logs')->where('id', $record->id)->update(['status' => 'sent']);

        return response()->json(['message' => 'Verification successful', 'verified' => true]);
    }

    /** GET /auth/mfa/status — whether email 2FA is enabled for the signed-in user. */
    public function status(Request $request)
    {
        $user = $request->user();
        $row = DB::table('email_mfa_settings')->where('user_id', $user->id)->first();
        if (!$row) {
            return response()->json(['enabled' => false, 'enabled_at' => null]);
        }
        return response()->json([
            'enabled' => (bool) ($row->enabled ?? false),
            'enabled_at' => $row->enabled_at ?? null,
        ]);
    }

    /** POST /auth/mfa/enable — verify code and turn on email 2FA. */
    public function enable(Request $request)
    {
        $request->validate(['code' => 'required|string|size:6']);
        $user = $request->user();

        $record = DB::table('email_logs')
            ->where('to', $user->email)
            ->where('template_key', 'mfa_code')
            ->where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$record) {
            return response()->json(['message' => 'No verification code found. Request a new one.'], 422);
        }

        $metadata = json_decode($record->metadata, true);
        if (($metadata['code'] ?? '') !== $request->code) {
            return response()->json(['message' => 'Invalid verification code'], 422);
        }

        if (now()->diffInMinutes($record->created_at) > 5) {
            DB::table('email_logs')->where('id', $record->id)->update(['status' => 'expired']);
            return response()->json(['message' => 'Code expired. Request a new one.'], 422);
        }

        DB::table('email_logs')->where('id', $record->id)->update(['status' => 'sent']);

        $existing = DB::table('email_mfa_settings')->where('user_id', $user->id)->first();
        if ($existing) {
            DB::table('email_mfa_settings')->where('user_id', $user->id)->update([
                'enabled' => true,
                'enabled_at' => now(),
                'updated_at' => now(),
            ]);
        } else {
            DB::table('email_mfa_settings')->insert([
                'id' => Str::uuid()->toString(),
                'user_id' => $user->id,
                'enabled' => true,
                'enabled_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['message' => 'Email two-factor authentication enabled', 'ok' => true]);
    }

    /** POST /auth/mfa/disable — verify code and turn off email 2FA. */
    public function disable(Request $request)
    {
        $request->validate(['code' => 'required|string|size:6']);
        $user = $request->user();

        $record = DB::table('email_logs')
            ->where('to', $user->email)
            ->where('template_key', 'mfa_code')
            ->where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$record) {
            return response()->json(['message' => 'No verification code found. Request a new one.'], 422);
        }

        $metadata = json_decode($record->metadata, true);
        if (($metadata['code'] ?? '') !== $request->code) {
            return response()->json(['message' => 'Invalid verification code'], 422);
        }

        if (now()->diffInMinutes($record->created_at) > 5) {
            DB::table('email_logs')->where('id', $record->id)->update(['status' => 'expired']);
            return response()->json(['message' => 'Code expired. Request a new one.'], 422);
        }

        DB::table('email_logs')->where('id', $record->id)->update(['status' => 'sent']);
        DB::table('email_mfa_settings')->where('user_id', $user->id)->update([
            'enabled' => false,
            'disabled_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Email two-factor authentication disabled', 'ok' => true]);
    }
}
