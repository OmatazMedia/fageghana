<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ContactMessageController extends Controller
{

    public function index(Request $r) { return response()->json(DB::table("contact_messages")->orderByDesc("created_at")->paginate(20)); }
    public function show(Request $r, string $id) {
        $msg = DB::table("contact_messages")->where("id",$id)->first();
        if (!$msg) return response()->json(["message"=>"Not found"], 404);
        return response()->json(["message"=>$msg]);
    }
    public function destroy(Request $r, string $id) { DB::table("contact_messages")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }

}
