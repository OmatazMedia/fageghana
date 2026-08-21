<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ScheduledBackupController extends Controller
{

    public function showConfig(Request $r) { return response()->json(["config"=>DB::table("backup_schedules")->where("singleton",true)->first()]); }
    public function updateConfig(Request $r) {
        $v = $r->validate(["enabled"=>"sometimes|boolean","frequency"=>"sometimes|string","retention_days"=>"sometimes|integer"]);
        $existing = DB::table("backup_schedules")->where("singleton",true)->first();
        if($existing) DB::table("backup_schedules")->where("id",$existing->id)->update(array_merge($v,["updated_at"=>now()]));
        else DB::table("backup_schedules")->insert(array_merge($v,["id"=>Str::uuid()->toString(),"singleton"=>true,"created_at"=>now(),"updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }

}
