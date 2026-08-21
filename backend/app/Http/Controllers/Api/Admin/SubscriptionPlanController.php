<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SubscriptionPlanController extends Controller
{

    public function index(Request $r) { return response()->json(DB::table("subscription_plans")->orderBy("display_order")->get()); }
    public function store(Request $r) {
        $v = $r->validate(["name"=>"required","price"=>"required|numeric","duration_months"=>"required|integer","tier"=>"required"]);
        $id = Str::uuid()->toString();
        DB::table("subscription_plans")->insert(["id"=>$id,"name"=>$v["name"],"price"=>$v["price"],"duration_months"=>$v["duration_months"],"tier"=>$v["tier"],"is_active"=>$r->input("is_active",true),"created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Created","id"=>$id], 201);
    }
    public function update(Request $r, string $id) {
        $v = $r->validate(["name"=>"sometimes","price"=>"nullable|numeric","duration_months"=>"nullable|integer","is_active"=>"sometimes|boolean"]);
        $v["updated_at"] = now();
        DB::table("subscription_plans")->where("id",$id)->update($v);
        return response()->json(["message"=>"Updated"]);
    }
    public function destroy(Request $r, string $id) { DB::table("subscription_plans")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }

}
