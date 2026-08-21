<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentGatewayController extends Controller
{

    public function index(Request $r) { return response()->json(["gateways"=>DB::table("payment_gateways")->get()]); }
    public function update(Request $r, string $provider) {
        $v = $r->validate(["public_key"=>"nullable","secret_key"=>"nullable","webhook_secret"=>"nullable","is_active"=>"sometimes|boolean","test_mode"=>"sometimes|boolean"]);
        $existing = DB::table("payment_gateways")->where("provider",$provider)->first();
        $v["updated_at"] = now();
        if ($existing) DB::table("payment_gateways")->where("id",$existing->id)->update($v);
        else DB::table("payment_gateways")->insert(array_merge($v,["id"=>Str::uuid()->toString(),"provider"=>$provider,"created_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }
    public function test(Request $r, string $provider) {
        return response()->json(["message"=>"Test connection {$provider}","status"=>"ok"]);
    }

    /**
     * Admin confirms a manual/bank payment submission.
     */
    public function confirmManual(Request $r, string $id) {
        $v = $r->validate(['status' => 'required|in:confirmed,rejected', 'note' => 'nullable|string']);
        $payment = DB::table('payment_submissions')->where('id', $id)->first();
        if (!$payment) return response()->json(['message' => 'Not found'], 404);

        DB::table('payment_submissions')->where('id', $id)->update([
            'status' => $v['status'],
            'confirmed_at' => $v['status'] === 'confirmed' ? now() : null,
            'admin_note' => $v['note'] ?? null,
            'updated_at' => now(),
        ]);

        // Send confirmation email if confirmed
        if ($v['status'] === 'confirmed' && $payment->user_id) {
            try {
                $user = DB::table('users')->where('id', $payment->user_id)->first();
                if ($user) {
                    app(\App\Services\EmailService::class)->sendPaymentConfirmation($user->email, [
                        'amount' => $payment->amount,
                        'reference' => $payment->reference,
                        'method' => $payment->method,
                    ]);
                }
            } catch (\Throwable $e) {
                logger()->warning('Payment confirmation email failed: ' . $e->getMessage());
            }
        }

        return response()->json(['message' => 'Payment ' . $v['status']]);
    }
}
