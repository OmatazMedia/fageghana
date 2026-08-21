<?php
namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\EmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LoginSecurityController extends Controller
{

    private static function subnetOf(string $ip): string
    {
        $ip = trim($ip);
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = explode('.', $ip);
            return implode('.', [$parts[0], $parts[1], $parts[2], '0']);
        }
        return $ip;
    }

    public function gate(Request $r) {
        $defaults = [
            "member_idle_minutes" => 15,
            "console_idle_minutes" => 5,
            "countdown_seconds" => 10,
            "beep_enabled" => true,
        ];
        $row = DB::table("security_settings")->where("singleton", true)->first();
        $gate = (object) array_merge($defaults, $row ? (array) $row : []);
        $gate->banned_count = DB::table("ip_bans")->whereNull("unbanned_at")->count();
        return response()->json(["gate" => $gate]);
    }

    public function recordAttempt(Request $r) {
        $v = $r->validate([
            "outcome" => "required|in:success,failed,locked",
            "ip" => "nullable|string|max:45",
            "email" => "nullable|string|max:255",
            "portal" => "nullable|string|max:50",
            "user_agent" => "nullable|string|max:500",
        ]);
        $ip = $v["ip"] ?? "0.0.0.0";
        DB::table("login_attempts")->insert([
            "id" => Str::uuid()->toString(),
            "ip" => $ip,
            "subnet" => self::subnetOf($ip),
            "email_tried" => $v["email"] ?? null,
            "outcome" => $v["outcome"],
            "portal" => $v["portal"] ?? "member",
            "user_agent" => $v["user_agent"] ?? null,
            "created_at" => now(),
        ]);
        return response()->json(["ok" => true]);
    }

    public function loginAttempts(Request $r) {
        $limit = min(max((int) $r->input("limit", 50), 1), 500);
        $offset = max((int) $r->input("offset", 0), 0);
        $q = DB::table("login_attempts");
        if ($r->filled("email")) $q->where("email_tried", $r->input("email"));
        if ($r->filled("outcome")) $q->where("outcome", $r->input("outcome"));
        $count = (clone $q)->count();
        $data = $q->orderByDesc("created_at")->limit($limit)->offset($offset)->get();
        return response()->json(["data" => $data, "count" => $count]);
    }

    public function ipBans(Request $r) {
        $data = DB::table("ip_bans")
            ->whereNull("unbanned_at")
            ->orderByDesc("banned_at")
            ->get();
        return response()->json(["data" => $data]);
    }

    public function ban(Request $r) {
        $v = $r->validate(["ip" => "required|string|max:45"]);
        $ip = trim($v["ip"]);
        $existing = DB::table("ip_bans")->where("ip", $ip)->first();
        if ($existing) {
            DB::table("ip_bans")->where("id", $existing->id)->update([
                "reason" => $r->input("reason"),
                "banned_at" => now(),
                "unbanned_at" => null,
                "unbanned_by" => null,
                "updated_at" => now(),
            ]);
            return response()->json(["ok" => true]);
        }
        DB::table("ip_bans")->insert([
            "id" => Str::uuid()->toString(),
            "ip" => $ip,
            "subnet" => self::subnetOf($ip),
            "reason" => $r->input("reason"),
            "banned_at" => now(),
            "created_at" => now(),
            "updated_at" => now(),
        ]);
        return response()->json(["ok" => true]);
    }

    public function unban(Request $r) {
        $v = $r->validate(["id" => "required|string"]);
        DB::table("ip_bans")->where("id", $v["id"])->update([
            "unbanned_at" => now(),
            "unbanned_by" => $r->user()->id,
            "updated_at" => now(),
        ]);
        return response()->json(["ok" => true]);
    }

    public function checkEmail(Request $r) {
        $v = $r->validate(["email" => "required|email"]);
        $user = DB::table("users")->where("email", $v["email"])->first();
        $exists = (bool) $user;
        $isAdmin = false;
        if ($user) {
            $isAdmin = DB::table("user_roles")
                ->where("user_id", $user->id)
                ->whereIn("role", ["admin", "superadmin", "developer"])
                ->exists();
        }
        return response()->json(["exists" => $exists, "isAdmin" => $isAdmin]);
    }

    public function requestReset(Request $r) {
        $v = $r->validate(["email" => "required|email"]);
        $user = DB::table("users")->where("email", $v["email"])->first();
        if ($user) {
            $token = Str::random(64);
            DB::table("password_reset_tokens")->where("email", $user->email)->delete();
            DB::table("password_reset_tokens")->insert([
                "email" => $user->email, "token" => $token, "created_at" => now(),
            ]);
            try {
                app(EmailService::class)->sendPasswordReset($user->email, $token);
            } catch (\Throwable $e) {
                logger()->warning("Password reset email failed for {$user->email}: " . $e->getMessage());
            }
        }
        return response()->json(["ok" => true]);
    }

}