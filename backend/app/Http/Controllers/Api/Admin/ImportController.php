<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ImportController extends Controller
{

    public function import(Request $r) { return response()->json(["message"=>"Import pending implementation","imported"=>["users"=>0,"members"=>0]]); }

}
