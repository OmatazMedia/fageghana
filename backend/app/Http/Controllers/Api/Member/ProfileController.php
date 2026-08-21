<?php

namespace App\Http\Controllers\Api\Member;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user()->load(['roles', 'member']);
        $member = $user->member;

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'avatar_url' => $user->avatar_url,
            'email_verified_at' => $user->email_verified_at,
            'created_at' => $user->created_at,
            'roles' => $user->roles->pluck('role'),
            'member' => $member ? [
                'id' => $member->id,
                'membership_number' => $member->membership_number,
                'first_name' => $member->first_name,
                'last_name' => $member->last_name,
                'company_name' => $member->company_name,
                'position' => $member->position,
                'industry' => $member->industry,
                'membership_tier' => $member->membership_tier,
                'membership_status' => $member->membership_status,
                'joining_date' => $member->joining_date,
                'profile_photo_url' => $member->profile_photo_url,
            ] : null,
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:50',
            'first_name' => 'sometimes|string|max:255',
            'last_name' => 'sometimes|string|max:255',
            'company_name' => 'sometimes|string|max:255',
            'position' => 'sometimes|string|max:255',
            'industry' => 'sometimes|string|max:255',
        ]);

        $user = $request->user();

        // Update User fields
        if (isset($validated['name']) || isset($validated['phone'])) {
            $user->update(collect($validated)->only(['name', 'phone'])->toArray());
        }

        // Update Member fields
        if ($user->member) {
            $memberFields = collect($validated)->only([
                'first_name', 'last_name', 'company_name', 'position', 'industry',
            ])->toArray();
            if (!empty($memberFields)) {
                $user->member->update($memberFields);
            }
        }

        return response()->json([
            'message' => 'Profile updated',
            'user' => $this->getProfileData($user->fresh()->load(['roles', 'member'])),
        ]);
    }

    public function uploadAvatar(Request $request)
    {
        $request->validate([
            'avatar' => 'required|image|mimes:jpeg,png,webp|max:2048',
        ]);

        $user = $request->user();
        $file = $request->file('avatar');
        $filename = 'avatars/' . $user->id . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('public', $filename);

        $user->update(['avatar_url' => Storage::url($path)]);

        return response()->json([
            'message' => 'Avatar uploaded',
            'avatar_url' => Storage::url($path),
        ]);
    }

    public function updateProfile(Request $request)
    {
        return $this->update($request);
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect'], 422);
        }

        $user->update(['password' => Hash::make($request->password)]);

        return response()->json(['message' => 'Password updated successfully']);
    }

    public function deleteAccount(Request $request)
    {
        $request->validate([
            'password' => 'required',
        ]);

        $user = $request->user();

        if (!Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Password is incorrect'], 422);
        }

        // Soft delete - mark as deleted but keep data
        $user->update(['email' => 'deleted_' . $user->id . '@deleted.local', 'password' => Hash::make(Str::random(64))]);
        $user->tokens()->delete();

        return response()->json(['message' => 'Account deleted']);
    }

    private function getProfileData($user)
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'avatar_url' => $user->avatar_url,
            'roles' => $user->roles->pluck('role'),
            'member' => $user->member,
        ];
    }
}
