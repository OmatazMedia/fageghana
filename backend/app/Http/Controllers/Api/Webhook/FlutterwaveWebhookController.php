<?php
namespace App\Http\Controllers\Api\Webhook;

use App\Http\Controllers\Controller;
use App\Services\EmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FlutterwaveWebhookController extends Controller
{
    public function handle(Request $r)
    {
        $logId = Str::uuid()->toString();
        $body = $r->getContent();
        $signature = $r->header('Flutterwave-Hash', '');

        DB::table('webhook_logs')->insert([
            'id' => $logId,
            'provider' => 'flutterwave',
            'event_type' => json_decode($body, true)['event'] ?? 'unknown',
            'payload' => substr($body, 0, 10000),
            'status' => 'received',
            'created_at' => now(),
        ]);

        // Verify hash signature
        $webhookSecret = config('services.flutterwave.secret', '');
        if (!$webhookSecret) {
            $gateway = DB::table('payment_gateways')->where('provider', 'flutterwave')->first();
            if ($gateway) {
                $config = is_string($gateway->config) ? json_decode($gateway->config, true) : ($gateway->config ?? []);
                $webhookSecret = $config['webhook_secret'] ?? '';
            }
        }

        if ($webhookSecret && $signature) {
            $expected = hash_hmac('sha256', $body, $webhookSecret);
            if (!hash_equals($expected, $signature)) {
                DB::table('webhook_logs')->where('id', $logId)->update([
                    'status' => 'rejected',
                    'error' => 'Invalid hash',
                    'updated_at' => now(),
                ]);
                return response()->json(['status' => 'error', 'message' => 'Invalid hash'], 400);
            }
        }

        $payload = json_decode($body, true);
        $event = $payload['event'] ?? '';
        $data = $payload['data'] ?? [];

        try {
            if ($event === 'charge.completed') {
                $ref = $data['tx_ref'] ?? '';
                $amount = $data['amount'] ?? 0;

                $payment = DB::table('payment_submissions')->where('reference', $ref)->first();

                if ($payment) {
                    DB::table('payment_submissions')->where('reference', $ref)->update([
                        'status' => 'confirmed',
                        'confirmed_at' => now(),
                        'updated_at' => now(),
                    ]);

                    if ($payment->user_id) {
                        try {
                            $user = DB::table('users')->where('id', $payment->user_id)->first();
                            if ($user) {
                                app(EmailService::class)->sendPaymentConfirmation($user->email, [
                                    'amount' => $amount,
                                    'reference' => $ref,
                                    'method' => 'flutterwave',
                                ]);
                            }
                        } catch (\Throwable $e) {
                            logger()->warning('Flutterwave webhook email failed: ' . $e->getMessage());
                        }
                    }

                    DB::table('activity_log')->insert([
                        'id' => Str::uuid()->toString(),
                        'event_type' => 'payment_confirmed',
                        'user_id' => $payment->user_id,
                        'detail' => "Flutterwave payment {$ref} confirmed ({$amount})",
                        'created_at' => now(),
                    ]);
                }

                DB::table('webhook_logs')->where('id', $logId)->update([
                    'status' => 'processed',
                    'reference' => $ref,
                    'updated_at' => now(),
                ]);
            } elseif ($event === 'charge.failed') {
                $ref = $data['tx_ref'] ?? '';
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
