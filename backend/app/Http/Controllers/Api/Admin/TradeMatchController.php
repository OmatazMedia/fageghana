<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TradeMatchController extends Controller
{

    public function match(Request $r, string $id) {
        $r->validate(["member_ids"=>"required|array"]);
        $count=0;
        foreach($r->member_ids as $mid) {
            $exists=DB::table("trade_opportunity_interests")->where("trade_opportunity_id",$id)->where("user_id",$mid)->first();
            if(!$exists) { DB::table("trade_opportunity_interests")->insert(["id"=>Str::uuid()->toString(),"trade_opportunity_id"=>$id,"user_id"=>$mid,"created_at"=>now()]); $count++; }
        }
        return response()->json(["message"=>"$count matched","matched_count"=>$count]);
    }

}
