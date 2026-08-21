<?php
namespace App\Http\Controllers\Api\Member;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CertificateController extends Controller
{

    public function index(Request $r) { return response()->json(["certificates"=>DB::table("certificates")->where("user_id",$r->user()->id)->orderByDesc("issued_at")->get()]); }
    public function download(Request $r, string $id) {
        $c=DB::table("certificates")->where("id",$id)->where("user_id",$r->user()->id)->first();
        if(!$c) return response()->json(["message"=>"Not found"],404);
        return response()->json(["certificate"=>$c]);
    }

}
