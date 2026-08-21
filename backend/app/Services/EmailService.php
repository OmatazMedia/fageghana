<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class EmailService
{
    public function send(string $to, string $subject, string $templateKey, array $data = [], string $from = null): bool
    {
        $settings = DB::table('email_settings')->where('singleton', true)->first();
        $template = DB::table('email_templates')->where('key', $templateKey)->orWhere('id', $templateKey)->first();

        $fromAddress = $from ?? $settings->smtp_from ?? $settings->resend_from ?? config('mail.from.address');
        $fromName = config('mail.from.name', 'FAGE Ghana');

        // Build HTML from template blocks
        $html = $this->renderTemplate($template, $data);

        // Log the email
        $logId = Str::uuid()->toString();
        DB::table('email_log')->insert([
            'id' => $logId, 'to_email' => $to,
            'subject' => $subject, 'status' => 'queued',
            'provider' => $settings->primary_provider ?? 'log',
            'template_key' => $templateKey, 'created_at' => now(),
        ]);

        try {
            switch ($settings->primary_provider ?? 'log') {
                case 'smtp':
                    // Laravel mailer handles SMTP via config
                    $this->sendViaSmtp($to, $subject, $html, $fromAddress, $fromName, $settings);
                    break;
                case 'resend':
                    $this->sendViaResend($to, $subject, $html, $fromAddress, $settings);
                    break;
                case 'log':
                default:
                    logger("[Email] To: {$to} | Subject: {$subject}");
                    break;
            }

            DB::table('email_log')->where('id', $logId)->update(['status' => 'sent']);
            return true;
        } catch (\Exception $e) {
            DB::table('email_log')->where('id', $logId)->update(['status' => 'failed', 'error' => $e->getMessage()]);
            return false;
        }
    }

    private function sendViaSmtp(string $to, string $subject, string $html, string $from, string $fromName, $settings): void
    {
        $headers = "From: {$fromName} <{$from}>\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $headers .= "X-Mailer: FAGE-Ghana/1.0\r\n";

        if (function_exists('mail')) {
            mail($to, $subject, $html, $headers);
        } else {
            logger("[Email-SMTP] To: {$to} | Subject: {$subject} | Body length: " . strlen($html));
        }
    }

    private function sendViaResend(string $to, string $subject, string $html, string $from, $settings): void
    {
        $apiKey = $settings->resend_api_key;
        if (!$apiKey) throw new \Exception('Resend API key not configured');

        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode(['from' => $from, 'to' => [$to], 'subject' => $subject, 'html' => $html]),
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) throw new \Exception("Resend API error: {$response}");
    }

    private function renderTemplate($template, array $data): string
    {
        $html = "<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;}</style></head><body>";

        if ($template && $template->blocks) {
            $blocks = is_string($template->blocks) ? json_decode($template->blocks, true) : $template->blocks;
            foreach ($blocks as $block) {
                switch ($block['type'] ?? 'text') {
                    case 'heading': $html .= "<h1>" . e($block['text'] ?? '') . "</h1>"; break;
                    case 'text': $html .= "<p>" . e($block['text'] ?? '') . "</p>"; break;
                    case 'button': $html .= "<p><a href='" . e($block['url'] ?? '#') . "' style='background:#1a5632;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;'>" . e($block['text'] ?? 'Click') . "</a></p>"; break;
                    default: $html .= "<p>" . e($block['text'] ?? '') . "</p>";
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
        $url = config('app.url') . '/reset-password?token=' . $token . '&email=' . urlencode($email);
        return $this->send($email, 'Password Reset Request', 'password_reset', [
            'reset_url' => $url, 'expires' => '60 minutes',
        ]);
    }

    public function sendMfaCode(string $email, string $code): bool
    {
        return $this->send($email, 'Your Verification Code', 'mfa_code', [
            'code' => $code, 'expires' => '5 minutes',
        ]);
    }

    public function sendPaymentConfirmation(string $email, array $payment): bool
    {
        return $this->send($email, 'Payment Confirmation', 'payment_confirmation', [
            'amount' => number_format($payment['amount'], 2),
            'reference' => $payment['reference'] ?? '',
            'provider' => ucfirst($payment['method'] ?? $payment['provider'] ?? ''),
        ]);
    }

    public function sendApplicationStatus(string $email, string $status, string $applicationId): bool
    {
        return $this->send($email, 'Application Status Update', 'application_status', [
            'status' => ucfirst($status), 'application_id' => $applicationId,
        ]);
    }
}
