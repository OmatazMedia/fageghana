<?php
namespace App\Http\Controllers\Api\Member;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ResourceController extends Controller
{

    public function index(Request $r) { return response()->json(["resources"=>DB::table("membership_resources")->orderByDesc("created_at")->get()]); }

}
