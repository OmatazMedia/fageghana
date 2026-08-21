<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DirectoryApprovalController extends Controller
{

    public function pending(Request $r) {
        return response()->json(DB::table("directory_entries")->where("status","pending_review")->orderByDesc("submitted_at")->paginate(20));
    }
    public function approve(Request $r, string $id) {
        DB::table("directory_entries")->where("id",$id)->update(["status"=>"approved","is_active"=>true,"reviewed_by"=>$r->user()->id,"reviewed_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Approved"]);
    }
    public function reject(Request $r, string $id) {
        $r->validate(["review_notes"=>"nullable|string"]);
        DB::table("directory_entries")->where("id",$id)->update(["status"=>"rejected","reviewed_by"=>$r->user()->id,"reviewed_at"=>now(),"review_notes"=>$r->input("review_notes"),"updated_at"=>now()]);
        return response()->json(["message"=>"Rejected"]);
    }

}
