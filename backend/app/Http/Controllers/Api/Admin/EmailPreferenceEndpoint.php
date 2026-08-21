<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EmailPreferenceEndpoint extends Controller
{

    // Replaces Edge Function: manage-email-preferences
    public function manage(Request $r) {
        $r->validate(["user_id"=>"required","preferences"=>"required|array"]);
        $existing = DB::table("member_email_preferences")->where("user_id",$r->user_id)->first();
        $prefs = $r->preferences;
        if ($existing) {
            DB::table("member_email_preferences")->where("user_id",$r->user_id)->update(array_merge($prefs,["updated_at"=>now()]));
        } else {
            DB::table("member_email_preferences")->insert(array_merge(["id"=>Str::uuid()->toString(),"user_id"=>$r->user_id,"created_at"=>now()],$prefs));
        }
        return response()->json(["message"=>"Preferences updated","preferences"=>$prefs]);
    }

}
