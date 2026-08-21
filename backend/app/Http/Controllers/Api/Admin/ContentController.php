<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ContentController extends Controller
{

    // NEWS: table "news" has id, title, slug, excerpt, body, category, cover_image_url, author, published, published_at
    public function indexNews(Request $r) { return response()->json(DB::table("news")->orderByDesc("created_at")->paginate(20)); }
    public function storeNews(Request $r) {
        $v = $r->validate(["title"=>"required","body"=>"required","excerpt"=>"nullable","category"=>"nullable","cover_image_url"=>"nullable"]);
        $id = Str::uuid()->toString();
        DB::table("news")->insert(["id"=>$id,"title"=>$v["title"],"slug"=>Str::slug($v["title"]),"excerpt"=>$v["excerpt"]??null,"body"=>$v["body"],"category"=>$v["category"]??"Industry News","cover_image_url"=>$v["cover_image_url"]??null,"author"=>$r->user()->name,"published"=>$r->input("published",false),"published_at"=>$r->input("published")?now():now(),"created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Created","id"=>$id],201);
    }
    public function updateNews(Request $r, string $id) {
        $v = $r->validate(["title"=>"sometimes","body"=>"sometimes","excerpt"=>"nullable","category"=>"nullable","cover_image_url"=>"nullable","published"=>"sometimes|boolean"]);
        if(isset($v["title"])) $v["slug"]=Str::slug($v["title"]);
        $v["updated_at"]=now();
        DB::table("news")->where("id",$id)->update($v);
        return response()->json(["message"=>"Updated"]);
    }
    public function destroyNews(Request $r, string $id) { DB::table("news")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }

    // PRODUCTS: table "products" has id, name, category, description, image_url, features, display_order, published
    public function indexProducts(Request $r) { return response()->json(DB::table("products")->orderByDesc("created_at")->paginate(20)); }
    public function storeProduct(Request $r) {
        $v = $r->validate(["name"=>"required","description"=>"required","category"=>"nullable","image_url"=>"nullable","features"=>"nullable"]);
        $id = Str::uuid()->toString();
        DB::table("products")->insert(["id"=>$id,"name"=>$v["name"],"description"=>$v["description"],"category"=>$v["category"]??null,"image_url"=>$v["image_url"]??null,"features"=>$v["features"]??null,"published"=>$r->input("published",false),"created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Created","id"=>$id],201);
    }
    public function updateProduct(Request $r, string $id) {
        $v = $r->validate(["name"=>"sometimes","description"=>"sometimes","category"=>"nullable","image_url"=>"nullable","features"=>"nullable","published"=>"sometimes|boolean"]);
        $v["updated_at"]=now();
        DB::table("products")->where("id",$id)->update($v);
        return response()->json(["message"=>"Updated"]);
    }
    public function destroyProduct(Request $r, string $id) { DB::table("products")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }

    // ACTIVITIES: has id, title, category, description, image_url, location, event_date, spots_remaining, is_featured, published
    public function indexActivities(Request $r) { return response()->json(DB::table("activities")->orderByDesc("created_at")->paginate(20)); }
    public function storeActivity(Request $r) {
        $v = $r->validate(["title"=>"required","description"=>"required","category"=>"nullable","image_url"=>"nullable","location"=>"nullable","event_date"=>"nullable","spots_remaining"=>"nullable|integer"]);
        $id = Str::uuid()->toString();
        DB::table("activities")->insert(["id"=>$id,"title"=>$v["title"],"description"=>$v["description"],"category"=>$v["category"]??null,"image_url"=>$v["image_url"]??null,"location"=>$v["location"]??null,"event_date"=>$v["event_date"]??null,"spots_remaining"=>$v["spots_remaining"]??null,"is_featured"=>$r->input("is_featured",false),"published"=>$r->input("published",false),"created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Created","id"=>$id],201);
    }
    public function updateActivity(Request $r, string $id) {
        $v = $r->validate(["title"=>"sometimes","description"=>"sometimes","category"=>"nullable","image_url"=>"nullable","location"=>"nullable","event_date"=>"nullable","published"=>"sometimes|boolean"]);
        $v["updated_at"]=now();
        DB::table("activities")->where("id",$id)->update($v);
        return response()->json(["message"=>"Updated"]);
    }
    public function destroyActivity(Request $r, string $id) { DB::table("activities")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }

    // EVENTS (use activities table for now)
    public function indexEvents(Request $r) { return response()->json(DB::table("activities")->where("category","event")->orderByDesc("event_date")->paginate(20)); }
    public function storeEvent(Request $r) { return $this->storeActivity($r); }
    public function updateEvent(Request $r, string $id) { return $this->updateActivity($r, $id); }
    public function destroyEvent(Request $r, string $id) { return $this->destroyActivity($r, $id); }

    // MEDIA
    public function indexMedia(Request $r) { return response()->json(DB::table("media")->orderByDesc("created_at")->paginate(20)); }
    public function storeMedia(Request $r) {
        $v = $r->validate(["title"=>"required","type"=>"required","url"=>"required","description"=>"nullable"]);
        $id = Str::uuid()->toString();
        DB::table("media")->insert(["id"=>$id,"title"=>$v["title"],"type"=>$v["type"],"url"=>$v["url"],"description"=>$v["description"]??null,"uploaded_by"=>$r->user()->id,"created_at"=>now()]);
        return response()->json(["message"=>"Uploaded","id"=>$id],201);
    }
    public function destroyMedia(Request $r, string $id) { DB::table("media")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }

    // HOME PAGE (site_hero_slides)
    public function getHomePage(Request $r) { return response()->json(["slides"=>DB::table("site_hero_slides")->orderBy("display_order")->get()]); }
    public function updateHomePage(Request $r) {
        $v = $r->validate(["slides"=>"nullable|array"]);
        if(isset($v["slides"])) {
            foreach($v["slides"] as $i=>$slide) {
                DB::table("site_hero_slides")->updateOrInsert(
                    ["id"=>$slide["id"]??Str::uuid()->toString()],
                    array_merge($slide, ["display_order"=>$i, "updated_at"=>now()])
                );
            }
        }
        return response()->json(["message"=>"Updated"]);
    }
    public function getCountdown(Request $r) { return response()->json(["countdown"=>DB::table("countdowns")->where("is_active",true)->first() ?? null]); }
    public function updateCountdown(Request $r) { return response()->json(["message"=>"Countdown updated"]); }

}
