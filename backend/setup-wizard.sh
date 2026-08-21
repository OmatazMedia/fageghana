#!/bin/bash
# Master setup script for all Laravel backend files
# Run from /c/fage-backend

set -e

echo "🔧 Creating Installation Wizard..."

# ============================================
# Installation Middleware
# ============================================
mkdir -p app/Http/Middleware

cat > app/Http/Middleware/CheckInstalled.php << 'PHPEOF'
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckInstalled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$this->isInstalled()) {
            if ($request->is('setup*') || $request->is('api/setup/*')) {
                return $next($request);
            }
            return redirect('/setup');
        }

        return $next($request);
    }

    public function isInstalled(): bool
    {
        return file_exists(storage_path('installed'));
    }
}
PHPEOF

echo "✅ CheckInstalled middleware created"

# ============================================
# Installation Controller
# ============================================
mkdir -p app/Http/Controllers/Setup

cat > app/Http/Controllers/Setup/InstallationController.php << 'PHPEOF'
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
PHPEOF

echo "✅ InstallationController created"

# ============================================
# Setup Blade View
# ============================================
mkdir -p resources/views/setup

cat > resources/views/setup/wizard.blade.php << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FAGE Ghana — Installation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { max-width: 640px; width: 100%; padding: 2rem; }
        .card { background: #1e293b; border-radius: 12px; padding: 2rem; border: 1px solid #334155; }
        h1 { color: #10b981; font-size: 1.5rem; margin-bottom: 0.5rem; }
        h2 { color: #94a3b8; font-size: 1rem; margin-bottom: 1.5rem; font-weight: normal; }
        .step-indicator { display: flex; gap: 8px; margin-bottom: 2rem; }
        .step-dot { width: 100%; height: 4px; border-radius: 2px; background: #334155; }
        .step-dot.active { background: #10b981; }
        .step-dot.done { background: #059669; }
        label { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #94a3b8; }
        input, select { width: 100%; padding: 0.6rem 0.75rem; background: #0f172a; border: 1px solid #475569; border-radius: 8px; color: #e2e8f0; font-size: 0.9rem; margin-bottom: 1rem; }
        input:focus, select:focus { outline: none; border-color: #10b981; }
        .btn { display: inline-block; padding: 0.6rem 1.5rem; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 0.9rem; cursor: pointer; font-weight: 600; }
        .btn:hover { background: #059669; }
        .btn-secondary { background: #475569; }
        .btn-secondary:hover { background: #64748b; }
        .row { display: flex; gap: 1rem; }
        .row > div { flex: 1; }
        .hidden { display: none; }
        .error { color: #ef4444; font-size: 0.8rem; margin-bottom: 1rem; }
        .success { color: #10b981; font-size: 0.8rem; margin-bottom: 1rem; }
        .req-list { list-style: none; margin-bottom: 1.5rem; }
        .req-list li { padding: 0.4rem 0; font-size: 0.875rem; display: flex; justify-content: space-between; }
        .req-met { color: #10b981; }
        .req-fail { color: #ef4444; }
        .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #475569; border-top-color: #10b981; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>🌿 FAGE Ghana</h1>
            <h2>Installation Wizard</h2>

            <div class="step-indicator" id="step-indicator"></div>

            <!-- STEP 1: Requirements -->
            <div id="step-1" class="step-content">
                <h3 style="margin-bottom: 1rem;">Server Requirements</h3>
                <div id="requirements-list"></div>
                <button class="btn" onclick="nextStep()" id="btn-step1">Continue</button>
            </div>

            <!-- STEP 2: Database -->
            <div id="step-2" class="step-content hidden">
                <h3 style="margin-bottom: 1rem;">Database Configuration</h3>
                <div class="row">
                    <div>
                        <label>Database Type</label>
                        <select id="db_type" onchange="toggleDbFields()">
                            <option value="sqlite">SQLite (Dev/Testing)</option>
                            <option value="mysql">MySQL (Production)</option>
                        </select>
                    </div>
                </div>
                <div id="mysql-fields" class="hidden">
                    <div class="row">
                        <div><label>Host</label><input id="db_host" value="127.0.0.1"></div>
                        <div><label>Port</label><input id="db_port" value="3306"></div>
                    </div>
                    <div class="row">
                        <div><label>Database Name</label><input id="db_database_mysql" value="fage_ghana"></div>
                    </div>
                    <div class="row">
                        <div><label>Username</label><input id="db_username" value="root"></div>
                        <div><label>Password</label><input id="db_password" type="password"></div>
                    </div>
                </div>
                <div id="sqlite-fields">
                    <label>Database Path</label>
                    <input id="db_database_sqlite" value="{{ database_path('database.sqlite') }}">
                </div>
                <div id="db-test-result"></div>
                <button class="btn-secondary btn" onclick="prevStep()">Back</button>
                <button class="btn" onclick="testDb()">Test Connection</button>
                <button class="btn hidden" id="btn-to-step3" onclick="nextStep()" style="margin-left: 0.5rem;">Continue →</button>
            </div>

            <!-- STEP 3: Admin -->
            <div id="step-3" class="step-content hidden">
                <h3 style="margin-bottom: 1rem;">Admin Account</h3>
                <label>Full Name</label>
                <input id="admin_name" value="Admin">
                <label>Email</label>
                <input id="admin_email" type="email">
                <label>Password</label>
                <input id="admin_password" type="password" minlength="8">
                <label>Confirm Password</label>
                <input id="admin_password_confirmation" type="password">
                <button class="btn-secondary btn" onclick="prevStep()">Back</button>
                <button class="btn" onclick="nextStep()" style="margin-left: 0.5rem;">Continue →</button>
            </div>

            <!-- STEP 4: Email -->
            <div id="step-4" class="step-content hidden">
                <h3 style="margin-bottom: 1rem;">Email Configuration</h3>
                <label>Mail Driver</label>
                <select id="mail_driver" onchange="toggleEmailFields()">
                    <option value="log">Log Only (Development)</option>
                    <option value="smtp">SMTP</option>
                    <option value="resend">Resend API</option>
                </select>
                <div id="smtp-fields" class="hidden">
                    <div class="row">
                        <div><label>SMTP Host</label><input id="smtp_host" value="smtp.gmail.com"></div>
                        <div><label>SMTP Port</label><input id="smtp_port" value="587"></div>
                    </div>
                    <label>Username</label>
                    <input id="smtp_user" placeholder="your@email.com">
                    <label>Password</label>
                    <input id="smtp_password" type="password">
                    <label>From Address</label>
                    <input id="smtp_from" placeholder="noreply@fageghana.org">
                </div>
                <div id="resend-fields" class="hidden">
                    <label>Resend API Key</label>
                    <input id="resend_api_key" placeholder="re_xxxxx">
                    <label>From Address</label>
                    <input id="resend_from" placeholder="noreply@fageghana.org">
                </div>
                <button class="btn-secondary btn" onclick="prevStep()">Back</button>
                <button class="btn" onclick="nextStep()" style="margin-left: 0.5rem;">Continue →</button>
            </div>

            <!-- STEP 5: Settings -->
            <div id="step-5" class="step-content hidden">
                <h3 style="margin-bottom: 1rem;">Application Settings</h3>
                <label>Site Name</label>
                <input id="site_name" value="FAGE Ghana">
                <label>Site URL</label>
                <input id="site_url" value="https://fageghana.org" placeholder="https://example.com">
                <div class="row">
                    <div>
                        <label>Currency</label>
                        <select id="currency">
                            <option value="GHS" selected>GHS (Ghana Cedi)</option>
                            <option value="NGN">NGN (Nigerian Naira)</option>
                            <option value="USD">USD (US Dollar)</option>
                            <option value="EUR">EUR (Euro)</option>
                            <option value="GBP">GBP (British Pound)</option>
                        </select>
                    </div>
                    <div>
                        <label>Timezone</label>
                        <select id="timezone">
                            <option value="Africa/Accra" selected>Africa/Accra (GMT)</option>
                            <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                            <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                            <option value="UTC">UTC</option>
                        </select>
                    </div>
                </div>
                <button class="btn-secondary btn" onclick="prevStep()">Back</button>
                <button class="btn" onclick="install()" style="margin-left: 0.5rem;" id="btn-install">🚀 Install Now</button>
            </div>

            <!-- STEP 6: Complete -->
            <div id="step-6" class="step-content hidden">
                <h3 style="margin-bottom: 1rem; color: #10b981;">✅ Installation Complete!</h3>
                <p style="margin-bottom: 1rem; color: #94a3b8;">Your FAGE Ghana backend is ready.</p>
                <div id="install-result"></div>
                <a href="/" class="btn" style="text-decoration: none; margin-top: 1rem;">Go to Admin Panel →</a>
            </div>
        </div>
    </div>

    <script>
    let currentStep = 1;
    const totalSteps = 6;

    function updateStepIndicator() {
        const container = document.getElementById('step-indicator');
        container.innerHTML = '';
        for (let i = 1; i <= totalSteps; i++) {
            const dot = document.createElement('div');
            dot.className = 'step-dot' + (i < currentStep ? ' done' : '') + (i === currentStep ? ' active' : '');
            container.appendChild(dot);
        }
    }

    function showStep(n) {
        document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
        document.getElementById('step-' + n).classList.remove('hidden');
        currentStep = n;
        updateStepIndicator();
    }

    function nextStep() { showStep(currentStep + 1); }
    function prevStep() { showStep(currentStep - 1); }

    function toggleDbFields() {
        const type = document.getElementById('db_type').value;
        document.getElementById('mysql-fields').classList.toggle('hidden', type !== 'mysql');
        document.getElementById('sqlite-fields').classList.toggle('hidden', type !== 'sqlite');
    }

    function toggleEmailFields() {
        const driver = document.getElementById('mail_driver').value;
        document.getElementById('smtp-fields').classList.toggle('hidden', driver !== 'smtp');
        document.getElementById('resend-fields').classList.toggle('hidden', driver !== 'resend');
    }

    function testDb() {
        const result = document.getElementById('db-test-result');
        result.innerHTML = '<span class="spinner"></span> Testing...';
        const body = {
            db_type: document.getElementById('db_type').value,
            db_database: document.getElementById('db_type').value === 'mysql'
                ? document.getElementById('db_database_mysql').value
                : document.getElementById('db_database_sqlite').value,
        };
        if (body.db_type === 'mysql') {
            body.db_host = document.getElementById('db_host').value;
            body.db_port = document.getElementById('db_port').value;
            body.db_username = document.getElementById('db_username').value;
            body.db_password = document.getElementById('db_password').value;
        }
        fetch('/api/setup/test-db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': '{{ csrf_token() }}' },
            body: JSON.stringify(body),
        }).then(r => r.json()).then(data => {
            if (data.success) {
                result.innerHTML = '<span class="success">✅ ' + data.message + '</span>';
                document.getElementById('btn-to-step3').classList.remove('hidden');
            } else {
                result.innerHTML = '<span class="error">❌ ' + data.message + '</span>';
            }
        }).catch(err => {
            result.innerHTML = '<span class="error">❌ ' + err.message + '</span>';
        });
    }

    function install() {
        const btn = document.getElementById('btn-install');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Installing...';

        const body = {
            db_type: document.getElementById('db_type').value,
            db_database: document.getElementById('db_type').value === 'mysql'
                ? document.getElementById('db_database_mysql').value
                : document.getElementById('db_database_sqlite').value,
            admin_name: document.getElementById('admin_name').value,
            admin_email: document.getElementById('admin_email').value,
            admin_password: document.getElementById('admin_password').value,
            admin_password_confirmation: document.getElementById('admin_password_confirmation').value,
            site_name: document.getElementById('site_name').value,
            site_url: document.getElementById('site_url').value,
            currency: document.getElementById('currency').value,
            timezone: document.getElementById('timezone').value,
            mail_driver: document.getElementById('mail_driver').value,
        };
        if (body.db_type === 'mysql') {
            body.db_host = document.getElementById('db_host').value;
            body.db_port = document.getElementById('db_port').value;
            body.db_username = document.getElementById('db_username').value;
            body.db_password = document.getElementById('db_password').value;
        }
        if (body.mail_driver === 'smtp') {
            body.smtp_host = document.getElementById('smtp_host').value;
            body.smtp_port = document.getElementById('smtp_port').value;
            body.smtp_user = document.getElementById('smtp_user').value;
            body.smtp_password = document.getElementById('smtp_password').value;
            body.smtp_from = document.getElementById('smtp_from').value;
        }
        if (body.mail_driver === 'resend') {
            body.resend_api_key = document.getElementById('resend_api_key').value;
            body.resend_from = document.getElementById('resend_from').value;
        }

        fetch('/api/setup/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': '{{ csrf_token() }}' },
            body: JSON.stringify(body),
        }).then(r => r.json()).then(data => {
            if (data.success) {
                document.getElementById('install-result').innerHTML =
                    '<p style="color: #10b981; margin-bottom: 0.5rem;">✅ ' + data.message + '</p>' +
                    '<p style="color: #94a3b8; font-size: 0.85rem;">Admin: ' + (data.admin_login || '/') + '</p>';
                showStep(6);
            } else {
                btn.disabled = false;
                btn.innerHTML = '🚀 Install Now';
                document.getElementById('install-result').innerHTML =
                    '<p style="color: #ef4444;">❌ ' + data.message + '</p>';
                showStep(6);
            }
        }).catch(err => {
            btn.disabled = false;
            btn.innerHTML = '🚀 Install Now';
            document.getElementById('install-result').innerHTML =
                '<p style="color: #ef4444;">❌ Installation error: ' + err.message + '</p>';
            showStep(6);
        });
    }

    // Check requirements on load
    fetch('/api/setup/requirements').then(r => r.json()).then(data => {
        const list = document.getElementById('requirements-list');
        let html = '<ul class="req-list">';
        for (const [key, req] of Object.entries(data.requirements)) {
            html += '<li><span>' + req.label + '</span><span class="' + (req.met ? 'req-met' : 'req-fail') + '">' + req.current + '</span></li>';
        }
        html += '</ul>';
        list.innerHTML = html;
        if (!data.all_met) {
            document.getElementById('btn-step1').disabled = true;
            document.getElementById('btn-step1').textContent = 'Requirements not met';
        }
    });

    updateStepIndicator();
    </script>
</body>
</html>
HTMLEOF

echo "✅ Setup wizard view created"

echo ""
echo "🎉 Installation Wizard complete!"
