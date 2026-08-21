<?php
namespace App\Http\Controllers\Api\Member;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EmailPreferencesController extends Controller
{

    public function show(Request $r) {
        $p=DB::table("member_email_preferences")->where("user_id",$r->user()->id)->first();
        return response()->json(["preferences"=>$p]);
    }
    public function update(Request $r) {
        $v=$r->validate(["newsletters"=>"sometimes|boolean","event_alerts"=>"sometimes|boolean","trade_notices"=>"sometimes|boolean","payment_reminders"=>"sometimes|boolean"]);
        $existing=DB::table("member_email_preferences")->where("user_id",$r->user()->id)->first();
        if($existing) DB::table("member_email_preferences")->where("user_id",$r->user()->id)->update(array_merge($v,["updated_at"=>now()]));
        else DB::table("member_email_preferences")->insert(array_merge(["id"=>Str::uuid()->toString(),"user_id"=>$r->user()->id,"created_at"=>now()],$v));

        // Send confirmation email about preference change
        try {
            $user = DB::table("users")->where("id", $r->user()->id)->first();
            if ($user) {
                $changedPrefs = [];
                foreach ($v as $key => $val) {
                    $changedPrefs[] = str_replace('_', ' ', $key) . ': ' . ($val ? 'Subscribed' : 'Unsubscribed');
                }
                app(\App\Services\EmailService::class)->send(
                    $user->email,
                    'Email Preferences Updated',
                    'email_preferences',
                    ['preferences' => implode(', ', $changedPrefs)]
                );
            }
        } catch (\Throwable $e) {
            logger()->warning('Preference change email failed: ' . $e->getMessage());
        }

        return response()->json(["message"=>"Updated"]);
    }
}
