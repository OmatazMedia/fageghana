<?php
namespace App\Http\Controllers\Api\Public;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SubscriberController extends Controller
{

    public function subscribe(Request $r) {
        $r->validate(["email"=>"required|email"]);
        $exists=DB::table("contact_messages")->where("email",$r->email)->first();
        if(!$exists) DB::table("contact_messages")->insert(["id"=>Str::uuid()->toString(),"email"=>$r->email,"created_at"=>now()]);
        return response()->json(["message"=>"Subscribed"]);
    }
    public function unsubscribe(Request $r) { return response()->json(["message"=>"Unsubscribed"]); }

}
