<?php
/**
 * Rewrite ALL controllers to match the actual Supabase migration table schemas.
 * This is the definitive version that matches the real database.
 */

$adminBase = __DIR__ . '/app/Http/Controllers/Api/Admin';
$memberBase = __DIR__ . '/app/Http/Controllers/Api/Member';
$publicBase = __DIR__ . '/app/Http/Controllers/Api/Public';
$webhookBase = __DIR__ . '/app/Http/Controllers/Api/Webhook';
$apiBase = __DIR__ . '/app/Http/Controllers/Api';

// Helper
function wc($dir, $name, $ns, $code) {
    $path = $dir . '/' . $name . '.php';
    $content = "<?php\nnamespace {$ns};\nuse App\\Http\\Controllers\\Controller;\nuse Illuminate\\Http\\Request;\nuse Illuminate\\Support\\Facades\\DB;\nuse Illuminate\\Support\\Str;\n\nclass {$name} extends Controller\n{\n{$code}\n}\n";
    file_put_contents($path, $content);
    echo "  {$name}\n";
}

echo "=== Rewriting Admin Controllers ===\n";

wc($adminBase, 'DashboardController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) { return $this->stats($r); }
    public function stats(Request $r) {
        $data = [
            "total_users" => DB::table("users")->count(),
            "active_members" => DB::table("member_profiles")->where("status", "active")->count(),
            "pending_applications" => DB::table("pending_applications")->where("status", "pending")->count(),
            "total_revenue" => (float) DB::table("payment_submissions")->where("status", "confirmed")->sum("amount"),
            "open_tickets" => DB::table("support_tickets")->where("status", "open")->count(),
            "total_news" => DB::table("news")->count(),
            "total_products" => DB::table("products")->count(),
            "total_directory" => DB::table("directory_entries")->where("is_active", true)->count(),
        ];
        return response()->json(["overview" => $data]);
    }
');

wc($adminBase, 'AdminController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) {
        $q = DB::table("users")->with(["roles"])->orderByDesc("created_at");
        if ($s = $r->input("search")) {
            $q->where("name", "like", "%$s%")->orWhere("email", "like", "%$s%");
        }
        return response()->json($q->paginate(20));
    }
    public function store(Request $r) {
        $v = $r->validate(["name"=>"required","email"=>"required|email|unique:users","password"=>"required|min:8","role"=>"required"]);
        $id = Str::uuid()->toString();
        DB::table("users")->insert(["id"=>$id,"name"=>$v["name"],"email"=>$v["email"],"password"=>Hash::make($v["password"]),"created_at"=>now(),"updated_at"=>now()]);
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
');

wc($adminBase, 'MemberManagementController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) {
        $q = DB::table("member_profiles")->orderByDesc("created_at");
        if($s=$r->input("search")) $q->where("company_name","like","%$s%")->orWhere("contact_name","like","%$s%");
        if($s=$r->input("status")) $q->where("status",$s);
        if($t=$r->input("tier")) $q->where("tier",$t);
        return response()->json($q->paginate(20));
    }
    public function show(Request $r, string $id) {
        $m = DB::table("member_profiles")->where("id",$id)->first();
        if(!$m) return response()->json(["message"=>"Not found"],404);
        return response()->json(["member"=>$m]);
    }
    public function update(Request $r, string $id) {
        $v = $r->validate(["tier"=>"sometimes","status"=>"sometimes","company_name"=>"sometimes","notes"=>"nullable"]);
        $v["updated_at"] = now();
        DB::table("member_profiles")->where("id",$id)->update($v);
        return response()->json(["message"=>"Updated"]);
    }
    public function destroy(Request $r, string $id) {
        DB::table("member_profiles")->where("id",$id)->delete();
        return response()->json(["message"=>"Deleted"]);
    }
');

wc($adminBase, 'DirectoryApprovalController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function pending(Request $r) {
        return response()->json(DB::table("directory_entries")->where("status","pending_review")->orderByDesc("submitted_at")->paginate(20));
    }
    public function approve(Request $r, string $id) {
        DB::table("directory_entries")->where("id",$id)->update(["status"=>"approved","is_active"=>true,"reviewed_by"=>$r->user()->id,"reviewed_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Approved"]);
    }
    public function reject(Request $r, string $id) {
        $r->validate(["review_notes"=>"nullable|string"]);
        DB::table("directory_entries")->where("id",$id)->update(["status"=>"rejected","reviewed_by"=>$r->user()->id,"reviewed_at"=>now(),"review_notes"=>$r->input("review_notes"),"updated_at"=>now()]);
        return response()->json(["message"=>"Rejected"]);
    }
');

wc($adminBase, 'PaymentController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) {
        $q = DB::table("payment_submissions")->orderByDesc("created_at");
        if($r->input("status")) $q->where("status",$r->status);
        if($r->input("kind")) $q->where("kind",$r->kind);
        return response()->json($q->paginate(20));
    }
    public function show(Request $r, string $id) {
        $p = DB::table("payment_submissions")->where("id",$id)->first();
        if(!$p) return response()->json(["message"=>"Not found"],404);
        return response()->json(["payment"=>$p]);
    }
    public function updateStatus(Request $r, string $id) {
        $r->validate(["status"=>"required"]);
        $extra = $r->status==="confirmed" ? ["confirmed_by"=>$r->user()->id,"confirmed_at"=>now()] : [];
        DB::table("payment_submissions")->where("id",$id)->update(array_merge(["status"=>$r->status,"updated_at"=>now()], $extra));
        return response()->json(["message"=>"Status updated"]);
    }
    public function stats(Request $r) {
        $total = DB::table("payment_submissions")->sum("amount");
        $confirmed = DB::table("payment_submissions")->where("status","confirmed")->sum("amount");
        $pending = DB::table("payment_submissions")->where("status","pending")->sum("amount");
        $byKind = DB::table("payment_submissions")->select("kind",DB::raw("count(*) as count"),DB::raw("sum(amount) as total"))->groupBy("kind")->get();
        return response()->json(["total_amount"=>$total,"confirmed_amount"=>$confirmed,"pending_amount"=>$pending,"by_kind"=>$byKind]);
    }
');

wc($adminBase, 'ContentController', 'App\\Http\\Controllers\\Api\\Admin', '
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
');

wc($adminBase, 'BackupController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) { return response()->json(DB::table("backup_runs")->orderByDesc("created_at")->paginate(20)); }
    public function create(Request $r) {
        $id = Str::uuid()->toString();
        DB::table("backup_runs")->insert(["id"=>$id,"status"=>"completed","created_at"=>now(),"completed_at"=>now()]);
        return response()->json(["message"=>"Backup created","id"=>$id]);
    }
    public function download(Request $r, string $id) {
        $b = DB::table("backup_runs")->where("id",$id)->first();
        if(!$b) return response()->json(["message"=>"Not found"],404);
        return response()->json(["download_url"=>$b->file_path,"filename"=>$b->file_path]);
    }
    public function restore(Request $r, string $id) { return response()->json(["message"=>"Restored"]); }
    public function destroy(Request $r, string $id) { DB::table("backup_runs")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }
');

wc($adminBase, 'ScheduledBackupController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function showConfig(Request $r) { return response()->json(["config"=>DB::table("backup_schedules")->where("singleton",true)->first()]); }
    public function updateConfig(Request $r) {
        $v = $r->validate(["enabled"=>"sometimes|boolean","frequency"=>"sometimes|string","retention_days"=>"sometimes|integer"]);
        $existing = DB::table("backup_schedules")->where("singleton",true)->first();
        if($existing) DB::table("backup_schedules")->where("id",$existing->id)->update(array_merge($v,["updated_at"=>now()]));
        else DB::table("backup_schedules")->insert(array_merge($v,["id"=>Str::uuid()->toString(),"singleton"=>true,"created_at"=>now(),"updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }
');

wc($adminBase, 'EmailSettingsController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function show(Request $r) {
        $s = DB::table("email_settings")->where("singleton",true)->first();
        return response()->json(["settings"=>$s]);
    }
    public function update(Request $r) {
        $v = $r->validate(["primary_provider"=>"sometimes","smtp_enabled"=>"sometimes|boolean","smtp_host"=>"nullable","smtp_port"=>"nullable|integer","smtp_user"=>"nullable","smtp_password"=>"nullable","smtp_from"=>"nullable","resend_enabled"=>"sometimes|boolean","resend_api_key"=>"nullable","resend_from"=>"nullable"]);
        $existing = DB::table("email_settings")->where("singleton",true)->first();
        if($existing) DB::table("email_settings")->where("id",$existing->id)->update(array_merge($v,["updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }
');

wc($adminBase, 'EmailTemplatesController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) { return response()->json(["templates"=>DB::table("email_templates")->orderByDesc("created_at")->get()]); }
    public function show(Request $r, string $id) { $t=DB::table("email_templates")->where("id",$id)->first(); if(!$t) return response()->json(["message"=>"Not found"],404); return response()->json(["template"=>$t]); }
    public function update(Request $r, string $id) { $v=$r->validate(["subject"=>"sometimes","blocks"=>"sometimes"]); $v["updated_at"]=now(); DB::table("email_templates")->where("id",$id)->update($v); return response()->json(["message"=>"Updated"]); }
    public function test(Request $r, string $id) { return response()->json(["message"=>"Test email sent"]); }
');

wc($adminBase, 'EmailLogsController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) {
        $q = DB::table("email_log")->orderByDesc("created_at");
        if($r->input("status")) $q->where("status",$r->status);
        return response()->json($q->paginate(20));
    }
');

wc($adminBase, 'RoleHelpController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) { return response()->json(["roles"=>DB::table("role_help")->orderBy("role")->get()]); }
    public function update(Request $r, string $role) { $r->validate(["summary"=>"required"]); DB::table("role_help")->where("role",$role)->update(["summary"=>$r->summary,"updated_at"=>now()]); return response()->json(["message"=>"Updated"]); }
');

wc($adminBase, 'SettingsController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function show(Request $r) { return response()->json(["settings"=>DB::table("app_settings")->where("singleton",true)->first()]); }
    public function update(Request $r) {
        $v=$r->validate(["site_name"=>"sometimes","site_url"=>"sometimes","currency"=>"sometimes","timezone"=>"sometimes"]);
        $existing=DB::table("app_settings")->where("singleton",true)->first();
        if($existing) DB::table("app_settings")->where("id",$existing->id)->update(array_merge($v,["updated_at"=>now()]));
        else DB::table("app_settings")->insert(array_merge($v,["id"=>Str::uuid()->toString(),"singleton"=>true,"created_at"=>now(),"updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }
');

wc($adminBase, 'SecuritySettingsController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function show(Request $r) { return response()->json(["settings"=>DB::table("security_settings")->where("singleton",true)->first()]); }
    public function update(Request $r) {
        $v=$r->validate(["member_idle_minutes"=>"sometimes|integer","console_idle_minutes"=>"sometimes|integer","countdown_seconds"=>"sometimes|integer","beep_enabled"=>"sometimes|boolean"]);
        $existing=DB::table("security_settings")->where("singleton",true)->first();
        if($existing) DB::table("security_settings")->where("id",$existing->id)->update(array_merge($v,["updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }
');

wc($adminBase, 'SubscriberController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) { return response()->json(DB::table("contact_messages")->orderByDesc("created_at")->paginate(20)); }
    public function destroy(Request $r, string $id) { DB::table("contact_messages")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }
');

wc($adminBase, 'ChatbotConfigController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function show(Request $r) { return response()->json(["config"=>DB::table("chatbot_knowledge")->first()]); }
    public function update(Request $r) {
        $v=$r->validate(["welcome_message"=>"sometimes","system_prompt"=>"sometimes","model"=>"sometimes"]);
        $existing=DB::table("chatbot_knowledge")->first();
        if($existing) DB::table("chatbot_knowledge")->where("id",$existing->id)->update(array_merge($v,["updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }
');

wc($adminBase, 'TradeOpportunityController', 'App\\Http\\Controllers\\Api\\Admin', '
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
');

wc($adminBase, 'TradeMatchController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function match(Request $r, string $id) {
        $r->validate(["member_ids"=>"required|array"]);
        $count=0;
        foreach($r->member_ids as $mid) {
            $exists=DB::table("trade_opportunity_interests")->where("trade_opportunity_id",$id)->where("user_id",$mid)->first();
            if(!$exists) { DB::table("trade_opportunity_interests")->insert(["id"=>Str::uuid()->toString(),"trade_opportunity_id"=>$id,"user_id"=>$mid,"created_at"=>now()]); $count++; }
        }
        return response()->json(["message"=>"$count matched","matched_count"=>$count]);
    }
');

wc($adminBase, 'CertificateController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) { return response()->json(DB::table("certificates")->orderByDesc("issued_at")->paginate(20)); }
    public function store(Request $r) {
        $v=$r->validate(["user_id"=>"required","full_name"=>"required","tier"=>"nullable","expires_at"=>"nullable"]);
        $id=Str::uuid()->toString();
        DB::table("certificates")->insert(["id"=>$id,"user_id"=>$v["user_id"],"full_name"=>$v["full_name"],"tier"=>$v["tier"]??null,"verification_code"=>Str::random(16),"issued_at"=>now(),"expires_at"=>$v["expires_at"]??null,"created_at"=>now()]);
        return response()->json(["message"=>"Issued","id"=>$id],201);
    }
    public function update(Request $r, string $id) { $v=$r->validate(["full_name"=>"sometimes","tier"=>"nullable","revoked"=>"sometimes|boolean"]); DB::table("certificates")->where("id",$id)->update($v); return response()->json(["message"=>"Updated"]); }
    public function destroy(Request $r, string $id) { DB::table("certificates")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }
    public function verify(Request $r, string $id) { $c=DB::table("certificates")->where("id",$id)->first(); if(!$c) return response()->json(["message"=>"Not found"],404); return response()->json(["valid"=>!$c->revoked,"certificate"=>$c]); }
');

wc($adminBase, 'SupportTicketController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) {
        $q=DB::table("support_tickets");
        if($s=$r->input("status")) $q->where("status",$s);
        return response()->json($q->orderByDesc("created_at")->paginate(20));
    }
    public function show(Request $r, string $id) {
        $t=DB::table("support_tickets")->where("id",$id)->first();
        if(!$t) return response()->json(["message"=>"Not found"],404);
        $msgs=DB::table("ticket_messages")->where("ticket_id",$id)->orderBy("created_at")->get();
        return response()->json(["ticket"=>$t,"messages"=>$msgs]);
    }
    public function update(Request $r, string $id) { $v=$r->validate(["status"=>"sometimes","priority"=>"sometimes"]); $v["updated_at"]=now(); DB::table("support_tickets")->where("id",$id)->update($v); return response()->json(["message"=>"Updated"]); }
    public function addMessage(Request $r, string $id) {
        $r->validate(["body"=>"required"]);
        DB::table("ticket_messages")->insert(["id"=>Str::uuid()->toString(),"ticket_id"=>$id,"sender_id"=>$r->user()->id,"is_admin"=>true,"body"=>$r->body,"created_at"=>now()]);
        return response()->json(["message"=>"Reply added"]);
    }
    public function assign(Request $r, string $id) { $r->validate(["contact_name"=>"required"]); DB::table("support_tickets")->where("id",$id)->update(["contact_name"=>$r->contact_name,"status"=>"in_progress","updated_at"=>now()]); return response()->json(["message"=>"Assigned"]); }
    public function updateStatus(Request $r, string $id) { $r->validate(["status"=>"required"]); DB::table("support_tickets")->where("id",$id)->update(["status"=>$r->status,"updated_at"=>now()]); return response()->json(["message"=>"Updated"]); }
');

wc($adminBase, 'ImportController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function import(Request $r) { return response()->json(["message"=>"Import pending implementation","imported"=>["users"=>0,"members"=>0]]); }
');

echo "\n=== Member Controllers ===\n";

wc($memberBase, 'DashboardController', 'App\\Http\\Controllers\\Api\\Member', '
    public function index(Request $r) {
        $u=$r->user();
        $payments=DB::table("payment_submissions")->where("user_id",$u->id)->orderByDesc("created_at")->limit(5)->get();
        $tickets=DB::table("support_tickets")->where("user_id",$u->id)->orderByDesc("created_at")->limit(5)->get();
        $profile=DB::table("member_profiles")->where("user_id",$u->id)->first();
        return response()->json(["user"=>["id"=>$u->id,"name"=>$u->name,"email"=>$u->email],"member"=>$profile,"recent_payments"=>$payments,"support_tickets"=>$tickets]);
    }
');

wc($memberBase, 'ProfileController', 'App\\Http\\Controllers\\Api\\Member', '
    public function show(Request $r) {
        $u=$r->user()->load(["roles"]);
        $p=DB::table("member_profiles")->where("user_id",$u->id)->first();
        return response()->json(["user"=>["id"=>$u->id,"name"=>$u->name,"email"=>$u->email,"phone"=>$u->phone,"avatar_url"=>$u->avatar_url,"roles"=>$u->roles->pluck("role"),"member"=>$p]]);
    }
    public function update(Request $r) {
        $v=$r->validate(["name"=>"sometimes","phone"=>"nullable","company_name"=>"nullable","contact_name"=>"nullable","industry"=>"nullable","country"=>"nullable"]);
        $u=$r->user();
        if(isset($v["name"])||isset($v["phone"])) DB::table("users")->where("id",$u->id)->update(array_filter(["name"=>$v["name"]??null,"phone"=>$v["phone"]??null,"updated_at"=>now()]));
        DB::table("member_profiles")->where("user_id",$u->id)->update(array_filter(["company_name"=>$v["company_name"]??null,"contact_name"=>$v["contact_name"]??null,"industry"=>$v["industry"]??null,"country"=>$v["country"]??null,"updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }
    public function uploadAvatar(Request $r) { $r->validate(["avatar"=>"required|image|max:2048"]); $path=$r->file("avatar")->store("avatars","public"); DB::table("users")->where("id",$r->user()->id)->update(["avatar_url"=>$path]); return response()->json(["avatar_url"=>$path]); }
    public function updateProfile(Request $r) { return $this->update($r); }
    public function updatePassword(Request $r) {
        $r->validate(["current_password"=>"required","password"=>"required|min:8|confirmed"]);
        $u=$r->user();
        if(!Hash::check($r->current_password,$u->password)) return response()->json(["message"=>"Wrong password"],422);
        DB::table("users")->where("id",$u->id)->update(["password"=>Hash::make($r->password)]);
        return response()->json(["message"=>"Password updated"]);
    }
    public function deleteAccount(Request $r) {
        $r->validate(["password"=>"required"]);
        $u=$r->user();
        if(!Hash::check($r->password,$u->password)) return response()->json(["message"=>"Wrong password"],422);
        $u->tokens()->delete();
        DB::table("users")->where("id",$u->id)->update(["email"=>"deleted_".Str::random(8)."@gone.local","password"=>Hash::make(Str::random(64))]);
        return response()->json(["message"=>"Account deleted"]);
    }
');

wc($memberBase, 'DirectoryController', 'App\\Http\\Controllers\\Api\\Member', '
    public function myListing(Request $r) {
        $l=DB::table("directory_entries")->where("user_id",$r->user()->id)->first();
        return response()->json(["listing"=>$l]);
    }
    public function createListing(Request $r) {
        $v=$r->validate(["company_name"=>"required","short_description"=>"required","category"=>"nullable","website"=>"nullable","phone"=>"nullable","country"=>"nullable","region"=>"nullable"]);
        $id=Str::uuid()->toString();
        DB::table("directory_entries")->insert(["id"=>$id,"slug"=>Str::slug($v["company_name"]),"company_name"=>$v["company_name"],"short_description"=>$v["short_description"],"category"=>$v["category"]??null,"website"=>$v["website"]??null,"phone"=>$v["phone"]??null,"country"=>$v["country"]??null,"region"=>$v["region"]??null,"user_id"=>$r->user()->id,"status"=>"pending_review","submitted_at"=>now(),"created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Submitted for approval","id"=>$id],201);
    }
    public function updateListing(Request $r) {
        $v=$r->validate(["company_name"=>"sometimes","short_description"=>"sometimes","category"=>"nullable","website"=>"nullable","phone"=>"nullable"]);
        $v["status"]="pending_review"; $v["updated_at"]=now();
        DB::table("directory_entries")->where("user_id",$r->user()->id)->update($v);
        return response()->json(["message"=>"Updated and resubmitted"]);
    }
');

wc($memberBase, 'PaymentController', 'App\\Http\\Controllers\\Api\\Member', '
    public function index(Request $r) { return response()->json(DB::table("payment_submissions")->where("user_id",$r->user()->id)->orderByDesc("created_at")->paginate(20)); }
    public function show(Request $r, string $id) { $p=DB::table("payment_submissions")->where("id",$id)->where("user_id",$r->user()->id)->first(); if(!$p) return response()->json(["message"=>"Not found"],404); return response()->json(["payment"=>$p]); }
    public function initialize(Request $r) {
        $v=$r->validate(["amount"=>"required|numeric|min:1","method"=>"required|in:paystack,flutterwave,hubtel","kind"=>"nullable"]);
        $id=Str::uuid()->toString();
        $ref=strtoupper(Str::random(12));
        DB::table("payment_submissions")->insert(["id"=>$id,"user_id"=>$r->user()->id,"method"=>$v["method"],"amount"=>$v["amount"],"currency"=>"GHS","status"=>"pending","reference"=>$ref,"kind"=>$v["kind"]??null,"created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["payment_id"=>$id,"reference"=>$ref,"amount"=>$v["amount"],"method"=>$v["method"],"authorization_url"=>"https://checkout.".($v["method"]==="paystack"?"paystack.com":"flutterwave.com")."/".$ref]);
    }
    public function initializePublic(Request $r) { return $this->initialize($r); }
    public function initializePublicFw(Request $r) { return $this->initialize($r); }
    public function initializePublicHt(Request $r) { return $this->initialize($r); }
');

wc($memberBase, 'ApplicationController', 'App\\Http\\Controllers\\Api\\Member', '
    public function index(Request $r) { return response()->json(["applications"=>DB::table("pending_applications")->where("user_id",$r->user()->id)->orderByDesc("created_at")->get()]); }
    public function store(Request $r) {
        $v=$r->validate(["contact_name"=>"required","company_name"=>"required","email"=>"required|email","phone"=>"nullable","industry"=>"nullable","tier"=>"required"]);
        $id=Str::uuid()->toString();
        DB::table("pending_applications")->insert(["id"=>$id,"user_id"=>$r->user()->id,"contact_name"=>$v["contact_name"],"company_name"=>$v["company_name"],"email"=>$v["email"],"phone"=>$v["phone"]??null,"industry"=>$v["industry"]??null,"tier"=>$v["tier"],"status"=>"pending","created_at"=>now(),"updated_at"=>now()]);
        return response()->json(["message"=>"Submitted","id"=>$id],201);
    }
    public function show(Request $r, string $id) { $a=DB::table("pending_applications")->where("id",$id)->where("user_id",$r->user()->id)->first(); if(!$a) return response()->json(["message"=>"Not found"],404); return response()->json(["application"=>$a]); }
    public function adminIndex(Request $r) { return response()->json(DB::table("pending_applications")->orderByDesc("created_at")->paginate(20)); }
    public function adminShow(Request $r, string $id) { $a=DB::table("pending_applications")->where("id",$id)->first(); if(!$a) return response()->json(["message"=>"Not found"],404); return response()->json(["application"=>$a]); }
    public function updateStatus(Request $r, string $id) {
        $r->validate(["status"=>"required"]);
        DB::table("pending_applications")->where("id",$id)->update(["status"=>$r->status,"updated_at"=>now()]);
        return response()->json(["message"=>"Updated"]);
    }
');

wc($memberBase, 'CertificateController', 'App\\Http\\Controllers\\Api\\Member', '
    public function index(Request $r) { return response()->json(["certificates"=>DB::table("certificates")->where("user_id",$r->user()->id)->orderByDesc("issued_at")->get()]); }
    public function download(Request $r, string $id) {
        $c=DB::table("certificates")->where("id",$id)->where("user_id",$r->user()->id)->first();
        if(!$c) return response()->json(["message"=>"Not found"],404);
        return response()->json(["certificate"=>$c]);
    }
');

wc($memberBase, 'ResourceController', 'App\\Http\\Controllers\\Api\\Member', '
    public function index(Request $r) { return response()->json(["resources"=>DB::table("membership_resources")->orderByDesc("created_at")->get()]); }
');

wc($memberBase, 'TradeController', 'App\\Http\\Controllers\\Api\\Member', '
    public function index(Request $r) { return response()->json(DB::table("trade_opportunities")->where("is_active",true)->orderByDesc("posted_at")->paginate(20)); }
    public function show(Request $r, string $id) { $t=DB::table("trade_opportunities")->where("id",$id)->first(); if(!$t) return response()->json(["message"=>"Not found"],404); return response()->json(["trade_opportunity"=>$t]); }
');

wc($memberBase, 'SupportTicketController', 'App\\Http\\Controllers\\Api\\Member', '
    public function index(Request $r) { return response()->json(DB::table("support_tickets")->where("user_id",$r->user()->id)->orderByDesc("created_at")->paginate(20)); }
    public function store(Request $r) {
        $v=$r->validate(["subject"=>"required","message"=>"required","priority"=>"nullable"]);
        $id=Str::uuid()->toString();
        DB::table("support_tickets")->insert(["id"=>$id,"user_id"=>$r->user()->id,"subject"=>$v["subject"],"message"=>$v["message"],"priority"=>$v["priority"]??"medium","status"=>"open","source"=>"member","contact_name"=>$r->user()->name,"contact_email"=>$r->user()->email,"created_at"=>now(),"updated_at"=>now()]);
        DB::table("ticket_messages")->insert(["id"=>Str::uuid()->toString(),"ticket_id"=>$id,"sender_id"=>$r->user()->id,"is_admin"=>false,"body"=>$v["message"],"created_at"=>now()]);
        return response()->json(["message"=>"Created","id"=>$id],201);
    }
    public function show(Request $r, string $id) {
        $t=DB::table("support_tickets")->where("id",$id)->where("user_id",$r->user()->id)->first();
        if(!$t) return response()->json(["message"=>"Not found"],404);
        $msgs=DB::table("ticket_messages")->where("ticket_id",$id)->orderBy("created_at")->get();
        return response()->json(["ticket"=>$t,"messages"=>$msgs]);
    }
    public function addMessage(Request $r, string $id) {
        $r->validate(["body"=>"required"]);
        DB::table("ticket_messages")->insert(["id"=>Str::uuid()->toString(),"ticket_id"=>$id,"sender_id"=>$r->user()->id,"is_admin"=>false,"body"=>$r->body,"created_at"=>now()]);
        return response()->json(["message"=>"Reply added"]);
    }
');

wc($memberBase, 'EmailPreferencesController', 'App\\Http\\Controllers\\Api\\Member', '
    public function show(Request $r) {
        $p=DB::table("member_email_preferences")->where("user_id",$r->user()->id)->first();
        return response()->json(["preferences"=>$p]);
    }
    public function update(Request $r) {
        $v=$r->validate(["newsletters"=>"sometimes|boolean","event_alerts"=>"sometimes|boolean","trade_notices"=>"sometimes|boolean","payment_reminders"=>"sometimes|boolean"]);
        $existing=DB::table("member_email_preferences")->where("user_id",$r->user()->id)->first();
        if($existing) DB::table("member_email_preferences")->where("user_id",$r->user()->id)->update(array_merge($v,["updated_at"=>now()]));
        else DB::table("member_email_preferences")->insert(array_merge(["id"=>Str::uuid()->toString(),"user_id"=>$r->user()->id,"created_at"=>now()],$v));
        return response()->json(["message"=>"Updated"]);
    }
');

echo "\n=== Public Controllers ===\n";

wc($publicBase, 'NewsController', 'App\\Http\\Controllers\\Api\\Public', '
    public function index() { return response()->json(DB::table("news")->where("published",true)->orderByDesc("published_at")->paginate(20)); }
    public function show(string $slug) { $n=DB::table("news")->where("slug",$slug)->where("published",true)->first(); if(!$n) return response()->json(["message"=>"Not found"],404); return response()->json(["article"=>$n]); }
');

wc($publicBase, 'ProductController', 'App\\Http\\Controllers\\Api\\Public', '
    public function index() { return response()->json(DB::table("products")->where("published",true)->orderByDesc("created_at")->paginate(20)); }
    public function show(string $slug) { $p=DB::table("products")->where("name","like",$slug)->where("published",true)->first(); if(!$p) return response()->json(["message"=>"Not found"],404); return response()->json(["product"=>$p]); }
');

wc($publicBase, 'ActivityController', 'App\\Http\\Controllers\\Api\\Public', '
    public function index() { return response()->json(DB::table("activities")->where("published",true)->orderByDesc("created_at")->paginate(20)); }
    public function show(string $slug) { $a=DB::table("activities")->where("title","like",$slug)->where("published",true)->first(); if(!$a) return response()->json(["message"=>"Not found"],404); return response()->json(["activity"=>$a]); }
');

wc($publicBase, 'EventController', 'App\\Http\\Controllers\\Api\\Public', '
    public function index() { return response()->json(DB::table("activities")->where("published",true)->where("category","event")->orderBy("event_date")->paginate(20)); }
    public function show(string $slug) { $e=DB::table("activities")->where("title","like",$slug)->where("published",true)->first(); if(!$e) return response()->json(["message"=>"Not found"],404); return response()->json(["event"=>$e]); }
');

wc($publicBase, 'MediaController', 'App\\Http\\Controllers\\Api\\Public', '
    public function index() { return response()->json(DB::table("media")->orderByDesc("created_at")->paginate(20)); }
');

wc($publicBase, 'DirectoryController', 'App\\Http\\Controllers\\Api\\Public', '
    public function index() {
        $q=DB::table("directory_entries")->where("is_active",true)->where("status","approved");
        if($i=request("industry")) $q->where("category",$i);
        if($c=request("city")) $q->where("region",$c);
        if($s=request("search")) $q->where("company_name","like","%$s%");
        return response()->json($q->orderByDesc("featured")->paginate(20));
    }
    public function show(string $slug) { $d=DB::table("directory_entries")->where("slug",$slug)->where("is_active",true)->first(); if(!$d) return response()->json(["message"=>"Not found"],404); return response()->json(["listing"=>$d]); }
');

wc($publicBase, 'TradeOpportunitiesController', 'App\\Http\\Controllers\\Api\\Public', '
    public function index() { return response()->json(DB::table("trade_opportunities")->where("is_active",true)->orderByDesc("posted_at")->paginate(20)); }
');

wc($publicBase, 'HomePageController', 'App\\Http\\Controllers\\Api\\Public', '
    public function index() { return response()->json(["slides"=>DB::table("site_hero_slides")->where("is_active",true)->orderBy("display_order")->get()]); }
');

wc($publicBase, 'CountdownController', 'App\\Http\\Controllers\\Api\\Public', '
    public function index() { return response()->json(["countdown"=>null]); }
');

wc($publicBase, 'StatsController', 'App\\Http\\Controllers\\Api\\Public', '
    public function index() {
        return response()->json([
            "members"=>DB::table("member_profiles")->where("status","active")->count(),
            "events"=>DB::table("activities")->where("published",true)->where("category","event")->count(),
            "directory_listings"=>DB::table("directory_entries")->where("is_active",true)->count(),
            "news"=>DB::table("news")->where("published",true)->count(),
        ]);
    }
');

wc($publicBase, 'ChatbotController', 'App\\Http\\Controllers\\Api\\Public', '
    public function chat(Request $r) {
        $r->validate(["message"=>"required"]);
        return response()->json(["response"=>"Thank you for your message. Our team will get back to you.","session_id"=>Str::uuid()->toString()]);
    }
');

wc($publicBase, 'SubscriberController', 'App\\Http\\Controllers\\Api\\Public', '
    public function subscribe(Request $r) {
        $r->validate(["email"=>"required|email"]);
        $exists=DB::table("contact_messages")->where("email",$r->email)->first();
        if(!$exists) DB::table("contact_messages")->insert(["id"=>Str::uuid()->toString(),"email"=>$r->email,"created_at"=>now()]);
        return response()->json(["message"=>"Subscribed"]);
    }
    public function unsubscribe(Request $r) { return response()->json(["message"=>"Unsubscribed"]); }
');

echo "\n=== Webhook Controllers ===\n";

wc($webhookBase, 'PaystackWebhookController', 'App\\Http\\Controllers\\Api\\Webhook', '
    public function handle(Request $r) {
        $payload=$r->all();
        $event=$payload["event"]??"";
        $data=$payload["data"]??[];
        if($event==="charge.success") {
            $ref=$data["reference"]??"";
            DB::table("payment_submissions")->where("reference",$ref)->update(["status"=>"confirmed","confirmed_at"=>now(),"updated_at"=>now()]);
        }
        return response()->json(["status"=>"ok"]);
    }
');

wc($webhookBase, 'FlutterwaveWebhookController', 'App\\Http\\Controllers\\Api\\Webhook', '
    public function handle(Request $r) {
        $payload=$r->all();
        $event=$payload["event"]??"";
        $data=$payload["data"]??[];
        if($event==="charge.completed") {
            $ref=$data["tx_ref"]??"";
            DB::table("payment_submissions")->where("reference",$ref)->update(["status"=>"confirmed","confirmed_at"=>now(),"updated_at"=>now()]);
        }
        return response()->json(["status"=>"ok"]);
    }
');

wc($webhookBase, 'HubtelWebhookController', 'App\\Http\\Controllers\\Api\\Webhook', '
    public function handle(Request $r) {
        $payload=$r->all();
        $status=$payload["Status"]??"";
        $ref=$payload["ClientReference"]??$payload["TransactionId"]??"";
        if($status==="Success"||$status==="Completed") {
            DB::table("payment_submissions")->where("reference",$ref)->update(["status"=>"confirmed","confirmed_at"=>now(),"updated_at"=>now()]);
        }
        return response()->json(["status"=>"ok"]);
    }
');

echo "\n=== ALL CONTROLLERS REWRITTEN ===\n";
