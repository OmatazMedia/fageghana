<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SettingsController extends Controller
{

    public function show(Request $r) { return response()->json(["settings"=>DB::table("app_settings")->where("singleton",true)->first()]); }
    public function update(Request $r) {
        $v=$r->validate(["site_name"=>"sometimes","site_url"=>"sometimes","currency"=>"sometimes","timezone"=>"sometimes"]);
        $existing=DB::table("app_settings")->where("singleton",true)->first();
        if($existing) DB::table("app_settings")->where("id",$existing->id)->update(array_merge($v,["updated_at"=>now()]));
        else DB::table("app_settings")->insert(array_merge($v,["id"=>Str::uuid()->toString(),"singleton"=>true,"created_at"=>now(),"updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }

}
