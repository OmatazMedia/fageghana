<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReadinessChecklistController extends Controller
{

    public function index(Request $r) { return response()->json(["items"=>DB::table("readiness_checklist_items")->orderBy("display_order")->get()]); }
    public function store(Request $r) {
        $v = $r->validate(["title"=>"required","description"=>"nullable","category"=>"nullable","required_for_tier"=>"nullable"]);
        $id = Str::uuid()->toString();
        $max = DB::table("readiness_checklist_items")->max("display_order") ?? 0;
        DB::table("readiness_checklist_items")->insert(["id"=>$id,"title"=>$v["title"],"description"=>$v["description"]??null,"category"=>$v["category"]??null,"required_for_tier"=>$v["required_for_tier"]??null,"display_order"=>$max+1,"created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Created","id"=>$id], 201);
    }
    public function update(Request $r, string $id) {
        $v = $r->validate(["title"=>"sometimes","description"=>"nullable","is_active"=>"sometimes|boolean"]);
        $v["updated_at"] = now();
        DB::table("readiness_checklist_items")->where("id",$id)->update($v);
        return response()->json(["message"=>"Updated"]);
    }
    public function destroy(Request $r, string $id) { DB::table("readiness_checklist_items")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }

}
