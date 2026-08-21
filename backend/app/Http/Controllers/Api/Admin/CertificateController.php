<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CertificateController extends Controller
{

    public function index(Request $r) { return response()->json(DB::table("certificates")->orderByDesc("issued_at")->paginate(20)); }
    public function store(Request $r) {
        $v=$r->validate(["user_id"=>"required","full_name"=>"required","tier"=>"nullable","expires_at"=>"nullable"]);
        $id=Str::uuid()->toString();
        DB::table("certificates")->insert(["id"=>$id,"user_id"=>$v["user_id"],"full_name"=>$v["full_name"],"tier"=>$v["tier"]??null,"verification_code"=>Str::random(16),"issued_at"=>now(),"expires_at"=>$v["expires_at"]??null,"created_at"=>now()]);
        return response()->json(["message"=>"Issued","id"=>$id],201);
    }
    public function update(Request $r, string $id) { $v=$r->validate(["full_name"=>"sometimes","tier"=>"nullable","revoked"=>"sometimes|boolean"]); DB::table("certificates")->where("id",$id)->update($v); return response()->json(["message"=>"Updated"]); }
    public function destroy(Request $r, string $id) { DB::table("certificates")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }
    public function verify(Request $r, string $id) { $c=DB::table("certificates")->where("id",$id)->first(); if(!$c) return response()->json(["message"=>"Not found"],404); return response()->json(["valid"=>!$c->revoked,"certificate"=>$c]); }

}
