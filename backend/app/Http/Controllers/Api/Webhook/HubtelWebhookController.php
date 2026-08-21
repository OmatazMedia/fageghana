<?php
namespace App\Http\Controllers\Api\Webhook;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class HubtelWebhookController extends Controller
{

    public function handle(Request $r) {
        $payload=$r->all();
        $status=$payload["Status"]??"";
        $ref=$payload["ClientReference"]??$payload["TransactionId"]??"";
        if($status==="Success"||$status==="Completed") {
            DB::table("payment_submissions")->where("reference",$ref)->update(["status"=>"confirmed","confirmed_at"=>now(),"updated_at"=>now()]);
        }
        return response()->json(["status"=>"ok"]);
    }

}
