<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EmailSettingsController extends Controller
{

    public function show(Request $r) {
        $s = DB::table("email_settings")->where("singleton",true)->first();
        return response()->json(["settings"=>$s]);
    }
    public function update(Request $r) {
        $v = $r->validate(["primary_provider"=>"sometimes","smtp_enabled"=>"sometimes|boolean","smtp_host"=>"nullable","smtp_port"=>"nullable|integer","smtp_user"=>"nullable","smtp_password"=>"nullable","smtp_from"=>"nullable","resend_enabled"=>"sometimes|boolean","resend_api_key"=>"nullable","resend_from"=>"nullable"]);
        $existing = DB::table("email_settings")->where("singleton",true)->first();
        if($existing) DB::table("email_settings")->where("id",$existing->id)->update(array_merge($v,["updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }

}
