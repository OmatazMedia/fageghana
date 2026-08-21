<?php
namespace App\Http\Controllers\Api\Member;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DirectoryController extends Controller
{

    public function myListing(Request $r) {
        $l=DB::table("directory_entries")->where("user_id",$r->user()->id)->first();
        return response()->json(["listing"=>$l]);
    }
    public function createListing(Request $r) {
        $v=$r->validate(["company_name"=>"required","short_description"=>"required","category"=>"nullable","website"=>"nullable","phone"=>"nullable","country"=>"nullable","region"=>"nullable"]);
        $id=Str::uuid()->toString();
        DB::table("directory_entries")->insert(["id"=>$id,"slug"=>Str::slug($v["company_name"]),"company_name"=>$v["company_name"],"short_description"=>$v["short_description"],"category"=>$v["category"]??null,"website"=>$v["website"]??null,"phone"=>$v["phone"]??null,"country"=>$v["country"]??null,"region"=>$v["region"]??null,"user_id"=>$r->user()->id,"status"=>"pending_review","submitted_at"=>now(),"created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Submitted for approval","id"=>$id],201);
    }
    public function updateListing(Request $r) {
        $v=$r->validate(["company_name"=>"sometimes","short_description"=>"sometimes","category"=>"nullable","website"=>"nullable","phone"=>"nullable"]);
        $v["status"]="pending_review"; $v["updated_at"]=now();
        DB::table("directory_entries")->where("user_id",$r->user()->id)->update($v);
        return response()->json(["message"=>"Updated and resubmitted"]);
    }

}
