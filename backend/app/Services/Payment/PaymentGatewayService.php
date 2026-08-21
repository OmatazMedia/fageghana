<?php
namespace App\Services\Payment;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentGatewayService
{
    public function initialize(string $method, float $amount, string $currency, string $email, string $reference, string $description = null): array
    {
        return match($method) {
            'paystack' => $this->initializePaystack($amount, $currency, $email, $reference, $description),
            'flutterwave' => $this->initializeFlutterwave($amount, $currency, $email, $reference, $description),
            'hubtel' => $this->initializeHubtel($amount, $currency, $email, $reference, $description),
            default => throw new \Exception("Unknown payment method: {$method}"),
        };
    }

    private function gatewaySecret(string $provider): string
    {
        $gateway = DB::table('payment_gateways')->where('provider', $provider)->where('enabled', true)->first();
        if ($gateway) {
            $config = json_decode((string) $gateway->config, true);
            if (is_array($config) && !empty($config['secret_key'])) {
                return $config['secret_key'];
            }
        }
        return config("services.{$provider}.secret", '');
    }

    private function initializePaystack(float $amount, string $currency, string $email, string $reference, string $description): array
    {
        $secretKey = $this->gatewaySecret('paystack');

        $payload = [
            'email' => $email, 'amount' => (int) ($amount * 100), // Paystack uses kobo
            'currency' => $currency, 'reference' => $reference,
            'callback_url' => config('app.url') . '/payments/paystack/callback',
        ];
        if ($description) $payload['metadata'] = ['description' => $description];

        $response = $this->curlPost('https://api.paystack.co/transaction/initialize', $payload, $secretKey);

        return [
            'authorization_url' => $response['data']['authorization_url'] ?? null,
            'access_code' => $response['data']['access_code'] ?? null,
            'reference' => $reference,
            'status' => $response['status'] ?? false,
        ];
    }

    private function initializeFlutterwave(float $amount, string $currency, string $email, string $reference, string $description): array
    {
        $secretKey = $this->gatewaySecret('flutterwave');

        $payload = [
            'tx_ref' => $reference, 'amount' => $amount, 'currency' => $currency,
            'redirect_url' => config('app.url') . '/payments/flutterwave/callback',
            'customer' => ['email' => $email],
            'customizations' => ['title' => 'FAGE Ghana', 'description' => $description ?? 'Payment'],
        ];

        $response = $this->curlPost('https://api.flutterwave.com/v3/payments', $payload, $secretKey);

        return [
            'flutterwave_url' => $response['data']['link'] ?? null,
            'flw_ref' => $response['data']['flw_ref'] ?? $reference,
            'status' => $response['status'] ?? 'error',
        ];
    }

    private function initializeHubtel(float $amount, string $currency, string $email, string $reference, string $description): array
    {
        return [
            'checkout_url' => config('app.url') . '/payments/hubtel/checkout?ref=' . $reference,
            'reference' => $reference,
            'status' => true,
        ];
    }

    public function verifyPaystack(string $reference): ?array
    {
        $secretKey = $this->gatewaySecret('paystack');

        $response = $this->curlGet("https://api.paystack.co/transaction/verify/{$reference}", $secretKey);

        if (($response['status'] ?? false) && ($response['data']['status'] ?? '') === 'success') {
            return [
                'verified' => true, 'amount' => $response['data']['amount'] / 100,
                'reference' => $response['data']['reference'],
                'paid_at' => $response['data']['paid_at'],
            ];
        }
        return null;
    }

    public function verifyFlutterwave(string $transactionId): ?array
    {
        $secretKey = $this->gatewaySecret('flutterwave');

        $response = $this->curlGet("https://api.flutterwave.com/v3/transactions/{$transactionId}/verify", $secretKey);

        if (($response['status'] ?? '') === 'success' && ($response['data']['status'] ?? '') === 'successful') {
            return [
                'verified' => true, 'amount' => $response['data']['amount'],
                'reference' => $response['data']['tx_ref'],
                'paid_at' => $response['data']['created_at'],
            ];
        }
        return null;
    }

    public function verifyHubtel(string $transactionId): ?array
    {
        $secretKey = $this->gatewaySecret('hubtel');
        if (!$secretKey) return null;

        // Hubtel API: GET /merchantaccount/api/merchants/{clientId}/transactions/{transactionId}
        $response = $this->curlGet(
            "https://api.hubtel.com/merchantaccount/api/merchants/{$secretKey}/transactions/{$transactionId}",
            ''
        );

        if (isset($response['ResponseCode']) && $response['ResponseCode'] === '0000') {
            return [
                'verified' => true,
                'amount' => (float) ($response['Amount'] ?? 0),
                'reference' => $response['ClientReference'] ?? $transactionId,
                'paid_at' => $response['TransactionDate'] ?? now()->toDateTimeString(),
            ];
        }
        return null;
    }

    /**
     * Verify webhook signature (Paystack HMAC-SHA512).
     */
    public function verifyPaystackSignature(string $body, string $signature, string $secret): bool
    {
        $expected = hash_hmac('sha512', $body, $secret);
        return hash_equals($expected, $signature);
    }

    /**
     * Verify webhook signature (Flutterwave).
     */
    public function verifyFlutterwaveSignature(string $body, string $signature, string $secret): bool
    {
        $expected = hash_hmac('sha256', $body, $secret);
        return hash_equals($expected, $signature);
    }

    private function curlPost(string $url, array $data, string $secretKey): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $secretKey, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($data),
        ]);
        $response = json_decode(curl_exec($ch), true);
        curl_close($ch);
        return $response ?? ['status' => false, 'message' => 'No response'];
    }

    private function curlGet(string $url, string $secretKey): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $secretKey],
        ]);
        $response = json_decode(curl_exec($ch), true);
        curl_close($ch);
        return $response ?? ['status' => false];
    }
}
