<?php
namespace App\Http\Controllers\Api\Member;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TradeController extends Controller
{

    public function index(Request $r) { return response()->json(DB::table("trade_opportunities")->where("is_active",true)->orderByDesc("posted_at")->paginate(20)); }
    public function show(Request $r, string $id) { $t=DB::table("trade_opportunities")->where("id",$id)->first(); if(!$t) return response()->json(["message"=>"Not found"],404); return response()->json(["trade_opportunity"=>$t]); }

    public function interest(Request $r, string $id) {
        $t=DB::table("trade_opportunities")->where("id",$id)->first();
        if(!$t) return response()->json(["message"=>"Not found"],404);

        $exists=DB::table("trade_opportunity_interests")
            ->where("trade_opportunity_id",$id)
            ->where("user_id",$r->user()->id)->first();
        if($exists) return response()->json(["message"=>"Already expressed interest"]); 

        DB::table("trade_opportunity_interests")->insert([
            "id"=>\Illuminate\Support\Str::uuid()->toString(),
            "trade_opportunity_id"=>$id,
            "user_id"=>$r->user()->id,
            "created_at"=>now(),
        ]);

        // Notify admin
        try {
            $user=DB::table("users")->where("id",$r->user()->id)->first();
            DB::table("notifications")->insert([
                "id"=>\Illuminate\Support\Str::uuid()->toString(),
                "user_id"=>null,
                "type"=>"trade_interest",
                "title"=>"New Trade Interest",
                "message"=>($user->name ?? "A member") . " expressed interest in: " . $t->title,
                "data"=>json_encode(["trade_id"=>$id,"user_id"=>$r->user()->id]),
                "created_at"=>now(),
            ]);
        } catch(\Throwable $e) { logger()->warning("Trade interest notification failed: ".$e->getMessage()); }

        return response()->json(["message"=>"Interest recorded"]); 
    }
}
