<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReportsController extends Controller
{

    public function membershipGrowth(Request $r) {
        $monthly = DB::table("member_profiles")
            ->select(DB::raw("strftime(\"%Y-%m\", created_at) as month"), DB::raw("count(*) as count"))
            ->groupBy("month")->orderBy("month")->get();
        return response()->json(["monthly_growth"=>$monthly]);
    }
    public function paymentSummary(Request $r) {
        $byMonth = DB::table("payment_submissions")
            ->select(DB::raw("strftime(\"%Y-%m\", created_at) as month"), DB::raw("sum(amount) as total"), DB::raw("count(*) as count"))
            ->groupBy("month")->orderBy("month")->get();
        $byProvider = DB::table("payment_submissions")
            ->select("method", DB::raw("count(*) as count"), DB::raw("sum(amount) as total"))
            ->groupBy("method")->get();
        return response()->json(["by_month"=>$byMonth,"by_provider"=>$byProvider]);
    }
    public function directoryStats(Request $r) {
        $byCategory = DB::table("directory_entries")->select("category",DB::raw("count(*) as count"))->groupBy("category")->get();
        $byCountry = DB::table("directory_entries")->select("country",DB::raw("count(*) as count"))->groupBy("country")->get();
        return response()->json(["by_category"=>$byCategory,"by_country"=>$byCountry]);
    }

}
