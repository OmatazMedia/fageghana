<?php
namespace App\Http\Controllers\Api\Public;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductController extends Controller
{

    public function index() { return response()->json(DB::table("products")->where("published",true)->orderByDesc("created_at")->paginate(20)); }
    public function show(string $slug) { $p=DB::table("products")->where("name","like",$slug)->where("published",true)->first(); if(!$p) return response()->json(["message"=>"Not found"],404); return response()->json(["product"=>$p]); }

}
