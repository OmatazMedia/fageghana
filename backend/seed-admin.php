<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

$hash = Hash::make('password123');
$rows = DB::table('users')->where('email', 'admin@fageghana.org')->update(['password' => $hash]);
echo "Updated $rows rows\n";

$user = DB::table('users')->where('email', 'admin@fageghana.org')->first();
$verified = Hash::check('password123', $user->password);
echo "Password check: " . ($verified ? 'OK' : 'FAIL') . "\n";

// Seed defaults if missing
if (!DB::table('role_help')->first()) {
    $roles = [
        ['admin', 'Full access'], ['superadmin', 'Same as admin'], ['developer', 'Tech maintenance'],
        ['staff', 'Day-to-day'], ['finance', 'Payments'], ['ceo', 'Read-only'],
        ['coordinator', 'Readiness'], ['moderator', 'Moderation'], ['editor', 'Content'], ['user', 'Standard'],
    ];
    foreach ($roles as [$r, $s]) {
        DB::table('role_help')->insert(['role' => $r, 'summary' => $s, 'created_at' => now(), 'updated_at' => now()]);
    }
    echo "Seeded role_help\n";
}
if (!DB::table('security_settings')->first()) {
    DB::table('security_settings')->insert(['id' => Illuminate\Support\Str::uuid(), 'singleton' => 1, 'member_idle_minutes' => 10, 'console_idle_minutes' => 10, 'countdown_seconds' => 10, 'beep_enabled' => 1, 'created_at' => now(), 'updated_at' => now()]);
    echo "Seeded security_settings\n";
}
if (!DB::table('email_settings')->first()) {
    DB::table('email_settings')->insert(['id' => Illuminate\Support\Str::uuid(), 'singleton' => 1, 'primary_provider' => 'log', 'smtp_enabled' => 0, 'created_at' => now(), 'updated_at' => now()]);
    echo "Seeded email_settings\n";
}
if (!DB::table('chatbot_configs')->first()) {
    DB::table('chatbot_configs')->insert(['id' => Illuminate\Support\Str::uuid(), 'singleton' => 1, 'welcome_message' => 'Hello!', 'system_prompt' => 'Assistant', 'model' => 'gpt-3.5-turbo', 'temperature' => 0.7, 'max_tokens' => 1000, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()]);
    echo "Seeded chatbot_configs\n";
}

// Ensure installed marker
file_put_contents(storage_path('installed'), now()->toDateTimeString());
echo "Done\n";
$app->flush();
