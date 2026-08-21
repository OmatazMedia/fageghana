<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EmailLogsController extends Controller
{

    public function index(Request $r) {
        $q = DB::table("email_log")->orderByDesc("created_at");
        if($r->input("status")) $q->where("status",$r->status);
        return response()->json($q->paginate(20));
    }

}
