<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DashboardController extends Controller
{

    public function index(Request $r) { return $this->stats($r); }
    public function stats(Request $r) {
        $data = [
            "total_users" => DB::table("users")->count(),
            "active_members" => DB::table("member_profiles")->where("status", "active")->count(),
            "pending_applications" => DB::table("pending_applications")->where("status", "pending")->count(),
            "total_revenue" => (float) DB::table("payment_submissions")->where("status", "confirmed")->sum("amount"),
            "open_tickets" => DB::table("support_tickets")->where("status", "open")->count(),
            "total_news" => DB::table("news")->count(),
            "total_products" => DB::table("products")->count(),
            "total_directory" => DB::table("directory_entries")->where("is_active", true)->count(),
        ];
        return response()->json(["overview" => $data]);
    }

}
