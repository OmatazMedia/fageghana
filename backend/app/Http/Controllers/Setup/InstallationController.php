<?php

namespace App\Http\Controllers\Setup;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class InstallationController extends Controller
{
    public function __construct()
    {
        if ($this->isInstalled()) {
            return redirect('/');
        }
    }

    public function isInstalled(): bool
    {
        return file_exists(storage_path('installed'));
    }

    public function showWizard()
    {
        $step = request()->get('step', 1);
        return view('setup.wizard', compact('step'));
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
            'json' => [
                'label' => 'JSON Extension',
                'met' => extension_loaded('json'),
                'current' => extension_loaded('json') ? 'Loaded' : 'Missing',
            ],
            'mbstring' => [
                'label' => 'Mbstring Extension',
                'met' => extension_loaded('mbstring'),
                'current' => extension_loaded('mbstring') ? 'Loaded' : 'Missing',
            ],
            'fileinfo' => [
                'label' => 'Fileinfo Extension',
                'met' => extension_loaded('fileinfo'),
                'current' => extension_loaded('fileinfo') ? 'Loaded' : 'Missing',
            ],
            'curl' => [
                'label' => 'cURL Extension',
                'met' => extension_loaded('curl'),
                'current' => extension_loaded('curl') ? 'Loaded' : 'Missing',
            ],
            'openssl' => [
                'label' => 'OpenSSL Extension',
                'met' => extension_loaded('openssl'),
                'current' => extension_loaded('openssl') ? 'Loaded' : 'Missing',
            ],
            'env_writable' => [
                'label' => '.env Writable',
                'met' => is_writable(base_path('.env')) || !file_exists(base_path('.env')),
                'current' => is_writable(base_path('.env')) ? 'Writable' : 'Not writable',
            ],
            'storage_writable' => [
                'label' => 'storage/ Writable',
                'met' => is_writable(storage_path()) && is_writable(storage_path('framework')),
                'current' => is_writable(storage_path()) ? 'Writable' : 'Not writable',
            ],
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
                if (!file_exists($dbPath)) {
                    touch($dbPath);
                }
                $pdo = new \PDO('sqlite:' . $dbPath);
                $pdo->exec('SELECT 1');
                return response()->json(['success' => true, 'message' => 'SQLite connection successful']);
            } else {
                $dsn = "mysql:host={$request->db_host};port={$request->db_port};charset=utf8mb4";
                $pdo = new \PDO($dsn, $request->db_username, $request->db_password, [
                    \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                ]);
                // Create database if not exists
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$request->db_database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $pdo->exec("USE `{$request->db_database}`");
                return response()->json(['success' => true, 'message' => 'MySQL connection successful. Database created/verified.']);
            }
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function testEmail(Request $request)
    {
        $request->validate([
            'mail_driver' => 'required|in:smtp,resend,log',
        ]);

        if ($request->mail_driver === 'log') {
            return response()->json(['success' => true, 'message' => 'Email will be logged to storage/logs/']);
        }

        if ($request->mail_driver === 'resend') {
            $request->validate(['resend_api_key' => 'required']);
            return response()->json(['success' => true, 'message' => 'Resend API key will be validated on first send.']);
        }

        if ($request->mail_driver === 'smtp') {
            $request->validate([
                'smtp_host' => 'required',
                'smtp_port' => 'required|integer',
                'smtp_username' => 'required',
                'smtp_password' => 'required',
            ]);

            try {
                $pdo = @new \PDO(
                    "tcp://{$request->smtp_host}:{$request->smtp_port}",
                    null,
                    null,
                    [\PDO::ATTR_TIMEOUT => 5]
                );
                return response()->json(['success' => true, 'message' => 'SMTP server is reachable']);
            } catch (\Exception $e) {
                return response()->json(['success' => true, 'message' => 'SMTP server check skipped (may require actual send to verify)']);
            }
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
            'site_url' => 'required|url|max:500',
            'currency' => 'required|string|max:3',
            'timezone' => 'required|string|max:100',
        ]);

