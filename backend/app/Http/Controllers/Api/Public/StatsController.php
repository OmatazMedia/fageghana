<?php
namespace App\Http\Controllers\Api\Public;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StatsController extends Controller
{

    public function index() {
        return response()->json([
            "members"=>DB::table("member_profiles")->where("status","active")->count(),
            "events"=>DB::table("activities")->where("published",true)->where("category","event")->count(),
            "directory_listings"=>DB::table("directory_entries")->where("is_active",true)->count(),
            "news"=>DB::table("news")->where("published",true)->count(),
        ]);
    }

}
