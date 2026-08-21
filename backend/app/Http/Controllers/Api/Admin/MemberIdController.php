<?php
namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MemberIdController extends Controller
{

    public function next(Request $r) {
        $abbrev = strtoupper((string) $r->input("abbrev", "MEMBER"));
        $yearCode = self::yearCode();
        $key = $yearCode . "-" . $abbrev;

        DB::beginTransaction();
        try {
            $counter = DB::table("member_id_counters")->where("year_abbrev", $key)->first();
            if ($counter) {
                $seq = $counter->next_seq;
                DB::table("member_id_counters")->where("year_abbrev", $key)
                    ->update(["next_seq" => $seq + 1, "updated_at" => now()]);
            } else {
                $seq = 1;
                DB::table("member_id_counters")->insert([
                    "year_abbrev" => $key, "next_seq" => 2, "updated_at" => now(),
                ]);
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            "member_id" => "FAGE/" . $abbrev . "/" . $yearCode . "/" . str_pad((string) $seq, 5, "0", STR_PAD_LEFT),
        ]);
    }

    public function start(Request $r) {
        $v = $r->validate([
            "year_abbrev" => "required|string|max:20",
            "next_seq" => "required|integer|min:1",
        ]);
        $yearCode = self::yearCode();
        $key = strtoupper($v["year_abbrev"]);
        if (!preg_match('/^\d{4}-/', $key)) {
            $key = $yearCode . "-" . $key;
        }

        $existing = DB::table("member_id_counters")->where("year_abbrev", $key)->first();
        if ($existing) {
            DB::table("member_id_counters")->where("year_abbrev", $key)
                ->update(["next_seq" => $v["next_seq"], "updated_at" => now()]);
        } else {
            DB::table("member_id_counters")->insert([
                "year_abbrev" => $key, "next_seq" => $v["next_seq"], "updated_at" => now(),
            ]);
        }

        return response()->json(["ok" => true]);
    }

    private static function yearCode(): string
    {
        $yy = str_pad((string) (((int) date('Y')) % 100), 2, '0', STR_PAD_LEFT);
        return str_pad($yy, 4, '0', STR_PAD_LEFT);
    }

}