<?php
namespace App\Http\Controllers\Api\Public;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MediaController extends Controller
{

    public function index() { return response()->json(DB::table("media")->orderByDesc("created_at")->paginate(20)); }

}
