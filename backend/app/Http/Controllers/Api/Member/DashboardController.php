<?php
namespace App\Http\Controllers\Api\Member;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DashboardController extends Controller
{

    public function index(Request $r) {
        $u=$r->user();
        $payments=DB::table("payment_submissions")->where("user_id",$u->id)->orderByDesc("created_at")->limit(5)->get();
        $tickets=DB::table("support_tickets")->where("user_id",$u->id)->orderByDesc("created_at")->limit(5)->get();
        $profile=DB::table("member_profiles")->where("user_id",$u->id)->first();
        return response()->json(["user"=>["id"=>$u->id,"name"=>$u->name,"email"=>$u->email],"member"=>$profile,"recent_payments"=>$payments,"support_tickets"=>$tickets]);
    }

}
