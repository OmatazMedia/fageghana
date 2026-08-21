<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckInstalled
{
    public function handle(Request $request, Closure $next): Response
    {
        // Allow health check and setup routes regardless of installation status
        if ($request->is('api/health') || $request->is('api/setup/*')) {
            return $next($request);
        }

        if (!$this->isInstalled()) {
            return response()->json([
                'message' => 'Application not installed. Please run the setup wizard.',
                'redirect' => '/api/setup/status',
            ], 503);
        }

        return $next($request);
    }

    public function isInstalled(): bool
    {
        return file_exists(storage_path('installed'));
    }
}
