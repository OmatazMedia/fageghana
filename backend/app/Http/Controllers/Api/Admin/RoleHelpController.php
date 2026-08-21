<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RoleHelpController extends Controller
{

    public function index(Request $r) { return response()->json(["roles"=>DB::table("role_help")->orderBy("role")->get()]); }
    public function update(Request $r, string $role) { $r->validate(["summary"=>"required"]); DB::table("role_help")->where("role",$role)->update(["summary"=>$r->summary,"updated_at"=>now()]); return response()->json(["message"=>"Updated"]); }

}
