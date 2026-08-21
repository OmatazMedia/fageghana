<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use App\Services\EmailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class MemberManagementController extends Controller
{

    public function index(Request $r) {
        $q = DB::table("member_profiles")->orderByDesc("created_at");
        if($s=$r->input("search")) $q->where("company_name","like","%$s%")->orWhere("contact_name","like","%$s%");
        if($s=$r->input("status")) $q->where("status",$s);
        if($t=$r->input("tier")) $q->where("tier",$t);
        return response()->json($q->paginate(20));
    }
    public function show(Request $r, string $id) {
        $m = DB::table("member_profiles")->where("id",$id)->first();
        if(!$m) return response()->json(["message"=>"Not found"],404);
        return response()->json(["member"=>$m]);
    }
    public function update(Request $r, string $id) {
        $v = $r->validate(["tier"=>"sometimes","status"=>"sometimes","company_name"=>"sometimes","notes"=>"nullable"]);
        $v["updated_at"] = now();
        DB::table("member_profiles")->where("id",$id)->update($v);
        return response()->json(["message"=>"Updated"]);
    }
    public function destroy(Request $r, string $id) {
        DB::table("member_profiles")->where("id",$id)->delete();
        return response()->json(["message"=>"Deleted"]);
    }

    public function bulkInvite(Request $r) {
        $v = $r->validate(["rows" => "required|array|max:500"]);
        $rows = array_slice($v["rows"], 0, 500);
        $succeeded = 0;
        $failed = [];

        foreach ($rows as $row) {
            $email = strtolower(trim((string) ($row["email"] ?? "")));
            $fullName = trim((string) ($row["full_name"] ?? ""));

            if ($email === "" || !filter_var($email, FILTER_VALIDATE_EMAIL) || $fullName === "") {
                $failed[] = ["email" => $email ?: "(missing)", "reason" => "email or full_name missing/invalid"];
                continue;
            }

            try {
                DB::beginTransaction();

                $user = DB::table("users")->where("email", $email)->first();
                if ($user) {
                    $userId = $user->id;
                } else {
                    $userId = Str::uuid()->toString();
                    $password = $row["password"] ?? null;
                    DB::table("users")->insert([
                        "id" => $userId,
                        "name" => $fullName,
                        "email" => $email,
                        "password" => Hash::make($password ?: Str::random(16)),
                        "email_verified_at" => $password ? now() : null,
                        "phone" => $row["phone"] ?? null,
                        "created_at" => now(),
                        "updated_at" => now(),
                    ]);
                }

                $hasRole = DB::table("user_roles")
                    ->where("user_id", $userId)->where("role", "member")->exists();
                if (!$hasRole) {
                    DB::table("user_roles")->insert([
                        "id" => Str::uuid()->toString(),
                        "user_id" => $userId, "role" => "member", "created_at" => now(),
                    ]);
                }

                $profile = DB::table("member_profiles")->where("user_id", $userId)->first();
                $profileData = [
                    "contact_name" => $fullName,
                    "email" => $email,
                    "phone" => $row["phone"] ?? "",
                    "company_name" => $row["company_name"] ?? "",
                    "tier" => $row["tier"] ?? "associate",
                    "status" => "new",
                    "updated_at" => now(),
                ];
                if ($profile) {
                    DB::table("member_profiles")->where("user_id", $userId)->update($profileData);
                } else {
                    DB::table("member_profiles")->insert(array_merge([
                        "id" => Str::uuid()->toString(),
                        "user_id" => $userId,
                        "created_at" => now(),
                    ], $profileData));
                }

                DB::commit();
                $succeeded++;

                try {
                    app(EmailService::class)->send(
                        $email,
                        "Your FAGE member account is ready",
                        "member_welcome",
                        ["name" => $fullName, "email" => $email, "password" => $row["password"] ?? null],
                    );
                } catch (\Throwable $e) {
                    logger()->warning("Welcome email failed for {$email}: " . $e->getMessage());
                }
            } catch (\Throwable $e) {
                DB::rollBack();
                $failed[] = ["email" => $email, "reason" => $e->getMessage()];
            }
        }

        return response()->json(["succeeded" => $succeeded, "failed" => $failed]);
    }

}