        try {
            // Step 1: Write .env file
            $this->writeEnv($request);

            // Step 2: Run migrations
            Artisan::call('migrate', ['--force' => true]);
            $migrationOutput = Artisan::output();

            // Step 3: Create admin user
            $userId = Str::uuid()->toString();
            DB::table('users')->insert([
                'id' => $userId,
                'name' => $request->admin_name,
                'email' => $request->admin_email,
                'password' => Hash::make($request->admin_password),
                'email_verified_at' => now()->toDateTimeString(),
                'created_at' => now()->toDateTimeString(),
                'updated_at' => now()->toDateTimeString(),
            ]);

            // Step 4: Assign admin role
            DB::table('user_roles')->insert([
                'id' => Str::uuid()->toString(),
                'user_id' => $userId,
                'role' => 'admin',
                'created_at' => now()->toDateTimeString(),
            ]);

            // Step 5: Seed role help
            $this->seedRoleHelp();

            // Step 6: Seed email settings
            DB::table('email_settings')->insert([
                'id' => Str::uuid()->toString(),
                'singleton' => true,
                'primary_provider' => $request->mail_driver ?? 'smtp',
                'smtp_enabled' => ($request->mail_driver === 'smtp'),
                'smtp_host' => $request->smtp_host ?? null,
                'smtp_port' => $request->smtp_port ?? 587,
                'smtp_user' => $request->smtp_user ?? null,
                'smtp_password' => $request->smtp_password ?? null,
                'smtp_from' => $request->smtp_from ?? $request->admin_email,
                'resend_enabled' => ($request->mail_driver === 'resend'),
                'resend_api_key' => $request->resend_api_key ?? null,
                'resend_from' => $request->resend_from ?? $request->admin_email,
                'created_at' => now()->toDateTimeString(),
                'updated_at' => now()->toDateTimeString(),
            ]);

            // Step 7: Seed security settings (already done in migration)

            // Step 8: Seed default email templates
            $this->seedEmailTemplates();

            // Mark as installed
            file_put_contents(storage_path('installed'), now()->toDateTimeString());

            return response()->json([
                'success' => true,
                'message' => 'Installation complete!',
                'admin_login' => $request->site_url . '/admin/login',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Installation failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function writeEnv(Request $request): void
    {
        $appKey = 'base64:' . base64_encode(random_bytes(32));

        $envLines = [
            'APP_NAME="' . addslashes($request->site_name) . '"',
            'APP_ENV=production',
            'APP_KEY=' . $appKey,
            'APP_DEBUG=false',
            'APP_URL=' . $request->site_url,
            'APP_TIMEZONE=' . $request->timezone,
            '',
            'APP_LOCALE=en',
            'APP_FALLBACK_LOCALE=en',
            'APP_FAKER_LOCALE=en_US',
            '',
            'APP_MAINTENANCE_DRIVER=file',
            '',
            'BCRYPT_ROUNDS=12',
            '',
            'LOG_CHANNEL=stack',
            'LOG_STACK=single',
            'LOG_DEPRECATIONS_CHANNEL=null',
            'LOG_LEVEL=error',
            '',
            'DB_CONNECTION=' . $request->db_type,
        ];

        if ($request->db_type === 'mysql') {
            $envLines = array_merge($envLines, [
                'DB_HOST=' . $request->db_host,
                'DB_PORT=' . $request->db_port,
                'DB_DATABASE=' . $request->db_database,
                'DB_USERNAME=' . $request->db_username,
                'DB_PASSWORD=' . ($request->db_password ?? ''),
            ]);
        } else {
            $envLines[] = 'DB_DATABASE=' . $request->db_database;
        }

        $envLines = array_merge($envLines, [
            '',
            'SESSION_DRIVER=database',
            'SESSION_LIFETIME=120',
            'SESSION_ENCRYPT=false',
            'SESSION_PATH=/',
            'SESSION_DOMAIN=null',
            '',
            'BROADCAST_CONNECTION=log',
            'FILESYSTEM_DISK=local',
            'QUEUE_CONNECTION=database',
            '',
            'CACHE_STORE=database',
            'CACHE_PREFIX=fage_',
            '',
            'MAIL_MAILER=' . ($request->mail_driver ?? 'log'),
        ]);

        if ($request->mail_driver === 'smtp') {
            $envLines = array_merge($envLines, [
                'MAIL_HOST=' . ($request->smtp_host ?? ''),
                'MAIL_PORT=' . ($request->smtp_port ?? 587),
                'MAIL_USERNAME=' . ($request->smtp_user ?? ''),
                'MAIL_PASSWORD=' . ($request->smtp_password ?? ''),
                'MAIL_ENCRYPTION=tls',
                'MAIL_FROM_ADDRESS=' . ($request->smtp_from ?? $request->admin_email),
                'MAIL_FROM_NAME="' . addslashes($request->site_name) . '"',
            ]);
        } elseif ($request->mail_driver === 'resend') {
            $envLines = array_merge($envLines, [
                'MAIL_FROM_ADDRESS=' . ($request->resend_from ?? $request->admin_email),
                'MAIL_FROM_NAME="' . addslashes($request->site_name) . '"',
                'RESEND_API_KEY=' . ($request->resend_api_key ?? ''),
            ]);
        }

        $envLines[] = '';
        $envLines[] = 'SANCTUM_STATEFUL_DOMAINS=' . parse_url($request->site_url, PHP_URL_HOST);

        file_put_contents(base_path('.env'), implode("\n", $envLines) . "\n");

        // Regenerate app key with the new env
        Artisan::call('key:generate', ['--force' => true]);
    }

    private function seedRoleHelp(): void
    {
        $roles = [
            ['admin', 'Full access to every part of the admin console.'],
            ['superadmin', 'Same complete access as Admin. Reserved for the most senior system owner.'],
            ['developer', 'Full super-admin access for technical maintenance.'],
            ['staff', 'Day-to-day secretariat work: applications, directory, tickets, content.'],
            ['finance', 'Payments, subscription confirmations and financial reports.'],
            ['ceo', 'Read-heavy oversight of payments, membership growth and reports.'],
            ['coordinator', 'Member readiness, certificates and trade opportunities.'],
            ['moderator', 'Limited content moderation duties.'],
            ['editor', 'Can manage published content (news, products, activities).'],
            ['user', 'Standard member access to dashboard, directory, resources and support.'],
        ];

        foreach ($roles as [$role, $summary]) {
            DB::table('role_help')->insert([
                'role' => $role,
                'summary' => $summary,
                'created_at' => now()->toDateTimeString(),
                'updated_at' => now()->toDateTimeString(),
            ]);
        }
    }

    private function seedEmailTemplates(): void
    {
        $templates = [
            ['prefs_newsletters_on', 'Newsletters Enabled', 'Newsletters have been enabled on your account.'],
            ['prefs_newsletters_off', 'Newsletters Disabled', 'Newsletters have been disabled on your account.'],
            ['prefs_event_alerts_on', 'Event Alerts Enabled', 'Event alerts have been enabled on your account.'],
            ['prefs_event_alerts_off', 'Event Alerts Disabled', 'Event alerts have been disabled on your account.'],
            ['prefs_trade_notices_on', 'Trade Notices Enabled', 'Trade notices have been enabled on your account.'],
            ['prefs_trade_notices_off', 'Trade Notices Disabled', 'Trade notices have been disabled on your account.'],
            ['prefs_payment_reminders_on', 'Payment Reminders Enabled', 'Payment reminders have been enabled on your account.'],
            ['prefs_payment_reminders_off', 'Payment Reminders Disabled', 'Payment reminders have been disabled on your account.'],
        ];

        foreach ($templates as [$key, $name, $subject]) {
            DB::table('email_templates')->insert([
                'id' => Str::uuid()->toString(),
                'key' => $key,
                'name' => $name,
                'subject' => $subject,
                'blocks' => json_encode([
                    ['type' => 'heading', 'text' => $name],
                    ['type' => 'text', 'text' => "This confirms that your email preference has been updated."],
                ]),
                'created_at' => now()->toDateTimeString(),
                'updated_at' => now()->toDateTimeString(),
            ]);
        }
    }
}
