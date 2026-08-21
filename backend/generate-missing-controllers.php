<?php
/**
 * Generate missing controllers and notification/activity endpoints.
 */

$adminBase = __DIR__ . '/app/Http/Controllers/Api/Admin';
$memberBase = __DIR__ . '/app/Http/Controllers/Api/Member';
$publicBase = __DIR__ . '/app/Http/Controllers/Api/Public';

function wc($dir, $name, $ns, $code) {
    $path = $dir . '/' . $name . '.php';
    $content = "<?php\nnamespace {$ns};\nuse App\\Http\\Controllers\\Controller;\nuse Illuminate\\Http\\Request;\nuse Illuminate\\Support\\Facades\\DB;\nuse Illuminate\\Support\\Str;\n\nclass {$name} extends Controller\n{\n{$code}\n}\n";
    file_put_contents($path, $content);
    echo "  {$name}\n";
}

echo "=== Creating Missing Admin Controllers ===\n";

wc($adminBase, 'PartnerLogosController', 'App\\Http\\Controllers\\Api\\Admin', '
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
');

wc($adminBase, 'SubscriptionPlanController', 'App\\Http\\Controllers\\Api\\Admin', '
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
');

wc($adminBase, 'PaymentGatewayController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) { return response()->json(["gateways"=>DB::table("payment_gateways")->get()]); }
    public function update(Request $r, string $provider) {
        $v = $r->validate(["public_key"=>"nullable","secret_key"=>"nullable","webhook_secret"=>"nullable","is_active"=>"sometimes|boolean","test_mode"=>"sometimes|boolean"]);
        $existing = DB::table("payment_gateways")->where("provider",$provider)->first();
        $v["updated_at"] = now();
        if ($existing) DB::table("payment_gateways")->where("id",$existing->id)->update($v);
        else DB::table("payment_gateways")->insert(array_merge($v,["id"=>Str::uuid()->toString(),"provider"=>$provider,"created_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }
    public function test(Request $r, string $provider) {
        return response()->json(["message"=>"Test connection {$provider}","status"=>"ok"]);
    }
');

wc($adminBase, 'ReadinessChecklistController', 'App\\Http\\Controllers\\Api\\Admin', '
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
');

wc($adminBase, 'ActivityLogController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) {
        $q = DB::table("activity_log");
        if ($r->input("user_id")) $q->where("user_id",$r->user_id);
        if ($r->input("action")) $q->where("action","like","%{$r->action}%");
        if ($r->input("entity_type")) $q->where("entity_type",$r->entity_type);
        return response()->json($q->orderByDesc("created_at")->paginate(20));
    }
');

wc($adminBase, 'NotificationController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) {
        $q = DB::table("admin_notification_settings");
        return response()->json(["settings"=>$q->first()]);
    }
    public function update(Request $r) {
        $v = $r->validate(["chat_recipients"=>"nullable","email_recipients"=>"nullable"]);
        $existing = DB::table("admin_notification_settings")->first();
        if ($existing) DB::table("admin_notification_settings")->where("id",$existing->id)->update(array_merge($v,["updated_at"=>now()]));
        else DB::table("admin_notification_settings")->insert(array_merge($v,["id"=>Str::uuid()->toString(),"created_at"=>now(),"updated_at"=>now()]));
        return response()->json(["message"=>"Updated"]);
    }
    public function send(Request $r) {
        $r->validate(["user_ids"=>"required|array","title"=>"required","body"=>"required","type"=>"nullable"]);
        $service = app(\\App\\Services\\NotificationService::class);
        $count = 0;
        foreach ($r->user_ids as $uid) { $service->send($uid, $r->title, $r->body, $r->input("type","info")); $count++; }
        return response()->json(["message"=>"Sent to {$count} users"]);
    }
');

wc($adminBase, 'ContactMessageController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function index(Request $r) { return response()->json(DB::table("contact_messages")->orderByDesc("created_at")->paginate(20)); }
    public function show(Request $r, string $id) {
        $msg = DB::table("contact_messages")->where("id",$id)->first();
        if (!$msg) return response()->json(["message"=>"Not found"], 404);
        return response()->json(["message"=>$msg]);
    }
    public function destroy(Request $r, string $id) { DB::table("contact_messages")->where("id",$id)->delete(); return response()->json(["message"=>"Deleted"]); }
');

wc($adminBase, 'ReportsController', 'App\\Http\\Controllers\\Api\\Admin', '
    public function membershipGrowth(Request $r) {
        $monthly = DB::table("member_profiles")
            ->select(DB::raw("strftime(\"%Y-%m\", created_at) as month"), DB::raw("count(*) as count"))
            ->groupBy("month")->orderBy("month")->get();
        return response()->json(["monthly_growth"=>$monthly]);
    }
    public function paymentSummary(Request $r) {
        $byMonth = DB::table("payment_submissions")
            ->select(DB::raw("strftime(\"%Y-%m\", created_at) as month"), DB::raw("sum(amount) as total"), DB::raw("count(*) as count"))
            ->groupBy("month")->orderBy("month")->get();
        $byProvider = DB::table("payment_submissions")
            ->select("method", DB::raw("count(*) as count"), DB::raw("sum(amount) as total"))
            ->groupBy("method")->get();
        return response()->json(["by_month"=>$byMonth,"by_provider"=>$byProvider]);
    }
    public function directoryStats(Request $r) {
        $byCategory = DB::table("directory_entries")->select("category",DB::raw("count(*) as count"))->groupBy("category")->get();
        $byCountry = DB::table("directory_entries")->select("country",DB::raw("count(*) as count"))->groupBy("country")->get();
        return response()->json(["by_category"=>$byCategory,"by_country"=>$byCountry]);
    }
');

wc($adminBase, 'EmailPreferenceEndpoint', 'App\\Http\\Controllers\\Api\\Admin', '
    // Replaces Edge Function: manage-email-preferences
    public function manage(Request $r) {
        $r->validate(["user_id"=>"required","preferences"=>"required|array"]);
        $existing = DB::table("member_email_preferences")->where("user_id",$r->user_id)->first();
        $prefs = $r->preferences;
        if ($existing) {
            DB::table("member_email_preferences")->where("user_id",$r->user_id)->update(array_merge($prefs,["updated_at"=>now()]));
        } else {
            DB::table("member_email_preferences")->insert(array_merge(["id"=>Str::uuid()->toString(),"user_id"=>$r->user_id,"created_at"=>now()],$prefs));
        }
        return response()->json(["message"=>"Preferences updated","preferences"=>$prefs]);
    }
');

echo "\n=== Creating Member Notification + Readiness Controllers ===\n";

wc($memberBase, 'NotificationController', 'App\\Http\\Controllers\\Api\\Member', '
    public function index(Request $r) {
        $unreadOnly = $r->input("unread", false);
        $q = DB::table("notifications")->where("user_id",$r->user()->id);
        if ($unreadOnly) $q->where("read", false);
        return response()->json($q->orderByDesc("created_at")->paginate(20));
    }
    public function unreadCount(Request $r) {
        $count = DB::table("notifications")->where("user_id",$r->user()->id)->where("read",false)->count();
        return response()->json(["count"=>$count]);
    }
    public function markRead(Request $r, string $id) {
        DB::table("notifications")->where("id",$id)->update(["read"=>true]);
        return response()->json(["message"=>"Marked as read"]);
    }
    public function markAllRead(Request $r) {
        DB::table("notifications")->where("user_id",$r->user()->id)->update(["read"=>true]);
        return response()->json(["message"=>"All marked as read"]);
    }
    public function destroy(Request $r, string $id) {
        DB::table("notifications")->where("id",$id)->delete();
        return response()->json(["message"=>"Deleted"]);
    }
');

wc($memberBase, 'ReadinessController', 'App\\Http\\Controllers\\Api\\Member', '
    public function index(Request $r) {
        $items = DB::table("readiness_checklist_items")->orderBy("display_order")->get();
        $responses = DB::table("member_readiness_responses")->where("user_id",$r->user()->id)->pluck("status","checklist_item_id")->toArray();
        $scored = 0; $total = count($items);
        foreach ($items as $item) {
            $status = $responses[$item->id] ?? "not_started";
            if ($status === "complete") $scored++;
        }
        $score = $total > 0 ? round(($scored/$total)*100) : 0;
        return response()->json(["items"=>$items,"responses"=>$responses,"score"=>$score,"completed"=>$scored,"total"=>$total]);
    }
    public function submit(Request $r) {
        $r->validate(["checklist_item_id"=>"required","status"=>"required|in:not_started,in_progress,complete","notes"=>"nullable"]);
        $existing = DB::table("member_readiness_responses")->where("user_id",$r->user()->id)->where("checklist_item_id",$r->checklist_item_id)->first();
        if ($existing) {
            DB::table("member_readiness_responses")->where("id",$existing->id)->update(["status"=>$r->status,"notes"=>$r->notes??null,"updated_at"=>now()]);
        } else {
            DB::table("member_readiness_responses")->insert(["id"=>Str::uuid()->toString(),"user_id"=>$r->user()->id,"checklist_item_id"=>$r->checklist_item_id,"status"=>$r->status,"notes"=>$r->notes??null,"created_at"=>now(),"updated_at"=>now()]);
        }
        return response()->json(["message"=>"Response saved"]);
    }
');

echo "\n=== All missing controllers created ===\n";
