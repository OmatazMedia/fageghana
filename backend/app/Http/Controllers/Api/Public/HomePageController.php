<?php
namespace App\Http\Controllers\Api\Public;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class HomePageController extends Controller
{

    public function index() { return response()->json(["slides"=>DB::table("site_hero_slides")->where("is_active",true)->orderBy("display_order")->get()]); }

}
