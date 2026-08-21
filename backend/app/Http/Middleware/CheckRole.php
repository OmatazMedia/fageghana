<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpKernel\Exception\HttpException;

class CheckRole
{
    /**
     * Check if the authenticated user has one of the required roles.
     * Usage: ->middleware('role:admin,superadmin,developer')
     */
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        $user = Auth::user();

        if (!$user) {
            throw new HttpException(401, 'Unauthenticated.');
        }

        // Check if user has any of the required roles
        $userRoles = $user->roles->pluck('role')->toArray();
        $hasRole = count(array_intersect($roles, $userRoles)) > 0;

        if (!$hasRole) {
            throw new HttpException(403, 'Unauthorized. Required role: ' . implode(' or ', $roles));
        }

        return $next($request);
    }
}
