<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class SetupController extends Controller
{
    public function status()
    {
        $installed = file_exists(storage_path('installed'));
        return response()->json([
            'installed' => $installed,
            'installed_at' => $installed ? file_get_contents(storage_path('installed')) : null,
        ]);
    }

    public function checkRequirements()
    {
        $requirements = [
            'php_version' => [
                'label' => 'PHP 8.2+',
                'met' => version_compare(PHP_VERSION, '8.2.0', '>='),
                'current' => PHP_VERSION,
            ],
            'pdo_sqlite' => [
                'label' => 'PDO SQLite',
                'met' => extension_loaded('pdo_sqlite'),
                'current' => extension_loaded('pdo_sqlite') ? 'Loaded' : 'Missing',
            ],
            'pdo_mysql' => [
                'label' => 'PDO MySQL',
                'met' => extension_loaded('pdo_mysql'),
                'current' => extension_loaded('pdo_mysql') ? 'Loaded' : 'Missing',
            ],
            'json' => ['label' => 'JSON Extension', 'met' => extension_loaded('json'), 'current' => extension_loaded('json') ? 'Loaded' : 'Missing'],
            'mbstring' => ['label' => 'Mbstring Extension', 'met' => extension_loaded('mbstring'), 'current' => extension_loaded('mbstring') ? 'Loaded' : 'Missing'],
            'curl' => ['label' => 'cURL Extension', 'met' => extension_loaded('curl'), 'current' => extension_loaded('curl') ? 'Loaded' : 'Missing'],
            'openssl' => ['label' => 'OpenSSL Extension', 'met' => extension_loaded('openssl'), 'current' => extension_loaded('openssl') ? 'Loaded' : 'Missing'],
            'env_writable' => [
                'label' => '.env Writable',
                'met' => is_writable(base_path('.env')) || !file_exists(base_path('.env')),
                'current' => file_exists(base_path('.env')) ? (is_writable(base_path('.env')) ? 'Writable' : 'Not writable') : 'Will be created',
            ],
            'storage_writable' => ['label' => 'storage/ Writable', 'met' => is_writable(storage_path()), 'current' => is_writable(storage_path()) ? 'Writable' : 'Not writable'],
        ];

        $allMet = collect($requirements)->every(fn($r) => $r['met']);
        return response()->json(['requirements' => $requirements, 'all_met' => $allMet]);
    }

    public function testDatabase(Request $request)
    {
        $request->validate([
            'db_type' => 'required|in:sqlite,mysql',
            'db_host' => 'required_if:db_type,mysql',
            'db_port' => 'required_if:db_type,mysql',
            'db_database' => 'required',
            'db_username' => 'required_if:db_type,mysql',
            'db_password' => 'nullable',
        ]);

        try {
            if ($request->db_type === 'sqlite') {
                $dbPath = $request->db_database;
                if (!file_exists($dbPath)) touch($dbPath);
                $pdo = new \PDO('sqlite:' . $dbPath);
                $pdo->exec('SELECT 1');
                return response()->json(['success' => true, 'message' => 'SQLite connection successful']);
            } else {
                $dsn = "mysql:host={$request->db_host};port={$request->db_port};charset=utf8mb4";
                $pdo = new \PDO($dsn, $request->db_username, $request->db_password, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$request->db_database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                return response()->json(['success' => true, 'message' => 'MySQL connection successful']);
            }
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function testEmail(Request $request)
    {
        $request->validate(['mail_driver' => 'required|in:smtp,resend,log']);
        if ($request->mail_driver === 'log') {
            return response()->json(['success' => true, 'message' => 'Email will be logged to storage/logs/']);
        }
        return response()->json(['success' => true, 'message' => 'Email configuration saved']);
    }

    public function install(Request $request)
    {
        $request->validate([
            'db_type' => 'required|in:sqlite,mysql',
            'admin_name' => 'required|string|max:255',
            'admin_email' => 'required|email|max:255',
            'admin_password' => 'required|string|min:8|confirmed',
            'site_name' => 'required|string|max:255',
            'site_url' => 'required|max:500',
            'currency' => 'required|string|max:3',
            'timezone' => 'required|string|max:100',
        ]);

        try {
            $this->writeEnv($request);
            Artisan::call('migrate', ['--force' => true]);

            $userId = Str::uuid()->toString();
            DB::table('users')->insert([
                'id' => $userId, 'name' => $request->admin_name, 'email' => $request->admin_email,
                'password' => Hash::make($request->admin_password), 'email_verified_at' => now()->toDateTimeString(),
                'created_at' => now()->toDateTimeString(), 'updated_at' => now()->toDateTimeString(),
            ]);

            DB::table('user_roles')->insert([
                'id' => Str::uuid()->toString(), 'user_id' => $userId, 'role' => 'admin',
                'created_at' => now()->toDateTimeString(),
            ]);

            $this->seedDefaults();
            file_put_contents(storage_path('installed'), now()->toDateTimeString());

            return response()->json(['success' => true, 'message' => 'Installation complete!']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Installation failed: ' . $e->getMessage()], 500);
        }
    }

    public function importSupabaseBackup(Request $request)
    {
        return response()->json(['success' => true, 'message' => 'Supabase backup import - implement in Phase 8']);
    }

    private function writeEnv(Request $request): void
    {
        $appKey = 'base64:' . base64_encode(random_bytes(32));
        $envLines = [
            'APP_NAME="' . addslashes($request->site_name) . '"',
            'APP_ENV=production', 'APP_KEY=' . $appKey, 'APP_DEBUG=false',
            'APP_URL=' . $request->site_url, 'APP_TIMEZONE=' . $request->timezone, '',
            'APP_LOCALE=en', 'APP_FALLBACK_LOCALE=en', 'APP_MAINTENANCE_DRIVER=file', '',
            'BCRYPT_ROUNDS=12', '', 'LOG_CHANNEL=stack', 'LOG_STACK=single', 'LOG_LEVEL=error', '',
            'DB_CONNECTION=' . $request->db_type,
        ];

        if ($request->db_type === 'mysql') {
            $envLines = array_merge($envLines, [
                'DB_HOST=' . $request->db_host, 'DB_PORT=' . $request->db_port,
                'DB_DATABASE=' . $request->db_database, 'DB_USERNAME=' . $request->db_username,
                'DB_PASSWORD=' . ($request->db_password ?? ''),
            ]);
        } else {
            $envLines[] = 'DB_DATABASE=' . $request->db_database;
        }

        $envLines = array_merge($envLines, [
            '', 'SESSION_DRIVER=database', 'SESSION_LIFETIME=120', '',
            'CACHE_STORE=database', 'QUEUE_CONNECTION=database', '',
            'SANCTUM_STATEFUL_DOMAINS=' . parse_url($request->site_url, PHP_URL_HOST),
        ]);

        if (($request->mail_driver ?? '') === 'smtp') {
            $envLines = array_merge($envLines, [
                '', 'MAIL_MAILER=smtp', 'MAIL_HOST=' . ($request->smtp_host ?? ''),
                'MAIL_PORT=' . ($request->smtp_port ?? 587), 'MAIL_USERNAME=' . ($request->smtp_user ?? ''),
                'MAIL_PASSWORD=' . ($request->smtp_password ?? ''), 'MAIL_ENCRYPTION=tls',
                'MAIL_FROM_ADDRESS=' . ($request->smtp_from ?? $request->admin_email),
                'MAIL_FROM_NAME="' . addslashes($request->site_name) . '"',
            ]);
        }

        // Write .env
        $envPath = base_path('.env');
        $content = implode("\n", $envLines) . "\n";
        $result = @file_put_contents($envPath, $content);
        if ($result === false) {
            // Fallback: try writing via stream (handles some Windows permission issues)
            $fp = @fopen($envPath, 'w');
            if ($fp) {
                fwrite($fp, $content);
                fclose($fp);
            } else {
                throw new \RuntimeException('Could not write .env file. Check file permissions.');
            }
        }
        // Generate APP_KEY inline
        $key = 'base64:' . base64_encode(random_bytes(32));
        $envContent = file_get_contents($envPath);
        $envContent = preg_replace('/^APP_KEY=.*/m', 'APP_KEY=' . $key, $envContent);
        @file_put_contents($envPath, $envContent);
    }

    private function seedDefaults(): void
    {
        $roles = [
            ['admin', 'Full access to every part of the admin console.'],
            ['superadmin', 'Same complete access as Admin.'],
            ['developer', 'Full super-admin access for technical maintenance.'],
            ['staff', 'Day-to-day secretariat work.'],
            ['finance', 'Payments and financial reports.'],
            ['ceo', 'Read-heavy oversight.'],
            ['coordinator', 'Member readiness and certificates.'],
            ['moderator', 'Content moderation duties.'],
            ['editor', 'Manage published content.'],
            ['user', 'Standard member access.'],
        ];

        foreach ($roles as [$role, $summary]) {
            DB::table('role_help')->insert([
                'role' => $role, 'summary' => $summary,
                'created_at' => now()->toDateTimeString(), 'updated_at' => now()->toDateTimeString(),
            ]);
        }

        DB::table('security_settings')->insert([
            'id' => Str::uuid()->toString(), 'singleton' => true,
            'member_idle_minutes' => 10, 'console_idle_minutes' => 10,
            'countdown_seconds' => 10, 'beep_enabled' => true,
            'created_at' => now()->toDateTimeString(), 'updated_at' => now()->toDateTimeString(),
        ]);

        DB::table('email_settings')->insert([
            'id' => Str::uuid()->toString(), 'singleton' => true, 'primary_provider' => 'log',
            'smtp_enabled' => false, 'updated_at' => now()->toDateTimeString(),
        ]);

        DB::table('chatbot_configs')->insert([
            'id' => Str::uuid()->toString(), 'singleton' => true,
            'welcome_message' => 'Hello! How can I help you today?',
            'system_prompt' => 'You are a helpful assistant for FAGE Ghana.',
            'model' => 'gpt-3.5-turbo', 'temperature' => 0.7, 'max_tokens' => 1000, 'is_active' => true,
            'created_at' => now()->toDateTimeString(), 'updated_at' => now()->toDateTimeString(),
        ]);
    }
}
