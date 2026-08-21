<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminController extends Controller
{

    public function index(Request $r) {
        $q = DB::table("users")->orderByDesc("created_at");
        if ($s = $r->input("search")) {
            $q->where("name", "like", "%$s%")->orWhere("email", "like", "%$s%");
        }
        $users = $q->paginate(20);
        $ids = collect($users->items())->pluck("id")->all();
        $rolesByUser = DB::table("user_roles")
            ->whereIn("user_id", $ids)
            ->get()
            ->groupBy("user_id");
        foreach ($users->items() as $u) {
            $u->roles = ($rolesByUser[$u->id] ?? collect())->map(fn ($x) => $x->role)->values();
        }
        return response()->json($users);
    }
    public function store(Request $r) {
        $name = $r->input("full_name", $r->input("name"));
        $v = $r->validate(["email"=>"required|email|unique:users","password"=>"required|min:8","role"=>"required"]);
        $id = Str::uuid()->toString();
        DB::table("users")->insert(["id"=>$id,"name"=>$name ?? $v["name"] ?? "", "email"=>$v["email"],"password"=>Hash::make($v["password"]),"created_at"=>now(),"updated_at"=>now()]);
        DB::table("user_roles")->insert(["id"=>Str::uuid()->toString(),"user_id"=>$id,"role"=>$v["role"],"created_at"=>now()]);
        return response()->json(["message"=>"User created","id"=>$id], 201);
    }
    public function show(Request $r, string $id) {
        $u = DB::table("users")->where("id",$id)->first();
        if(!$u) return response()->json(["message"=>"Not found"],404);
        $u->roles = DB::table("user_roles")->where("user_id",$id)->pluck("role");
        return response()->json(["user"=>$u]);
    }
    public function update(Request $r, string $id) {
        $v = $r->validate(["name"=>"sometimes","email"=>"sometimes|email","phone"=>"nullable"]);
        $v["updated_at"] = now();
        DB::table("users")->where("id",$id)->update($v);
        return response()->json(["message"=>"Updated"]);
    }
    public function destroy(Request $r, string $id) {
        DB::table("user_roles")->where("user_id",$id)->delete();
        DB::table("users")->where("id",$id)->delete();
        return response()->json(["message"=>"Deleted"]);
    }
    public function updateRole(Request $r, string $id) {
        $r->validate(["role"=>"required"]);
        DB::table("user_roles")->where("user_id",$id)->delete();
        DB::table("user_roles")->insert(["id"=>Str::uuid()->toString(),"user_id"=>$id,"role"=>$r->role,"created_at"=>now()]);
        return response()->json(["message"=>"Role updated"]);
    }
    public function updateStatus(Request $r, string $id) {
        $r->validate(["status"=>"required"]);
        DB::table("member_profiles")->where("user_id",$id)->update(["status"=>$r->status,"updated_at"=>now()]);
        return response()->json(["message"=>"Status updated"]);
    }

}
