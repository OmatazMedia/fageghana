<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PartnerLogosController extends Controller
{

    public function index(Request $r) { return response()->json(DB::table("site_partner_logos")->orderBy("display_order")->get()); }
    public function store(Request $r) {
        $v = $r->validate(["name"=>"required","url"=>"required","logo_url"=>"required"]);
        $id = Str::uuid()->toString();
        $max = DB::table("site_partner_logos")->max("display_order") ?? 0;
        DB::table("site_partner_logos")->insert(["id"=>$id,"name"=>$v["name"],"url"=>$v["url"],"logo_url"=>$v["logo_url"],"display_order"=>$max+1,"created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Created","id"=>$id], 201);
    }
    public function update(Request $r, string $id) {
        $v = $r->validate(["name"=>"sometimes","url"=>"nullable","logo_url"=>"nullable","display_order"=>"nullable|integer","is_active"=>"sometimes|boolean"]);
        $v["updated_at"] = now();
        DB::table("site_partner_logos")->where("id",$id)->update($v);
        return response()->json(["message"=>"Updated"]);
    }
    public function destroy(Request $r, string $id) { DB::table("site_partner_logos")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }

}
