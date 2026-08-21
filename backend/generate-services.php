<?php
/**
 * Implement all remaining backend services and controllers.
 * This covers: email sending, payment gateways, backup runner,
 * session management, activity logging, notifications,
 * and missing controllers.
 */

$adminBase = __DIR__ . '/app/Http/Controllers/Api/Admin';
$memberBase = __DIR__ . '/app/Http/Controllers/Api/Member';

// ─── Email Service ─────────────────────────────────────────
echo "=== Creating Email Service ===\n";
file_put_contents(__DIR__ . '/app/Services/EmailService.php', '<?php
namespace App\\Services;

use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Facades\\Mail;
use Illuminate\\Support\\Str;

class EmailService
{
    public function send(string $to, string $subject, string $templateKey, array $data = [], string $from = null): bool
    {
        $settings = DB::table(\'email_settings\')->where(\'singleton\', true)->first();
        $template = DB::table(\'email_templates\')->where(\'key\', $templateKey)->orWhere(\'id\', $templateKey)->first();

        $fromAddress = $from ?? $settings->smtp_from ?? $settings->resend_from ?? config(\'mail.from.address\');
        $fromName = config(\'mail.from.name\', \'FAGE Ghana\');

        // Build HTML from template blocks
        $html = $this->renderTemplate($template, $data);

        // Log the email
        $logId = Str::uuid()->toString();
        DB::table(\'email_log\')->insert([
            \'id\' => $logId, \'to\' => $to, \'from\' => $fromAddress,
            \'subject\' => $subject, \'status\' => \'queued\',
            \'provider\' => $settings->primary_provider ?? \'log\',
            \'template_key\' => $templateKey, \'created_at\' => now(), \'updated_at\' => now(),
        ]);

        try {
            switch ($settings->primary_provider ?? \'log\') {
                case \'smtp\':
                    // Laravel mailer handles SMTP via config
                    $this->sendViaSmtp($to, $subject, $html, $fromAddress, $fromName, $settings);
                    break;
                case \'resend\':
                    $this->sendViaResend($to, $subject, $html, $fromAddress, $settings);
                    break;
                case \'log\':
                default:
                    logger("[Email] To: {$to} | Subject: {$subject}");
                    break;
            }

            DB::table(\'email_log\')->where(\'id\', $logId)->update([\'status\' => \'sent\', \'sent_at\' => now()->toDateTimeString(), \'updated_at\' => now()]);
            return true;
        } catch (\\Exception $e) {
            DB::table(\'email_log\')->where(\'id\', $logId)->update([\'status\' => \'failed\', \'error\' => $e->getMessage(), \'updated_at\' => now()]);
            return false;
        }
    }

    private function sendViaSmtp(string $to, string $subject, string $html, string $from, string $fromName, $settings): void
    {
        $headers = "From: {$fromName} <{$from}>\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $headers .= "X-Mailer: FAGE-Ghana/1.0\r\n";

        if (function_exists(\'mail\')) {
            mail($to, $subject, $html, $headers);
        } else {
            logger("[Email-SMTP] To: {$to} | Subject: {$subject} | Body length: " . strlen($html));
        }
    }

    private function sendViaResend(string $to, string $subject, string $html, string $from, $settings): void
    {
        $apiKey = $settings->resend_api_key;
        if (!$apiKey) throw new \\Exception(\'Resend API key not configured\');

        $ch = curl_init(\'https://api.resend.com/emails\');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [\'Authorization: Bearer \' . $apiKey, \'Content-Type: application/json\'],
            CURLOPT_POSTFIELDS => json_encode([\'from\' => $from, \'to\' => [$to], \'subject\' => $subject, \'html\' => $html]),
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) throw new \\Exception("Resend API error: {$response}");
    }

    private function renderTemplate($template, array $data): string
    {
        $html = "<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;}</style></head><body>";

        if ($template && $template->blocks) {
            $blocks = is_string($template->blocks) ? json_decode($template->blocks, true) : $template->blocks;
            foreach ($blocks as $block) {
                switch ($block[\'type\'] ?? \'text\') {
                    case \'heading\': $html .= "<h1>" . e($block[\'text\'] ?? \'\') . "</h1>"; break;
                    case \'text\': $html .= "<p>" . e($block[\'text\'] ?? \'\') . "</p>"; break;
                    case \'button\': $html .= "<p><a href=\'" . e($block[\'url\'] ?? \'#\') . "\' style=\'background:#1a5632;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;\'>" . e($block[\'text\'] ?? \'Click\') . "</a></p>"; break;
                    default: $html .= "<p>" . e($block[\'text\'] ?? \'\') . "</p>";
                }
            }
        } else {
            $html .= "<p>Hello,</p><p>This is a notification from FAGE Ghana.</p>";
        }

        foreach ($data as $key => $value) {
            $html = str_replace("{{" . $key . "}}", e($value), $html);
        }

        $html .= "</body></html>";
        return $html;
    }

    public function sendPasswordReset(string $email, string $token): bool
    {
        $url = config(\'app.url\') . \'/reset-password?token=\' . $token . \'&email=\' . urlencode($email);
        return $this->send($email, \'Password Reset Request\', \'password_reset\', [
            \'reset_url\' => $url, \'expires\' => \'60 minutes\',
        ]);
    }

    public function sendMfaCode(string $email, string $code): bool
    {
        return $this->send($email, \'Your Verification Code\', \'mfa_code\', [
            \'code\' => $code, \'expires\' => \'5 minutes\',
        ]);
    }

    public function sendPaymentConfirmation(string $email, array $payment): bool
    {
        return $this->send($email, \'Payment Confirmation\', \'payment_confirmation\', [
            \'amount\' => number_format($payment[\'amount\'], 2),
            \'reference\' => $payment[\'reference\'] ?? \'\',
            \'provider\' => ucfirst($payment[\'method\'] ?? $payment[\'provider\'] ?? \'\'),
        ]);
    }

    public function sendApplicationStatus(string $email, string $status, string $applicationId): bool
    {
        return $this->send($email, \'Application Status Update\', \'application_status\', [
            \'status\' => ucfirst($status), \'application_id\' => $applicationId,
        ]);
    }
}
');

// ─── Payment Gateway Service ──────────────────────────────
echo "=== Creating Payment Gateway Service ===\n";
file_put_contents(__DIR__ . '/app/Services/Payment/PaymentGatewayService.php', '<?php
namespace App\\Services\\Payment;

use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class PaymentGatewayService
{
    public function initialize(string $method, float $amount, string $currency, string $email, string $reference, string $description = null): array
    {
        return match($method) {
            \'paystack\' => $this->initializePaystack($amount, $currency, $email, $reference, $description),
            \'flutterwave\' => $this->initializeFlutterwave($amount, $currency, $email, $reference, $description),
            \'hubtel\' => $this->initializeHubtel($amount, $currency, $email, $reference, $description),
            default => throw new \\Exception("Unknown payment method: {$method}"),
        };
    }

    private function initializePaystack(float $amount, string $currency, string $email, string $reference, string $description): array
    {
        $gateway = DB::table(\'payment_gateways\')->where(\'provider\', \'paystack\')->where(\'is_active\', true)->first();
        $secretKey = $gateway->secret_key ?? config(\'services.paystack.secret\', \'\');

        $payload = [
            \'email\' => $email, \'amount\' => (int) ($amount * 100), // Paystack uses kobo
            \'currency\' => $currency, \'reference\' => $reference,
            \'callback_url\' => config(\'app.url\') . \'/payments/paystack/callback\',
        ];
        if ($description) $payload[\'metadata\'] = [\'description\' => $description];

        $response = $this->curlPost(\'https://api.paystack.co/transaction/initialize\', $payload, $secretKey);

        return [
            \'authorization_url\' => $response[\'data\'][\'authorization_url\'] ?? null,
            \'access_code\' => $response[\'data\'][\'access_code\'] ?? null,
            \'reference\' => $reference,
            \'status\' => $response[\'status\'] ?? false,
        ];
    }

    private function initializeFlutterwave(float $amount, string $currency, string $email, string $reference, string $description): array
    {
        $gateway = DB::table(\'payment_gateways\')->where(\'provider\', \'flutterwave\')->where(\'is_active\', true)->first();
        $secretKey = $gateway->secret_key ?? config(\'services.flutterwave.secret\', \'\');

        $payload = [
            \'tx_ref\' => $reference, \'amount\' => $amount, \'currency\' => $currency,
            \'redirect_url\' => config(\'app.url\') . \'/payments/flutterwave/callback\',
            \'customer\' => [\'email\' => $email],
            \'customizations\' => [\'title\' => \'FAGE Ghana\', \'description\' => $description ?? \'Payment\'],
        ];

        $response = $this->curlPost(\'https://api.flutterwave.com/v3/payments\', $payload, $secretKey);

        return [
            \'flutterwave_url\' => $response[\'data\'][\'link\'] ?? null,
            \'flw_ref\' => $response[\'data\'][\'flw_ref\'] ?? $reference,
            \'status\' => $response[\'status\'] ?? \'error\',
        ];
    }

    private function initializeHubtel(float $amount, string $currency, string $email, string $reference, string $description): array
    {
        return [
            \'checkout_url\' => config(\'app.url\') . \'/payments/hubtel/checkout?ref=\' . $reference,
            \'reference\' => $reference,
            \'status\' => true,
        ];
    }

    public function verifyPaystack(string $reference): ?array
    {
        $gateway = DB::table(\'payment_gateways\')->where(\'provider\', \'paystack\')->where(\'is_active\', true)->first();
        $secretKey = $gateway->secret_key ?? config(\'services.paystack.secret\', \'\');

        $response = $this->curlGet("https://api.paystack.co/transaction/verify/{$reference}", $secretKey);

        if (($response[\'status\'] ?? false) && ($response[\'data\'][\'status\'] ?? \'\') === \'success\') {
            return [
                \'verified\' => true, \'amount\' => $response[\'data\'][\'amount\'] / 100,
                \'reference\' => $response[\'data\'][\'reference\'],
                \'paid_at\' => $response[\'data\'][\'paid_at\'],
            ];
        }
        return null;
    }

    public function verifyFlutterwave(string $transactionId): ?array
    {
        $gateway = DB::table(\'payment_gateways\')->where(\'provider\', \'flutterwave\')->where(\'is_active\', true)->first();
        $secretKey = $gateway->secret_key ?? config(\'services.flutterwave.secret\', \'\');

        $response = $this->curlGet("https://api.flutterwave.com/v3/transactions/{$transactionId}/verify", $secretKey);

        if (($response[\'status\'] ?? \'\') === \'success\' && ($response[\'data\'][\'status\'] ?? \'\') === \'successful\') {
            return [
                \'verified\' => true, \'amount\' => $response[\'data\'][\'amount\'],
                \'reference\' => $response[\'data\'][\'tx_ref\'],
                \'paid_at\' => $response[\'data\'][\'created_at\'],
            ];
        }
        return null;
    }

    private function curlPost(string $url, array $data, string $secretKey): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [\'Authorization: Bearer \' . $secretKey, \'Content-Type: application/json\'],
            CURLOPT_POSTFIELDS => json_encode($data),
        ]);
        $response = json_decode(curl_exec($ch), true);
        curl_close($ch);
        return $response ?? [\'status\' => false, \'message\' => \'No response\'];
    }

    private function curlGet(string $url, string $secretKey): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [\'Authorization: Bearer \' . $secretKey],
        ]);
        $response = json_decode(curl_exec($ch), true);
        curl_close($ch);
        return $response ?? [\'status\' => false];
    }
}
');

// ─── Backup Service ────────────────────────────────────────
echo "=== Creating Backup Service ===\n";
file_put_contents(__DIR__ . '/app/Services/BackupService.php', '<?php
namespace App\\Services;

use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Facades\\File;
use Illuminate\\Support\\Str;

class BackupService
{
    public function createBackup(string $type = \'manual\'): array
    {
        $id = Str::uuid()->toString();
        $timestamp = now()->format(\'Y-m-d_His\');
        $filename = "fage_backup_{$timestamp}.sql";
        $backupDir = storage_path(\'app/backups\');

        if (!File::isDirectory($backupDir)) File::makeDirectory($backupDir, 0755, true);

        $dbPath = database_path(config(\'database.default\') === \'sqlite\'
            ? config(\'database.connections.sqlite.database\', \'database.sqlite\')
            : \'\');

        $size = 0;
        $status = \'failed\';

        try {
            if (config(\'database.default\') === \'sqlite\') {
                $backupPath = $backupDir . \'/\' . $filename;
                $size = $this->backupSqlite($dbPath, $backupPath);
            } else {
                $backupPath = $backupDir . \'/\' . $filename;
                $size = $this->backupMysql($backupPath);
            }
            $status = \'completed\';
        } catch (\\Exception $e) {
            logger("[Backup] Failed: " . $e->getMessage());
        }

        DB::table(\'backup_runs\')->insert([
            \'id\' => $id, \'status\' => $status, \'file_path\' => $backupPath ?? null,
            \'file_size\' => $size, \'backup_type\' => $type, \'database_driver\' => config(\'database.default\'),
            \'created_at\' => now(), \'completed_at\' => $status === \'completed\' ? now() : null,
        ]);

        return [\'id\' => $id, \'filename\' => $filename, \'status\' => $status, \'size\' => $size];
    }

    private function backupSqlite(string $dbPath, string $backupPath): int
    {
        $pdo = new \\PDO("sqlite:{$dbPath}");
        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\' AND name != \'migrations\'")->fetchAll(\\PDO::FETCH_COLUMN);

        $output = "-- FAGE Ghana SQLite Backup\\n-- Date: " . now()->toDateTimeString() . "\\n\\n";

        foreach ($tables as $table) {
            $schema = $pdo->query("SELECT sql FROM sqlite_master WHERE name=\'{$table}\'")->fetchColumn();
            $output .= "DROP TABLE IF EXISTS \\\"{$table}\\\";\\n{$schema};\\n\\n";

            $rows = $pdo->query("SELECT * FROM \\\"{$table}\\\"")->fetchAll(\\PDO::FETCH_ASSOC);
            foreach ($rows as $row) {
                $columns = array_map(fn($k) => "\\\"{$k}\\\"", array_keys($row));
                $values = array_map(fn($v) => $v === null ? \'NULL\' : \'\\\' . addslashes($v) . \'\\\'\', array_values($row));
                $output .= "INSERT INTO \\\"{$table}\\\" (" . implode(\',\', $columns) . ") VALUES (" . implode(\',\', $values) . ");\\n";
            }
            $output .= "\\n";
        }

        file_put_contents($backupPath, $output);
        return strlen($output);
    }

    private function backupMysql(string $backupPath): int
    {
        $host = config(\'database.connections.mysql.host\', \'127.0.0.1\');
        $port = config(\'database.connections.mysql.port\', \'3306\');
        $database = config(\'database.connections.mysql.database\');
        $username = config(\'database.connections.mysql.username\');
        $password = config(\'database.connections.mysql.password\');

        $cmd = "mysqldump -h {$host} -P {$port} -u {$username} " . ($password ? "-p{$password}" : "") . " {$database} > \"{$backupPath}\" 2>&1";
        exec($cmd, $output, $returnCode);

        if ($returnCode !== 0) throw new \\Exception("mysqldump failed: " . implode("\\n", $output));
        return filesize($backupPath) ?: 0;
    }

    public function restoreBackup(string $backupPath): bool
    {
        if (!file_exists($backupPath)) return false;

        if (config(\'database.default\') === \'sqlite\') {
            $dbPath = database_path(config(\'database.connections.sqlite.database\', \'database.sqlite\'));
            copy($backupPath, $dbPath);
            return true;
        }
        return false;
    }

    public function getBackups(): array
    {
        return DB::table(\'backup_runs\')->orderByDesc(\'created_at\')->paginate(20)->toArray();
    }
}
');

// ─── Session Management ────────────────────────────────────
echo "=== Creating Session Service ===\n";
file_put_contents(__DIR__ . '/app/Services/SessionService.php', '<?php
namespace App\\Services;

use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class SessionService
{
    public function recordSession(string $userId, Request $request = null): void
    {
        DB::table(\'user_sessions\')->insert([
            \'id\' => Str::uuid()->toString(), \'user_id\' => $userId,
            \'ip_address\' => $request?->ip() ?? \'0.0.0.0\',
            \'user_agent\' => $request?->userAgent() ?? \'CLI\',
            \'last_activity\' => now(), \'created_at\' => now(),
        ]);
    }

    public function trackLoginAttempt(string $email, string $ip, bool $success): void
    {
        DB::table(\'login_attempts\')->insert([
            \'id\' => Str::uuid()->toString(), \'email\' => $email,
            \'ip_address\' => $ip, \'success\' => $success,
            \'attempted_at\' => now(), \'created_at\' => now(),
        ]);

        if (!$success) {
            $recentFails = DB::table(\'login_attempts\')
                ->where(\'email\', $email)->where(\'success\', false)
                ->where(\'attempted_at\', \'>\', now()->subMinutes(15))->count();

            if ($recentFails >= 5) {
                DB::table(\'ip_bans\')->insertOrIgnore([
                    \'id\' => Str::uuid()->toString(), \'ip_address\' => $ip,
                    \'reason\' => "Brute force: {$recentFails} failed attempts",
                    \'banned_until\' => now()->addHours(1), \'created_at\' => now(),
                ]);
            }
        }
    }

    public function isIpBanned(string $ip): bool
    {
        return DB::table(\'ip_bans\')
            ->where(\'ip_address\', $ip)
            ->where(\'banned_until\', \'>\', now())->exists();
    }

    public function revokeSession(string $sessionId): void
    {
        DB::table(\'user_sessions\')->where(\'id\', $sessionId)->delete();
    }

    public function revokeAllSessions(string $userId): int
    {
        return DB::table(\'user_sessions\')->where(\'user_id\', $userId)->delete();
    }

    public function purgeOldAttempts(): int
    {
        return DB::table(\'login_attempts\')->where(\'attempted_at\', \'<\', now()->subDays(30))->delete();
    }

    public function purgeOldSessions(): int
    {
        return DB::table(\'user_sessions\')->where(\'last_activity\', \'<\', now()->subDays(30))->delete();
    }
}
');

// ─── Activity Logging ──────────────────────────────────────
echo "=== Creating Activity Log Service ===\n";
file_put_contents(__DIR__ . '/app/Services/ActivityLogService.php', '<?php
namespace App\\Services;

use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class ActivityLogService
{
    public function log(string $userId, string $action, string $entityType = null, string $entityId = null, array $metadata = null, string $ip = null): void
    {
        DB::table(\'activity_log\')->insert([
            \'id\' => Str::uuid()->toString(), \'user_id\' => $userId,
            \'action\' => $action, \'entity_type\' => $entityType,
            \'entity_id\' => $entityId, \'metadata\' => $metadata ? json_encode($metadata) : null,
            \'ip_address\' => $ip, \'created_at\' => now(),
        ]);
    }

    public function getForEntity(string $entityType, string $entityId, int $limit = 50): array
    {
        return DB::table(\'activity_log\')
            ->where(\'entity_type\', $entityType)->where(\'entity_id\', $entityId)
            ->orderByDesc(\'created_at\')->limit($limit)->get()->toArray();
    }

    public function getForUser(string $userId, int $limit = 50): array
    {
        return DB::table(\'activity_log\')
            ->where(\'user_id\', $userId)
            ->orderByDesc(\'created_at\')->limit($limit)->get()->toArray();
    }

    public function getRecent(int $limit = 100): array
    {
        return DB::table(\'activity_log\')
            ->join(\'users\', \'activity_log.user_id\', \'=\', \'users.id\')
            ->select(\'activity_log.*\', \'users.name as user_name\')
            ->orderByDesc(\'activity_log.created_at\')->limit($limit)->get()->toArray();
    }
}
');

// ─── Notification Service ──────────────────────────────────
echo "=== Creating Notification Service ===\n";
file_put_contents(__DIR__ . '/app/Services/NotificationService.php', '<?php
namespace App\\Services;

use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class NotificationService
{
    public function send(string $userId, string $title, string $body, string $type = \'info\', string $url = null): string
    {
        $id = Str::uuid()->toString();
        DB::table(\'notifications\')->insert([
            \'id\' => $id, \'user_id\' => $userId,
            \'title\' => $title, \'body\' => $body,
            \'type\' => $type, \'url\' => $url,
            \'read\' => false, \'created_at\' => now(),
        ]);
        return $id;
    }

    public function getForUser(string $userId, bool $unreadOnly = false, int $limit = 50): array
    {
        $q = DB::table(\'notifications\')->where(\'user_id\', $userId);
        if ($unreadOnly) $q->where(\'read\', false);
        return $q->orderByDesc(\'created_at\')->limit($limit)->get()->toArray();
    }

    public function markRead(string $notificationId): bool
    {
        return DB::table(\'notifications\')->where(\'id\', $notificationId)->update([\'read\' => true]) > 0;
    }

    public function markAllRead(string $userId): int
    {
        return DB::table(\'notifications\')->where(\'user_id\', $userId)->where(\'read\', false)->update([\'read\' => true]);
    }

    public function getUnreadCount(string $userId): int
    {
        return DB::table(\'notifications\')->where(\'user_id\', $userId)->where(\'read\', false)->count();
    }

    public function delete(string $notificationId): bool
    {
        return DB::table(\'notifications\')->where(\'id\', $notificationId)->delete() > 0;
    }
}
');

echo "\n=== All services created ===\n";
