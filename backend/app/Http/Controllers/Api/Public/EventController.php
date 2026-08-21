<?php
namespace App\Http\Controllers\Api\Public;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EventController extends Controller
{

    public function index() { return response()->json(DB::table("activities")->where("published",true)->where("category","event")->orderBy("event_date")->paginate(20)); }
    public function show(string $slug) { $e=DB::table("activities")->where("title","like",$slug)->where("published",true)->first(); if(!$e) return response()->json(["message"=>"Not found"],404); return response()->json(["event"=>$e]); }

}
