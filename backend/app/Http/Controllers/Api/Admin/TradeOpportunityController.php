<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TradeOpportunityController extends Controller
{

    public function index(Request $r) {
        $q=DB::table("trade_opportunities");
        if($s=$r->input("status")) $q->where("is_active",$s==="published");
        return response()->json($q->orderByDesc("created_at")->paginate(20));
    }
    public function store(Request $r) {
        $v=$r->validate(["title"=>"required","description"=>"required","source"=>"nullable","source_url"=>"nullable","category"=>"nullable","country"=>"nullable","deadline"=>"nullable"]);
        $id=Str::uuid()->toString();
        DB::table("trade_opportunities")->insert(["id"=>$id,"title"=>$v["title"],"description"=>$v["description"],"source"=>$v["source"]??null,"source_url"=>$v["source_url"]??null,"category"=>$v["category"]??null,"country"=>$v["country"]??null,"deadline"=>$v["deadline"]??null,"is_active"=>$r->input("is_active",true),"posted_at"=>now(),"created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Created","id"=>$id],201);
    }
    public function show(Request $r, string $id) { $i=DB::table("trade_opportunities")->where("id",$id)->first(); if(!$i) return response()->json(["message"=>"Not found"],404); return response()->json(["trade_opportunity"=>$i]); }
    public function update(Request $r, string $id) { $v=$r->validate(["title"=>"sometimes","description"=>"sometimes","is_active"=>"sometimes|boolean"]); $v["updated_at"]=now(); DB::table("trade_opportunities")->where("id",$id)->update($v); return response()->json(["message"=>"Updated"]); }
    public function destroy(Request $r, string $id) { DB::table("trade_opportunities")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }

}
