<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentController extends Controller
{

    public function index(Request $r) {
        $q = DB::table("payment_submissions")->orderByDesc("created_at");
        if($r->input("status")) $q->where("status",$r->status);
        if($r->input("kind")) $q->where("kind",$r->kind);
        return response()->json($q->paginate(20));
    }
    public function show(Request $r, string $id) {
        $p = DB::table("payment_submissions")->where("id",$id)->first();
        if(!$p) return response()->json(["message"=>"Not found"],404);
        return response()->json(["payment"=>$p]);
    }
    public function updateStatus(Request $r, string $id) {
        $r->validate(["status"=>"required"]);
        $extra = $r->status==="confirmed" ? ["confirmed_by"=>$r->user()->id,"confirmed_at"=>now()] : [];
        DB::table("payment_submissions")->where("id",$id)->update(array_merge(["status"=>$r->status,"updated_at"=>now()], $extra));
        return response()->json(["message"=>"Status updated"]);
    }
    public function stats(Request $r) {
        $total = DB::table("payment_submissions")->sum("amount");
        $confirmed = DB::table("payment_submissions")->where("status","confirmed")->sum("amount");
        $pending = DB::table("payment_submissions")->where("status","pending")->sum("amount");
        $byKind = DB::table("payment_submissions")->select("kind",DB::raw("count(*) as count"),DB::raw("sum(amount) as total"))->groupBy("kind")->get();
        return response()->json(["total_amount"=>$total,"confirmed_amount"=>$confirmed,"pending_amount"=>$pending,"by_kind"=>$byKind]);
    }

}
