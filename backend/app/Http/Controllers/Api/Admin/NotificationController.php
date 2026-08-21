<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NotificationController extends Controller
{

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
        $service = app(\App\Services\NotificationService::class);
        $count = 0;
        foreach ($r->user_ids as $uid) { $service->send($uid, $r->title, $r->body, $r->input("type","info")); $count++; }
        return response()->json(["message"=>"Sent to {$count} users"]);
    }

    /**
     * Public "Leave a message" notification from the chatbot widget.
     * Emails configured admins; never exposes restricted data and requires
     * no auth so the anonymous widget can fire-and-forget.
     */
    public function publicChatNotify(Request $r)
    {
        $v = $r->validate([
            "name" => "required|string|max:200",
            "email" => "required|email|max:255",
            "phone" => "nullable|string|max:50",
            "message" => "required|string|max:5000",
        ]);

        $settings = DB::table("admin_notification_settings")->first();
        $recipients = [];
        if ($settings && $settings->chat_message_recipients) {
            $decoded = json_decode((string) $settings->chat_message_recipients, true);
            if (is_array($decoded)) {
                $recipients = $decoded;
            } else {
                $recipients = array_map("trim", explode(",", (string) $settings->chat_message_recipients));
            }
        }
        $recipients = array_values(array_unique(array_filter($recipients, fn ($x) => $x !== null && trim((string) $x) !== "")));

        $sent = 0;
        if ($recipients) {
            $emails = DB::table("users")
                ->whereIn("id", $recipients)
                ->pluck("email")
                ->all();
            foreach ($emails as $to) {
                try {
                    app(\App\Services\EmailService::class)->send(
                        $to,
                        "New chatbot message from " . $v["name"],
                        "chatbot_message",
                        [
                            "name" => $v["name"],
                            "email" => $v["email"],
                            "phone" => $v["phone"] ?? "",
                            "message" => $v["message"],
                        ]
                    );
                    $sent++;
                } catch (\Throwable $e) {
                    logger()->warning("chatbot notify email failed to {$to}: " . $e->getMessage());
                }
            }
        }

        return response()->json(["ok" => true, "sent" => $sent]);
    }

    public function chatNotify(Request $r) {
        $v = $r->validate([
            "body" => "required|string",
            "title" => "nullable|string|max:255",
            "link" => "nullable|string|max:500",
        ]);
        $title = $v["title"] ?? "New message";
        $link = $v["link"] ?? null;

        $settings = DB::table("admin_notification_settings")->first();
        $recipients = [];

        if ($settings && $settings->chat_message_recipients) {
            $raw = $settings->chat_message_recipients;
            $decoded = json_decode((string) $raw, true);
            if (is_array($decoded)) {
                $recipients = $decoded;
            } else {
                $recipients = array_map("trim", explode(",", (string) $raw));
            }
        }

        if (empty($recipients)) {
            $recipients = DB::table("user_roles")->pluck("user_id")->all();
        }

        $recipients = array_values(array_unique(array_filter(
            $recipients,
            fn ($x) => $x !== null && trim((string) $x) !== "",
        )));

        $sent = 0;
        foreach ($recipients as $uid) {
            DB::table("notifications")->insert([
                "id" => Str::uuid()->toString(),
                "user_id" => $uid,
                "title" => $title,
                "body" => $v["body"],
                "link" => $link,
                "created_at" => now(),
            ]);
            $sent++;
        }

        return response()->json(["sent" => $sent]);
    }

}
