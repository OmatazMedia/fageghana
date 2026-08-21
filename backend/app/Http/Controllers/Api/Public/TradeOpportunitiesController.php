<?php
namespace App\Http\Controllers\Api\Public;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TradeOpportunitiesController extends Controller
{

    public function index() { return response()->json(DB::table("trade_opportunities")->where("is_active",true)->orderByDesc("posted_at")->paginate(20)); }

}
