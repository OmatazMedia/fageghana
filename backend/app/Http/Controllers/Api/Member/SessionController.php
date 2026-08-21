<?php
namespace App\Http\Controllers\Api\Member;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SessionController extends Controller
{

    /** Coarse network comparison: IPv4 /16 or IPv6 /32 (mirrors frontend). */
    private static function sameNetwork(?string $a, ?string $b): bool
    {
        if (!$a || !$b) return true;
        if ($a === $b) return true;
        if (str_contains($a, ":") && str_contains($b, ":")) {
            return implode(":", array_slice(explode(":", $a), 0, 2)) ===
                   implode(":", array_slice(explode(":", $b), 0, 2));
        }
        $pa = explode(".", $a);
        $pb = explode(".", $b);
        if (count($pa) !== 4 || count($pb) !== 4) return false;
        return $pa[0] === $pb[0] && $pa[1] === $pb[1];
    }

    private function isAdmin(Request $r): bool
    {
        return DB::table("user_roles")
            ->where("user_id", $r->user()->id)
            ->whereIn("role", ["admin", "superadmin", "developer"])
            ->exists();
    }

    public function index(Request $r) {
        $target = $r->input("user_id") ?: $r->user()->id;
        if ((string) $target !== (string) $r->user()->id && !$this->isAdmin($r)) {
            return response()->json(["sessions" => [], "error" => "Forbidden"], 403);
        }
        $sessions = DB::table("user_sessions")
            ->where("user_id", $target)
            ->orderByDesc("last_seen_at")
            ->limit(50)
            ->get();
        return response()->json(["sessions" => $sessions]);
    }

    public function register(Request $r) {
        $v = $r->validate(["session_fingerprint" => "required|string|max:255"]);
        $uid = $r->user()->id;
        $fp = $v["session_fingerprint"];
        $ip = $r->ip() ?: null;

        $existing = DB::table("user_sessions")
            ->where("user_id", $uid)
            ->where("session_fingerprint", $fp)
            ->whereNull("revoked_at")
            ->first();

        if ($existing) {
            $data = ["last_seen_at" => now(), "updated_at" => now(), "revoked_at" => null];
            foreach (["browser", "os", "device_label"] as $k) {
                if ($r->filled($k)) $data[$k] = $r->input($k);
            }
            if ($ip) $data["ip_address"] = $ip;
            DB::table("user_sessions")->where("id", $existing->id)->update($data);
            $row = DB::table("user_sessions")->where("id", $existing->id)->first();
            $isNew = false;
        } else {
            $id = Str::uuid()->toString();
            DB::table("user_sessions")->insert([
                "id" => $id, "user_id" => $uid, "session_fingerprint" => $fp,
                "browser" => $r->input("browser"), "os" => $r->input("os"),
                "device_label" => $r->input("device_label"), "ip_address" => $ip,
                "suspicious" => false, "revoked_at" => null,
                "last_seen_at" => now(), "created_at" => now(), "updated_at" => now(),
            ]);
            $row = DB::table("user_sessions")->where("id", $id)->first();
            $isNew = true;
        }

        return response()->json(["session" => $row, "is_new_device" => $isNew]);
    }

    public function heartbeat(Request $r) {
        $v = $r->validate(["session_fingerprint" => "required|string|max:255"]);
        $uid = $r->user()->id;
        $fp = $v["session_fingerprint"];
        $ip = $r->ip() ?: null;

        $row = DB::table("user_sessions")
            ->where("user_id", $uid)
            ->where("session_fingerprint", $fp)
            ->orderByDesc("last_seen_at")
            ->first();

        if (!$row) {
            return response()->json(["valid" => false, "reason" => "unknown_session"]);
        }
        if ($row->revoked_at) {
            return response()->json(["valid" => false, "reason" => $row->revoked_reason ?: "revoked"]);
        }

        $fpChanged = $row->session_fingerprint !== $fp;
        $ipChanged = !self::sameNetwork($row->ip_address, $ip);

        if ($fpChanged || $ipChanged) {
            $reason = $fpChanged ? "fingerprint_changed" : "network_changed";
            DB::table("user_sessions")->where("id", $row->id)->update([
                "revoked_at" => now(),
                "revoked_reason" => $reason,
                "suspicious" => true,
                "updated_at" => now(),
            ]);
            try {
                DB::table("activity_log")->insert([
                    "id" => Str::uuid()->toString(),
                    "user_id" => $uid,
                    "event_type" => "session_anomaly",
                    "detail" => $reason . ($ip ? " · new IP {$ip}" : ""),
                    "ip_address" => $ip,
                    "user_agent" => $r->userAgent(),
                    "created_at" => now(),
                ]);
            } catch (\Throwable $e) { /* noop */ }
            return response()->json(["valid" => false, "reason" => $reason]);
        }

        DB::table("user_sessions")->where("id", $row->id)->update([
            "last_seen_at" => now(), "updated_at" => now(),
        ]);

        return response()->json(["valid" => true, "reason" => null]);
    }

    public function revokeOthers(Request $r) {
        $q = DB::table("user_sessions")
            ->where("user_id", $r->user()->id)
            ->whereNull("revoked_at");
        if ($r->filled("session_fingerprint")) {
            $q->where("session_fingerprint", "!=", $r->input("session_fingerprint"));
        }
        $count = $q->update([
            "revoked_at" => now(), "revoked_reason" => "user revoked others", "updated_at" => now(),
        ]);
        return response()->json(["revoked" => $count]);
    }

    public function revoke(Request $r, string $id) {
        $q = DB::table("user_sessions")->where("id", $id);
        $session = $q->first();
        if (!$session) return response()->json(["ok" => false, "error" => "Session not found"], 404);
        if ((string) $session->user_id !== (string) $r->user()->id && !$this->isAdmin($r)) {
            return response()->json(["ok" => false, "error" => "Forbidden"], 403);
        }
        DB::table("user_sessions")->where("id", $id)->update([
            "revoked_at" => now(),
            "revoked_reason" => $r->input("reason", "manual"),
            "updated_at" => now(),
        ]);
        return response()->json(["ok" => true]);
    }

}