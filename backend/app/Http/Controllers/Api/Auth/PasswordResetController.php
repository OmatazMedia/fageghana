<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            // Don't reveal whether a user exists
            return response()->json(['message' => 'If the email exists, a reset link has been sent.']);
        }

        $token = Str::random(64);
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => Hash::make($token),
            'created_at' => now(),
        ]);

        // TODO: Send email with reset link containing $token
        // Mail::to($user)->send(new PasswordResetMail($token));

        return response()->json(['message' => 'If the email exists, a reset link has been sent.', 'token' => $token]);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$resetRecord || !Hash::check($request->token, $resetRecord->token)) {
            return response()->json(['message' => 'Invalid or expired reset token'], 422);
        }

        if (now()->diffInMinutes($resetRecord->created_at) > 60) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();
            return response()->json(['message' => 'Reset token has expired'], 422);
        }

        $user = User::where('email', $request->email)->first();
        $user->update(['password' => Hash::make($request->password)]);

        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        return response()->json(['message' => 'Password reset successful']);
    }
}
