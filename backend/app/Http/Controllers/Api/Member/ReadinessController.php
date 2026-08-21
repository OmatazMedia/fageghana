<?php
namespace App\Http\Controllers\Api\Member;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReadinessController extends Controller
{

    public function index(Request $r) {
        $items = DB::table("readiness_checklist_items")->orderBy("display_order")->get();
        $responses = DB::table("member_readiness_responses")->where("user_id",$r->user()->id)->pluck("status","checklist_item_id")->toArray();
        $scored = 0; $total = count($items);
        foreach ($items as $item) {
            $status = $responses[$item->id] ?? "not_started";
            if ($status === "complete") $scored++;
        }
        $score = $total > 0 ? round(($scored/$total)*100) : 0;
        return response()->json(["items"=>$items,"responses"=>$responses,"score"=>$score,"completed"=>$scored,"total"=>$total]);
    }
    public function submit(Request $r) {
        $r->validate(["checklist_item_id"=>"required","status"=>"required|in:not_started,in_progress,complete","notes"=>"nullable"]);
        $existing = DB::table("member_readiness_responses")->where("user_id",$r->user()->id)->where("checklist_item_id",$r->checklist_item_id)->first();
        if ($existing) {
            DB::table("member_readiness_responses")->where("id",$existing->id)->update(["status"=>$r->status,"notes"=>$r->notes??null,"updated_at"=>now()]);
        } else {
            DB::table("member_readiness_responses")->insert(["id"=>Str::uuid()->toString(),"user_id"=>$r->user()->id,"checklist_item_id"=>$r->checklist_item_id,"status"=>$r->status,"notes"=>$r->notes??null,"created_at"=>now(),"updated_at"=>now()]);
        }
        return response()->json(["message"=>"Response saved"]);
    }

}
