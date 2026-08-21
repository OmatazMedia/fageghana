<?php
namespace App\Http\Controllers\Api\Member;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ApplicationController extends Controller
{

    public function index(Request $r) { return response()->json(["applications"=>DB::table("pending_applications")->where("user_id",$r->user()->id)->orderByDesc("created_at")->get()]); }
    public function store(Request $r) {
        $v=$r->validate(["contact_name"=>"required","company_name"=>"required","email"=>"required|email","phone"=>"nullable","industry"=>"nullable","tier"=>"required"]);
        $id=Str::uuid()->toString();
        DB::table("pending_applications")->insert(["id"=>$id,"user_id"=>$r->user()->id,"contact_name"=>$v["contact_name"],"company_name"=>$v["company_name"],"email"=>$v["email"],"phone"=>$v["phone"]??null,"industry"=>$v["industry"]??null,"tier"=>$v["tier"],"status"=>"pending","created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Submitted","id"=>$id],201);
    }
    public function show(Request $r, string $id) { $a=DB::table("pending_applications")->where("id",$id)->where("user_id",$r->user()->id)->first(); if(!$a) return response()->json(["message"=>"Not found"],404); return response()->json(["application"=>$a]); }
    public function adminIndex(Request $r) { return response()->json(DB::table("pending_applications")->orderByDesc("created_at")->paginate(20)); }
    public function adminShow(Request $r, string $id) { $a=DB::table("pending_applications")->where("id",$id)->first(); if(!$a) return response()->json(["message"=>"Not found"],404); return response()->json(["application"=>$a]); }
    public function updateStatus(Request $r, string $id) {
        $r->validate(["status"=>"required"]);
        $app = DB::table("pending_applications")->where("id",$id)->first();
        DB::table("pending_applications")->where("id",$id)->update(["status"=>$r->status,"updated_at"=>now()]);

        // Send application status email
        if ($app && $app->user_id) {
            try {
                $user = DB::table("users")->where("id", $app->user_id)->first();
                if ($user) {
                    app(\App\Services\EmailService::class)->sendApplicationStatus(
                        $user->email,
                        $r->status,
                        $id
                    );
                }
            } catch (\Throwable $e) {
                logger()->warning('Application status email failed: ' . $e->getMessage());
            }
        }

        return response()->json(["message"=>"Updated"]);
    }

}
