<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class RegisterController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:50',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'phone' => $validated['phone'] ?? null,
        ]);

        // Assign default 'user' role
        $user->roles()->create([
            'role' => 'user',
        ]);

        // Create empty member record
        $user->member()->create([
            'first_name' => $validated['name'],
            'email' => $validated['email'],
            'membership_status' => 'pending',
            'membership_tier' => 'basic',
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => ['user'],
            ],
            'token' => $token,
            'message' => 'Registration successful',
        ], 201);
    }

    public function verifyEmail(Request $request, string $id, string $hash)
    {
        $user = User::findOrFail($id);
        if (!hash_equals(sha1($user->email), $hash)) {
            return response()->json(['message' => 'Invalid verification link'], 403);
        }

        $user->update(['email_verified_at' => now()]);

        return response()->json(['message' => 'Email verified successfully']);
    }
}
