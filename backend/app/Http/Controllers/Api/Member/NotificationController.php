<?php
namespace App\Http\Controllers\Api\Member;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NotificationController extends Controller
{

    public function index(Request $r) {
        $unreadOnly = $r->input("unread", false);
        $q = DB::table("notifications")->where("user_id",$r->user()->id);
        if ($unreadOnly) $q->where("read", false);
        return response()->json($q->orderByDesc("created_at")->paginate(20));
    }
    public function unreadCount(Request $r) {
        $count = DB::table("notifications")->where("user_id",$r->user()->id)->where("read",false)->count();
        return response()->json(["count"=>$count]);
    }
    public function markRead(Request $r, string $id) {
        DB::table("notifications")->where("id",$id)->update(["read"=>true]);
        return response()->json(["message"=>"Marked as read"]);
    }
    public function markAllRead(Request $r) {
        DB::table("notifications")->where("user_id",$r->user()->id)->update(["read"=>true]);
        return response()->json(["message"=>"All marked as read"]);
    }
    public function destroy(Request $r, string $id) {
        DB::table("notifications")->where("id",$id)->delete();
        return response()->json(["message"=>"Deleted"]);
    }

}
