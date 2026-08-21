<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\DB;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Scheduled backup — runs daily at 2 AM
Schedule::command('backup:run')->dailyAt('02:00');

// Fetch trade RSS feeds — runs daily at 6 AM
Schedule::command('trade:fetch-rss')->dailyAt('06:00');

// Retry failed webhooks — every 15 minutes
Schedule::call(function () {
    $pending = DB::table('webhook_logs')
        ->where('status', 'failed')
        ->where('next_retry_at', '<=', now())
        ->where('retry_count', '<', 3)
        ->limit(10)
        ->get();

    foreach ($pending as $log) {
        DB::table('webhook_logs')->where('id', $log->id)->update([
            'retry_count' => $log->retry_count + 1,
            'next_retry_at' => now()->addMinutes(pow(2, $log->retry_count + 1) * 5),
            'status' => 'retrying',
            'updated_at' => now(),
        ]);
    }
})->everyFifteenMinutes();

// Cleanup old webhook logs older than 90 days — weekly
Schedule::call(function () {
    DB::table('webhook_logs')
        ->where('created_at', '<', now()->subDays(90))
        ->delete();
})->weekly();
