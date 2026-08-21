<?php
namespace App\Http\Controllers\Api\Member;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SupportTicketController extends Controller
{

    public function index(Request $r) { return response()->json(DB::table("support_tickets")->where("user_id",$r->user()->id)->orderByDesc("created_at")->paginate(20)); }
    public function store(Request $r) {
        $v=$r->validate(["subject"=>"required","message"=>"required","priority"=>"nullable"]);
        $id=Str::uuid()->toString();
        DB::table("support_tickets")->insert(["id"=>$id,"user_id"=>$r->user()->id,"subject"=>$v["subject"],"message"=>$v["message"],"priority"=>$v["priority"]??"medium","status"=>"open","source"=>"member","contact_name"=>$r->user()->name,"contact_email"=>$r->user()->email,"created_at"=>now(),"updated_at"=>now()]);
        DB::table("ticket_messages")->insert(["id"=>Str::uuid()->toString(),"ticket_id"=>$id,"sender_id"=>$r->user()->id,"is_admin"=>false,"body"=>$v["message"],"created_at"=>now()]);
        return response()->json(["message"=>"Created","id"=>$id],201);
    }
    public function show(Request $r, string $id) {
        $t=DB::table("support_tickets")->where("id",$id)->where("user_id",$r->user()->id)->first();
        if(!$t) return response()->json(["message"=>"Not found"],404);
        $msgs=DB::table("ticket_messages")->where("ticket_id",$id)->orderBy("created_at")->get();
        return response()->json(["ticket"=>$t,"messages"=>$msgs]);
    }
    public function addMessage(Request $r, string $id) {
        $r->validate(["body"=>"required"]);
        DB::table("ticket_messages")->insert(["id"=>Str::uuid()->toString(),"ticket_id"=>$id,"sender_id"=>$r->user()->id,"is_admin"=>false,"body"=>$r->body,"created_at"=>now()]);
        return response()->json(["message"=>"Reply added"]);
    }

}
