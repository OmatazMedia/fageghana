<?php
/**
 * Standalone password reset script — run from the backend/ directory.
 * Usage: php reset-password.php
 */

// Bootstrap Laravel
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

$email = 'admin@fageghana.org';
$password = 'password123';
$hash = Hash::make($password);

$rows = DB::table('users')->where('email', $email)->update(['password' => $hash]);
echo "Updated {$rows} rows for {$email}\n";

if ($rows > 0) {
    $user = DB::table('users')->where('email', $email)->first();
    if (Hash::check($password, $user->password)) {
        echo "Verification: password matches ✓\n";
    } else {
        echo "Verification FAILED ✗\n";
    }
} else {
    echo "No user found!\n";
}

// Also add the user to admin role if not present
$roleExists = DB::table('user_roles')->where('user_id', $user->id ?? '')->where('role', 'admin')->exists();
if (!$roleExists && isset($user)) {
    DB::table('user_roles')->insert([
        'id' => Illuminate\Support\Str::uuid()->toString(),
        'user_id' => $user->id,
        'role' => 'admin',
        'created_at' => now()->toDateTimeString(),
    ]);
    echo "Added admin role ✓\n";
}

$app->flush();
