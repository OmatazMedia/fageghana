<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ActivityLogController extends Controller
{

    public function index(Request $r) {
        $q = DB::table("activity_log");
        if ($r->input("user_id")) $q->where("user_id", $r->input("user_id"));
        if ($r->input("action")) $q->where("event_type", "like", "%{$r->input('action')}%");
        if ($r->input("event_type")) $q->where("event_type", $r->input("event_type"));
        return response()->json($q->orderByDesc("created_at")->paginate(20));
    }

    public function store(Request $r) {
        $v = $r->validate([
            "action" => "required|string|max:255",
            "details" => "nullable|string",
            "subject_type" => "nullable|string|max:100",
            "subject_id" => "nullable|string|max:100",
            "ip_address" => "nullable|string|max:45",
        ]);

        $detail = $v["details"] ?? null;
        if (!empty($v["subject_type"])) {
            $suffix = $v["subject_type"] . ($v["subject_id"] ? ":" . $v["subject_id"] : "");
            $detail = $detail ? trim($detail) . " [{$suffix}]" : "[{$suffix}]";
        }

        $id = Str::uuid()->toString();
        DB::table("activity_log")->insert([
            "id" => $id,
            "user_id" => $r->user()->id,
            "event_type" => $v["action"],
            "detail" => $detail ?: null,
            "ip_address" => $v["ip_address"] ?? null,
            "user_agent" => $r->userAgent(),
            "created_at" => now(),
        ]);

        return response()->json(["id" => $id]);
    }

    /** Member-scoped: log an activity row for the authenticated user. */
    public function mineStore(Request $r) {
        $v = $r->validate([
            "action" => "required|string|max:255",
            "details" => "nullable|string",
            "subject_type" => "nullable|string|max:100",
            "subject_id" => "nullable|string|max:100",
        ]);
        $detail = $v["details"] ?? null;
        if (!empty($v["subject_type"])) {
            $suffix = $v["subject_type"] . ($v["subject_id"] ? ":" . $v["subject_id"] : "");
            $detail = $detail ? trim($detail) . " [{$suffix}]" : "[{$suffix}]";
        }
        $id = Str::uuid()->toString();
        DB::table("activity_log")->insert([
            "id" => $id,
            "user_id" => $r->user()->id,
            "event_type" => $v["action"],
            "detail" => $detail ?: null,
            "ip_address" => $r->ip(),
            "user_agent" => $r->userAgent(),
            "created_at" => now(),
        ]);
        return response()->json(["id" => $id]);
    }

    /** Member-scoped: list the authenticated user's own activity rows. */
    public function mineIndex(Request $r) {
        $limit = min(100, max(1, (int) $r->input("limit", 20)));
        $rows = DB::table("activity_log")
            ->where("user_id", $r->user()->id)
            ->orderByDesc("created_at")
            ->limit($limit)
            ->get();
        return response()->json($rows);
    }

}