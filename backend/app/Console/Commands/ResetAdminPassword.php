<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class ResetAdminPassword extends Command
{
    protected $signature = 'admin:reset-password {email=admin@fageghana.org} {password=password123}';

    protected $description = 'Reset admin password for testing';

    public function handle()
    {
        $email = $this->argument('email');
        $password = $this->argument('password');
        $hash = Hash::make($password);
        
        $rows = DB::table('users')->where('email', $email)->update(['password' => $hash]);
        
        if ($rows > 0) {
            $this->info("Password reset for {$email}. Rows updated: {$rows}");
            
            // Verify
            $user = DB::table('users')->where('email', $email)->first();
            if (Hash::check($password, $user->password)) {
                $this->info("Verification: password matches ✓");
            } else {
                $this->error("Verification: password does NOT match ✗");
            }
            return 0;
        } else {
            $this->error("No user found with email {$email}");
            return 1;
        }
    }
}
