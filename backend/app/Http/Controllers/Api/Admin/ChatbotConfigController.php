<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ChatbotConfigController extends Controller
{

    public function show(Request $r) { return response()->json(["config"=>DB::table("chatbot_knowledge")->first()]); }
    public function update(Request $r) {
        $v=$r->validate(["welcome_message"=>"sometimes","system_prompt"=>"sometimes","model"=>"sometimes"]);
        $existing=DB::table("chatbot_knowledge")->first();
        if($existing) DB::table("chatbot_knowledge")->where("id",$existing->id)->update(array_merge($v,["updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }

}
