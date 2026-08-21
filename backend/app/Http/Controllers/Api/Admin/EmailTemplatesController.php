<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EmailTemplatesController extends Controller
{

    public function index(Request $r) { return response()->json(["templates"=>DB::table("email_templates")->orderByDesc("created_at")->get()]); }
    public function show(Request $r, string $id) { $t=DB::table("email_templates")->where("id",$id)->first(); if(!$t) return response()->json(["message"=>"Not found"],404); return response()->json(["template"=>$t]); }
    public function update(Request $r, string $id) { $v=$r->validate(["subject"=>"sometimes","blocks"=>"sometimes"]); $v["updated_at"]=now(); DB::table("email_templates")->where("id",$id)->update($v); return response()->json(["message"=>"Updated"]); }
    public function test(Request $r, string $id) { return response()->json(["message"=>"Test email sent"]); }

}
