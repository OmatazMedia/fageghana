<?php
namespace App\Http\Controllers\Api\Public;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DirectoryController extends Controller
{

    public function index() {
        $q=DB::table("directory_entries")->where("is_active",true)->where("status","approved");
        if($i=request("industry")) $q->where("category",$i);
        if($c=request("city")) $q->where("region",$c);
        if($s=request("search")) $q->where("company_name","like","%$s%");
        return response()->json($q->orderByDesc("featured")->paginate(20));
    }
    public function show(string $slug) { $d=DB::table("directory_entries")->where("slug",$slug)->where("is_active",true)->first(); if(!$d) return response()->json(["message"=>"Not found"],404); return response()->json(["listing"=>$d]); }

}
