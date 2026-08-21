<?php
namespace App\Http\Controllers\Api\Webhook;

use App\Http\Controllers\Controller;
use App\Services\EmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaystackWebhookController extends Controller
{
    public function handle(Request $r)
    {
        // Log the webhook
        $logId = Str::uuid()->toString();
        $body = $r->getContent();
        $signature = $r->header('X-Paystack-Signature', '');

        DB::table('webhook_logs')->insert([
            'id' => $logId,
            'provider' => 'paystack',
            'event_type' => json_decode($body, true)['event'] ?? 'unknown',
            'payload' => substr($body, 0, 10000),
            'status' => 'received',
            'created_at' => now(),
        ]);

        // Verify HMAC signature
        $webhookSecret = config('services.paystack.secret', '');
        if (!$webhookSecret) {
            // Try from payment_gateways table
            $gateway = DB::table('payment_gateways')->where('provider', 'paystack')->first();
            if ($gateway) {
                $config = is_string($gateway->config) ? json_decode($gateway->config, true) : ($gateway->config ?? []);
                $webhookSecret = $config['webhook_secret'] ?? '';
            }
        }

        if ($webhookSecret && $signature) {
            $expected = hash_hmac('sha512', $body, $webhookSecret);
            if (!hash_equals($expected, $signature)) {
                DB::table('webhook_logs')->where('id', $logId)->update([
                    'status' => 'rejected',
                    'error' => 'Invalid signature',
                    'updated_at' => now(),
                ]);
                return response()->json(['status' => 'error', 'message' => 'Invalid signature'], 400);
            }
        }

        $payload = json_decode($body, true);
        $event = $payload['event'] ?? '';
        $data = $payload['data'] ?? [];

        try {
            if ($event === 'charge.success') {
                $ref = $data['reference'] ?? '';
                $amount = ($data['amount'] ?? 0) / 100; // Convert from kobo

                $payment = DB::table('payment_submissions')->where('reference', $ref)->first();

                if ($payment) {
                    DB::table('payment_submissions')->where('reference', $ref)->update([
                        'status' => 'confirmed',
                        'confirmed_at' => now(),
                        'updated_at' => now(),
                    ]);

                    // Send confirmation email
                    if ($payment->user_id) {
                        try {
                            $user = DB::table('users')->where('id', $payment->user_id)->first();
                            if ($user) {
                                app(EmailService::class)->sendPaymentConfirmation($user->email, [
                                    'amount' => $amount,
                                    'reference' => $ref,
                                    'method' => 'paystack',
                                ]);
                            }
                        } catch (\Throwable $e) {
                            logger()->warning('Paystack webhook email failed: ' . $e->getMessage());
                        }
                    }

                    // Log activity
                    DB::table('activity_log')->insert([
                        'id' => Str::uuid()->toString(),
                        'event_type' => 'payment_confirmed',
                        'user_id' => $payment->user_id,
                        'detail' => "Paystack payment {$ref} confirmed ({$amount})",
                        'created_at' => now(),
                    ]);
                }

                DB::table('webhook_logs')->where('id', $logId)->update([
                    'status' => 'processed',
                    'reference' => $ref,
                    'updated_at' => now(),
                ]);
            } elseif ($event === 'charge.failed') {
                $ref = $data['reference'] ?? '';
                DB::table('payment_submissions')->where('reference', $ref)->update([
                    'status' => 'failed',
                    'updated_at' => now(),
                ]);

                DB::table('webhook_logs')->where('id', $logId)->update([
                    'status' => 'processed',
                    'updated_at' => now(),
                ]);
            }
        } catch (\Throwable $e) {
            DB::table('webhook_logs')->where('id', $logId)->update([
                'status' => 'error',
                'error' => $e->getMessage(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['status' => 'ok']);
    }
}
