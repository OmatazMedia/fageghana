<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class LoginController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials',
            ], 401);
        }

        // Revoke existing tokens
        $user->tokens()->delete();

        // Create new token with role ability
        $roles = $user->roles->pluck('role')->toArray();
        $token = $user->createToken('auth-token', $roles)->plainTextToken;

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $user->avatar_url,
                'roles' => $roles,
            ],
            'token' => $token,
            'access_token' => $token,
            'token_type' => 'Bearer',
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $user->load(['roles', 'member']);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar_url' => $user->avatar_url,
                'email_verified_at' => $user->email_verified_at,
                'created_at' => $user->created_at,
                'roles' => $user->roles->pluck('role'),
                'member' => $user->member ? [
                    'id' => $user->member->id,
                    'membership_number' => $user->member->membership_number,
                    'membership_tier' => $user->member->membership_tier,
                    'membership_status' => $user->member->membership_status,
                    'company_name' => $user->member->company_name,
                ] : null,
            ],
        ]);
    }
}
