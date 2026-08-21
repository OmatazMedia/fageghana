<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SupportTicketController extends Controller
{

    public function index(Request $r) {
        $q=DB::table("support_tickets");
        if($s=$r->input("status")) $q->where("status",$s);
        return response()->json($q->orderByDesc("created_at")->paginate(20));
    }
    public function show(Request $r, string $id) {
        $t=DB::table("support_tickets")->where("id",$id)->first();
        if(!$t) return response()->json(["message"=>"Not found"],404);
        $msgs=DB::table("ticket_messages")->where("ticket_id",$id)->orderBy("created_at")->get();
        return response()->json(["ticket"=>$t,"messages"=>$msgs]);
    }
    public function update(Request $r, string $id) { $v=$r->validate(["status"=>"sometimes","priority"=>"sometimes"]); $v["updated_at"]=now(); DB::table("support_tickets")->where("id",$id)->update($v); return response()->json(["message"=>"Updated"]); }
    public function addMessage(Request $r, string $id) {
        $r->validate(["body"=>"required"]);
        DB::table("ticket_messages")->insert(["id"=>Str::uuid()->toString(),"ticket_id"=>$id,"sender_id"=>$r->user()->id,"is_admin"=>true,"body"=>$r->body,"created_at"=>now()]);
        return response()->json(["message"=>"Reply added"]);
    }
    public function assign(Request $r, string $id) { $r->validate(["contact_name"=>"required"]); DB::table("support_tickets")->where("id",$id)->update(["contact_name"=>$r->contact_name,"status"=>"in_progress","updated_at"=>now()]); return response()->json(["message"=>"Assigned"]); }
    public function updateStatus(Request $r, string $id) { $r->validate(["status"=>"required"]); DB::table("support_tickets")->where("id",$id)->update(["status"=>$r->status,"updated_at"=>now()]); return response()->json(["message"=>"Updated"]); }

}
