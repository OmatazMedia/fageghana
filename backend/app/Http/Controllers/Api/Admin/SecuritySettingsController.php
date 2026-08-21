<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SecuritySettingsController extends Controller
{

    public function show(Request $r) { return response()->json(["settings"=>DB::table("security_settings")->where("singleton",true)->first()]); }
    public function update(Request $r) {
        $v=$r->validate(["member_idle_minutes"=>"sometimes|integer","console_idle_minutes"=>"sometimes|integer","countdown_seconds"=>"sometimes|integer","beep_enabled"=>"sometimes|boolean"]);
        $existing=DB::table("security_settings")->where("singleton",true)->first();
        if($existing) DB::table("security_settings")->where("id",$existing->id)->update(array_merge($v,["updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }

}
