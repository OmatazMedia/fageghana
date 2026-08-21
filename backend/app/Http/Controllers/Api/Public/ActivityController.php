<?php
namespace App\Http\Controllers\Api\Public;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ActivityController extends Controller
{

    public function index() { return response()->json(DB::table("activities")->where("published",true)->orderByDesc("created_at")->paginate(20)); }
    public function show(string $slug) { $a=DB::table("activities")->where("title","like",$slug)->where("published",true)->first(); if(!$a) return response()->json(["message"=>"Not found"],404); return response()->json(["activity"=>$a]); }

}
