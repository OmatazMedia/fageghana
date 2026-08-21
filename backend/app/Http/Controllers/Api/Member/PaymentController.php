<?php
namespace App\Http\Controllers\Api\Member;
use App\Http\Controllers\Controller;
use App\Services\Payment\PaymentGatewayService;
use App\Services\PdfService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentController extends Controller
{

    public function index(Request $r) { return response()->json(DB::table("payment_submissions")->where("user_id",$r->user()->id)->orderByDesc("created_at")->paginate(20)); }
    public function show(Request $r, string $id) { $p=DB::table("payment_submissions")->where("id",$id)->where("user_id",$r->user()->id)->first(); if(!$p) return response()->json(["message"=>"Not found"],404); return response()->json(["payment"=>$p]); }
    public function initialize(Request $r) {
        $v=$r->validate(["amount"=>"required|numeric|min:1","method"=>"required|in:paystack,flutterwave,hubtel","kind"=>"nullable"]);
        return $this->gatewayInit($r, $v["method"], $v["amount"], $v["kind"] ?? null, $r->user()->id);
    }
    public function initializePublic(Request $r) {
        $v=$r->validate(["amount"=>"required|numeric|min:1","currency"=>"nullable|string|max:8","email"=>"required|email","description"=>"nullable|string"]);
        return $this->gatewayInit($r, "paystack", $v["amount"], null, null, strtoupper($v["currency"] ?? "GHS"), $v["email"], $v["description"] ?? null);
    }
    public function initializePublicFw(Request $r) {
        $v=$r->validate(["amount"=>"required|numeric|min:1","currency"=>"nullable|string|max:8","email"=>"required|email","description"=>"nullable|string"]);
        return $this->gatewayInit($r, "flutterwave", $v["amount"], null, null, strtoupper($v["currency"] ?? "GHS"), $v["email"], $v["description"] ?? null);
    }
    public function initializePublicHt(Request $r) {
        $v=$r->validate(["amount"=>"required|numeric|min:1","currency"=>"nullable|string|max:8","email"=>"required|email","description"=>"nullable|string"]);
        return $this->gatewayInit($r, "hubtel", $v["amount"], null, null, strtoupper($v["currency"] ?? "GHS"), $v["email"], $v["description"] ?? null);
    }

    public function verify(Request $r) {
        $v=$r->validate(["reference"=>"required|string","provider"=>"required|in:paystack,flutterwave,hubtel"]);
        $service = app(PaymentGatewayService::class);
        $result = match($v["provider"]) {
            'paystack' => $service->verifyPaystack($v["reference"]),
            'flutterwave' => $service->verifyFlutterwave($v["reference"]),
            'hubtel' => $service->verifyHubtel($v["reference"]),
            default => null,
        };

        $status = "pending";
        if ($result && ($result["verified"] ?? false)) {
            $status = "confirmed";
            DB::table("payment_submissions")->where("reference", $v["reference"])->update([
                "status" => "confirmed", "confirmed_at" => now(), "updated_at" => now(),
            ]);

            // Send payment confirmation email
            try {
                $user = DB::table("users")->where("id", $r->user()->id)->first();
                if ($user) {
                    app(\App\Services\EmailService::class)->sendPaymentConfirmation($user->email, [
                        'amount' => $result['amount'] ?? 0,
                        'reference' => $v['reference'],
                        'method' => $v['provider'],
                    ]);
                }
            } catch (\Throwable $e) {
                logger()->warning('Payment confirmation email failed: ' . $e->getMessage());
            }
        }
        return response()->json(["status" => $status, "data" => $result]);
    }

    /**
     * Submit a manual/bank payment for review.
     */
    public function storeManual(Request $r) {
        $v = $r->validate([
            'amount' => 'required|numeric|min:1',
            'method' => 'required|string',
            'reference' => 'nullable|string',
            'description' => 'nullable|string',
            'proof_file' => 'nullable|string',
        ]);

        $id = Str::uuid()->toString();
        DB::table('payment_submissions')->insert([
            'id' => $id,
            'user_id' => $r->user()->id,
            'method' => $v['method'],
            'amount' => $v['amount'],
            'currency' => 'GHS',
            'status' => 'pending',
            'reference' => $v['reference'] ?? 'MANUAL-' . Str::upper(Str::random(10)),
            'kind' => 'manual',
            'member_message' => $v['description'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Payment submitted for review', 'payment_id' => $id], 201);
    }

    /**
     * Generate a receipt/invoice for a confirmed payment.
     */
    public function receipt(Request $r, string $id) {
        $payment = DB::table('payment_submissions')
            ->where('id', $id)
            ->where('user_id', $r->user()->id)
            ->first();

        if (!$payment) return response()->json(['message' => 'Not found'], 404);
        if ($payment->status !== 'confirmed') return response()->json(['message' => 'Payment not confirmed yet'], 422);

        $user = DB::table('users')->where('id', $r->user()->id)->first();

        $receipt = [
            'invoice_no' => 'FAGE-' . strtoupper(substr($payment->reference, -12)),
            'date' => $payment->confirmed_at ?? $payment->created_at,
            'member_name' => $user->name ?? '',
            'member_email' => $user->email ?? '',
            'amount' => number_format($payment->amount, 2),
            'currency' => $payment->currency ?? 'GHS',
            'method' => ucfirst($payment->method ?? ''),
            'reference' => $payment->reference,
            'status' => ucfirst($payment->status),
            'items' => [
                ['description' => ucfirst($payment->kind ?? 'membership') . ' payment', 'amount' => number_format($payment->amount, 2)],
            ],
            'total' => number_format($payment->amount, 2),
            'organization' => [
                'name' => config('app.name', 'FAGE Ghana'),
                'tagline' => 'Federation of Association of Ghana Exporters',
            ],
        ];

        return response()->json(['receipt' => $receipt]);
    }

    /**
     * Generate HTML invoice for a confirmed payment.
     */
    public function invoice(Request $r, string $id) {
        $payment = DB::table('payment_submissions')
            ->where('id', $id)
            ->where('user_id', $r->user()->id)
            ->first();

        if (!$payment) return response()->json(['message' => 'Not found'], 404);
        if ($payment->status !== 'confirmed') return response()->json(['message' => 'Payment not confirmed yet'], 422);

        $user = DB::table('users')->where('id', $r->user()->id)->first();
        $invoiceNo = 'FAGE-' . strtoupper(substr($payment->reference, -12));

        $html = '<!DOCTYPE html><html><head><style>';
        $html .= 'body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#333;}';
        $html .= '.header{text-align:center;border-bottom:3px solid #1a5632;padding-bottom:20px;margin-bottom:20px;}';
        $html .= '.header h1{color:#1a5632;margin:0;}';
        $html .= '.header p{color:#666;margin:5px 0 0;}';
        $html .= '.meta{display:flex;justify-content:space-between;margin-bottom:20px;}';
        $html .= 'table{width:100%;border-collapse:collapse;margin:20px 0;}';
        $html .= 'th,td{padding:10px 12px;border:1px solid #ddd;text-align:left;}';
        $html .= 'th{background:#1a5632;color:white;}';
        $html .= '.total{font-size:1.2em;font-weight:bold;text-align:right;margin:20px 0;}';
        $html .= '.footer{text-align:center;color:#999;font-size:0.85em;margin-top:40px;border-top:1px solid #eee;padding-top:15px;}';
        $html .= '</style></head><body>';

        $html .= '<div class="header"><h1>FAGE Ghana</h1><p>Federation of Association of Ghana Exporters</p></div>';
        $html .= '<div class="meta">';
        $html .= '<div><strong>Invoice:</strong> ' . e($invoiceNo) . '<br><strong>Date:</strong> ' . e($payment->confirmed_at ?? $payment->created_at) . '</div>';
        $html .= '<div><strong>Bill To:</strong><br>' . e($user->name ?? '') . '<br>' . e($user->email ?? '') . '</div>';
        $html .= '</div>';

        $html .= '<table><thead><tr><th>Description</th><th>Amount (' . e($payment->currency ?? 'GHS') . ')</th></tr></thead><tbody>';
        $html .= '<tr><td>' . e(ucfirst($payment->kind ?? 'membership') . ' payment') . '</td><td>' . e(number_format($payment->amount, 2)) . '</td></tr>';
        $html .= '</tbody></table>';

        $html .= '<div class="total">Total: ' . e($payment->currency ?? 'GHS') . ' ' . e(number_format($payment->amount, 2)) . '</div>';
        $html .= '<p><strong>Payment Method:</strong> ' . e(ucfirst($payment->method ?? '')) . '</p>';
        $html .= '<p><strong>Reference:</strong> ' . e($payment->reference) . '</p>';

        $html .= '<div class="footer">' . e(config('app.name', 'FAGE Ghana')) . ' — Federation of Association of Ghana Exporters</div>';
        $html .= '</body></html>';

        return response($html)->header('Content-Type', 'text/html');
    }

    /**
     * Generate PDF invoice for a confirmed payment.
     */
    public function invoicePdf(Request $r, string $id)
    {
        $payment = DB::table('payment_submissions')
            ->where('id', $id)
            ->where('user_id', $r->user()->id)
            ->first();

        if (!$payment) return response()->json(['message' => 'Not found'], 404);
        if ($payment->status !== 'confirmed') return response()->json(['message' => 'Payment not confirmed yet'], 422);

        $user = DB::table('users')->where('id', $r->user()->id)->first();
        $invoiceNo = 'FAGE-' . strtoupper(substr($payment->reference, -12));

        $pdf = new PdfService();
        $pdf->addPage();

        // Header
        $pdf->rect(0, 0, 595, 100, ['fill' => [26, 86, 50]]);
        $pdf->text(200, 30, 'FAGE GHANA', ['size' => 24, 'bold' => true, 'color' => [255, 255, 255]]);
        $pdf->text(165, 55, 'Federation of Association of Ghana Exporters', ['size' => 10, 'color' => [220, 220, 220]]);

        // Invoice title
        $pdf->text(50, 120, 'INVOICE', ['size' => 20, 'bold' => true, 'color' => [26, 86, 50]]);

        // Invoice details
        $pdf->text(50, 150, "Invoice No: {$invoiceNo}", ['size' => 10]);
        $pdf->text(50, 165, "Date: " . ($payment->confirmed_at ?? $payment->created_at), ['size' => 10]);
        $pdf->text(50, 180, "Status: Confirmed", ['size' => 10, 'color' => [26, 140, 50]]);

        // Bill to
        $pdf->text(350, 150, 'Bill To:', ['size' => 10, 'bold' => true]);
        $pdf->text(350, 165, $user->name ?? '', ['size' => 10]);
        $pdf->text(350, 180, $user->email ?? '', ['size' => 10]);

        // Table header
        $y = 220;
        $pdf->rect(50, $y, 495, 25, ['fill' => [26, 86, 50]]);
        $pdf->text(55, $y + 8, 'Description', ['size' => 10, 'bold' => true, 'color' => [255, 255, 255]]);
        $pdf->text(400, $y + 8, 'Amount', ['size' => 10, 'bold' => true, 'color' => [255, 255, 255]]);

        // Table row
        $y += 35;
        $pdf->line(50, $y - 5, 545, $y - 5, ['color' => [200, 200, 200]]);
        $pdf->text(55, $y, ucfirst($payment->kind ?? 'membership') . ' payment', ['size' => 10]);
        $pdf->text(400, $y, ($payment->currency ?? 'GHS') . ' ' . number_format($payment->amount, 2), ['size' => 10]);

        // Total
        $y += 30;
        $pdf->line(350, $y - 5, 545, $y - 5, ['color' => [26, 86, 50], 'width' => 1.5]);
        $pdf->text(350, $y + 5, 'Total:', ['size' => 12, 'bold' => true]);
        $pdf->text(400, $y + 5, ($payment->currency ?? 'GHS') . ' ' . number_format($payment->amount, 2), ['size' => 12, 'bold' => true, 'color' => [26, 86, 50]]);

        // Payment details
        $y += 50;
        $pdf->text(50, $y, 'Payment Method: ' . ucfirst($payment->method ?? ''), ['size' => 10]);
        $pdf->text(50, $y + 15, 'Reference: ' . $payment->reference, ['size' => 10]);

        // Footer
        $pdf->rect(0, 780, 595, 62, ['fill' => [245, 245, 245]]);
        $pdf->text(180, 800, config('app.name', 'FAGE Ghana'), ['size' => 10, 'color' => [100, 100, 100]]);
        $pdf->text(165, 815, 'Federation of Association of Ghana Exporters', ['size' => 8, 'color' => [150, 150, 150]]);

        $pdfContent = $pdf->render();

        return response($pdfContent)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'attachment; filename="invoice-' . $invoiceNo . '.pdf"');
    }

    private function gatewayInit(Request $r, string $method, float $amount, ?string $kind, ?string $userId = null, string $currency = "GHS", ?string $email = null, ?string $description = null) {
        $gateway = DB::table("payment_gateways")->where("provider", $method)->first();
        if (!$gateway || !$gateway->enabled) {
            return response()->json(["message" => "{$method} gateway is not enabled"], 422);
        }

        $reference = "FAGE-" . Str::upper(Str::random(12));

        $service = app(PaymentGatewayService::class);
        try {
            $result = $service->initialize($method, $amount, $currency, $email ?? $r->user()?->email ?? "", $reference, $description);
        } catch (\Throwable $e) {
            return response()->json(["message" => "Gateway initialization failed: " . $e->getMessage()], 502);
        }

        $id = Str::uuid()->toString();
        DB::table("payment_submissions")->insert([
            "id" => $id,
            "user_id" => $userId ?? $r->user()?->id,
            "method" => $method,
            "amount" => $amount,
            "currency" => $currency,
            "status" => "pending",
            "reference" => $reference,
            "kind" => $kind ?? "new",
            "created_at" => now(),
            "updated_at" => now(),
        ]);

        return response()->json(array_merge([
            "payment_id" => $id,
            "reference" => $reference,
            "amount" => $amount,
            "method" => $method,
        ], $result));
    }

}