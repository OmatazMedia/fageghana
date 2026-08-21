<?php
namespace App\Http\Controllers\Api\Public;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NewsController extends Controller
{

    public function index() { return response()->json(DB::table("news")->where("published",true)->orderByDesc("published_at")->paginate(20)); }
    public function show(string $slug) { $n=DB::table("news")->where("slug",$slug)->where("published",true)->first(); if(!$n) return response()->json(["message"=>"Not found"],404); return response()->json(["article"=>$n]); }

}
