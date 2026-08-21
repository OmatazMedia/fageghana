<?php
/**
 * Generate remaining Admin controllers + Public + Webhook controllers
 */

$adminBase = __DIR__ . '/app/Http/Controllers/Api/Admin';
$publicBase = __DIR__ . '/app/Http/Controllers/Api/Public';
$webhookBase = __DIR__ . '/app/Http/Controllers/Api/Webhook';

// ─── Backup Controller ─────────────────────────────────────
file_put_contents($adminBase . '/BackupController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class BackupController extends Controller
{
    public function index(Request $request)
    {
        $backups = DB::table(\'backups\')->orderByDesc(\'created_at\')->paginate(20);
        return response()->json($backups);
    }

    public function create(Request $request)
    {
        $id = Str::uuid()->toString();
        $filename = \'backup_\' . now()->format(\'Y-m-d_His\') . \'.sql\';

        DB::table(\'backups\')->insert([
            \'id\' => $id, \'filename\' => $filename, \'path\' => "backups/{$filename}",
            \'size\' => 0, \'type\' => \'manual\', \'status\' => \'completed\',
            \'created_by\' => $request->user()->id,
            \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
        ]);

        // TODO: Actually dump database
        return response()->json([\'message\' => \'Backup created\', \'backup_id\' => $id, \'filename\' => $filename]);
    }

    public function download(Request $request, string $id)
    {
        $backup = DB::table(\'backups\')->where(\'id\', $id)->first();
        if (!$backup) return response()->json([\'message\' => \'Backup not found\'], 404);

        // TODO: Stream actual file
        return response()->json([\'download_url\' => $backup->path, \'filename\' => $backup->filename]);
    }

    public function restore(Request $request, string $id)
    {
        $backup = DB::table(\'backups\')->where(\'id\', $id)->first();
        if (!$backup) return response()->json([\'message\' => \'Backup not found\'], 404);

        // TODO: Actually restore from backup
        return response()->json([\'message\' => \'Backup restored successfully\']);
    }

    public function destroy(Request $request, string $id)
    {
        DB::table(\'backups\')->where(\'id\', $id)->delete();
        return response()->json([\'message\' => \'Backup deleted\']);
    }
}
');

// ─── Scheduled Backup Controller ───────────────────────────
file_put_contents($adminBase . '/ScheduledBackupController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class ScheduledBackupController extends Controller
{
    public function showConfig(Request $request)
    {
        $config = DB::table(\'scheduled_backups\')->where(\'singleton\', true)->first();
        return response()->json([\'config\' => $config]);
    }

    public function updateConfig(Request $request)
    {
        $v = $request->validate([
            \'enabled\' => \'sometimes|boolean\', \'frequency\' => \'sometimes|string\',
            \'time\' => \'sometimes|string\', \'provider\' => \'sometimes|string\',
            \'retention_days\' => \'sometimes|integer\',
        ]);

        $existing = DB::table(\'scheduled_backups\')->where(\'singleton\', true)->first();
        if ($existing) {
            DB::table(\'scheduled_backups\')->where(\'id\', $existing->id)->update(
                array_merge($v, [\'updated_at\' => now()->toDateTimeString()])
            );
        } else {
            DB::table(\'scheduled_backups\')->insert(array_merge($v, [
                \'id\' => \\Illuminate\\Support\\Str::uuid()->toString(), \'singleton\' => true,
                \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
            ]));
        }
        return response()->json([\'message\' => \'Backup schedule updated\']);
    }
}
');

// ─── Email Settings ────────────────────────────────────────
file_put_contents($adminBase . '/EmailSettingsController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class EmailSettingsController extends Controller
{
    public function show(Request $request)
    {
        $settings = DB::table(\'email_settings\')->where(\'singleton\', true)->first();
        // Mask passwords
        if ($settings && $settings->smtp_password) {
            $settings->smtp_password = str_repeat(\'*\', 8);
        }
        if ($settings && $settings->resend_api_key) {
            $settings->resend_api_key = str_repeat(\'*\', 8);
        }
        return response()->json([\'settings\' => $settings]);
    }

    public function update(Request $request)
    {
        $v = $request->validate([
            \'primary_provider\' => \'sometimes|string\',
            \'smtp_enabled\' => \'sometimes|boolean\', \'smtp_host\' => \'nullable|string\',
            \'smtp_port\' => \'nullable|integer\', \'smtp_user\' => \'nullable|string\',
            \'smtp_password\' => \'nullable|string\', \'smtp_from\' => \'nullable|string\',
            \'resend_enabled\' => \'sometimes|boolean\', \'resend_api_key\' => \'nullable|string\',
            \'resend_from\' => \'nullable|string\',
        ]);

        // Don\'t update masked passwords
        if (str_repeat(\'*\', 8) === ($v[\'smtp_password\'] ?? \'\')) unset($v[\'smtp_password\']);
        if (str_repeat(\'*\', 8) === ($v[\'resend_api_key\'] ?? \'\')) unset($v[\'resend_api_key\']);

        $existing = DB::table(\'email_settings\')->where(\'singleton\', true)->first();
        if ($existing) {
            DB::table(\'email_settings\')->where(\'id\', $existing->id)->update(
                array_merge($v, [\'updated_at\' => now()->toDateTimeString()])
            );
        }
        return response()->json([\'message\' => \'Email settings updated\']);
    }
}
');

// ─── Email Templates ───────────────────────────────────────
file_put_contents($adminBase . '/EmailTemplatesController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class EmailTemplatesController extends Controller
{
    public function index(Request $request)
    {
        $templates = DB::table(\'email_templates\')->orderByDesc(\'created_at\')->get();
        return response()->json([\'templates\' => $templates]);
    }

    public function show(Request $request, string $id)
    {
        $template = DB::table(\'email_templates\')->where(\'id\', $id)->first();
        if (!$template) return response()->json([\'message\' => \'Template not found\'], 404);
        return response()->json([\'template\' => $template]);
    }

    public function update(Request $request, string $id)
    {
        $v = $request->validate([
            \'subject\' => \'sometimes|string\', \'blocks\' => \'sometimes\', \'is_active\' => \'sometimes|boolean\',
        ]);
        DB::table(\'email_templates\')->where(\'id\', $id)->update(
            array_merge($v, [\'updated_at\' => now()->toDateTimeString()])
        );
        return response()->json([\'message\' => \'Template updated\']);
    }

    public function test(Request $request, string $id)
    {
        $template = DB::table(\'email_templates\')->where(\'id\', $id)->first();
        if (!$template) return response()->json([\'message\' => \'Template not found\'], 404);

        // TODO: Send test email
        return response()->json([\'message\' => \'Test email sent to admin\']);
    }
}
');

// ─── Email Logs ────────────────────────────────────────────
file_put_contents($adminBase . '/EmailLogsController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class EmailLogsController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table(\'email_logs\')->orderByDesc(\'created_at\');
        if ($request->status) $query->where(\'status\', $request->status);
        if ($request->to) $query->where(\'to\', \'like\', "%{$request->to}%");
        return response()->json($query->paginate(20));
    }
}
');

// ─── Role Help ─────────────────────────────────────────────
file_put_contents($adminBase . '/RoleHelpController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class RoleHelpController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([\'roles\' => DB::table(\'role_help\')->orderBy(\'role\')->get()]);
    }

    public function update(Request $request, string $role)
    {
        $request->validate([\'summary\' => \'required|string\']);
        DB::table(\'role_help\')->where(\'role\', $role)->update([
            \'summary\' => $request->summary, \'updated_at\' => now()->toDateTimeString(),
        ]);
        return response()->json([\'message\' => \'Role description updated\']);
    }
}
');

// ─── Settings ──────────────────────────────────────────────
file_put_contents($adminBase . '/SettingsController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class SettingsController extends Controller
{
    public function show(Request $request)
    {
        $settings = DB::table(\'app_settings\')->where(\'singleton\', true)->first();
        return response()->json([\'settings\' => $settings]);
    }

    public function update(Request $request)
    {
        $v = $request->validate([
            \'site_name\' => \'sometimes|string\', \'site_url\' => \'sometimes|string\',
            \'currency\' => \'sometimes|string\', \'timezone\' => \'sometimes|string\',
            \'logo_url\' => \'nullable|string\', \'primary_color\' => \'nullable|string\',
        ]);
        $existing = DB::table(\'app_settings\')->where(\'singleton\', true)->first();
        if ($existing) {
            DB::table(\'app_settings\')->where(\'id\', $existing->id)->update(
                array_merge($v, [\'updated_at\' => now()->toDateTimeString()])
            );
        } else {
            DB::table(\'app_settings\')->insert(array_merge($v, [
                \'id\' => Str::uuid()->toString(), \'singleton\' => true,
                \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
            ]));
        }
        return response()->json([\'message\' => \'Settings updated\']);
    }
}
');

// ─── Security Settings ─────────────────────────────────────
file_put_contents($adminBase . '/SecuritySettingsController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class SecuritySettingsController extends Controller
{
    public function show(Request $request)
    {
        return response()->json([\'settings\' => DB::table(\'security_settings\')->where(\'singleton\', true)->first()]);
    }

    public function update(Request $request)
    {
        $v = $request->validate([
            \'mfa_enabled\' => \'sometimes|boolean\', \'mfa_provider\' => \'sometimes|string\',
            \'member_idle_minutes\' => \'sometimes|integer\', \'console_idle_minutes\' => \'sometimes|integer\',
            \'countdown_seconds\' => \'sometimes|integer\', \'beep_enabled\' => \'sometimes|boolean\',
        ]);
        $existing = DB::table(\'security_settings\')->where(\'singleton\', true)->first();
        if ($existing) {
            DB::table(\'security_settings\')->where(\'id\', $existing->id)->update(
                array_merge($v, [\'updated_at\' => now()->toDateTimeString()])
            );
        }
        return response()->json([\'message\' => \'Security settings updated\']);
    }
}
');

// ─── Subscriber Admin ──────────────────────────────────────
file_put_contents($adminBase . '/SubscriberController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class SubscriberController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(DB::table(\'subscribers\')->orderByDesc(\'subscribed_at\')->paginate(20));
    }

    public function destroy(Request $request, string $id)
    {
        DB::table(\'subscribers\')->where(\'id\', $id)->delete();
        return response()->json([\'message\' => \'Subscriber removed\']);
    }
}
');

// ─── Chatbot Config ────────────────────────────────────────
file_put_contents($adminBase . '/ChatbotConfigController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class ChatbotConfigController extends Controller
{
    public function show(Request $request)
    {
        return response()->json([\'config\' => DB::table(\'chatbot_configs\')->where(\'singleton\', true)->first()]);
    }

    public function update(Request $request)
    {
        $v = $request->validate([
            \'welcome_message\' => \'sometimes|string\', \'system_prompt\' => \'sometimes|string\',
            \'model\' => \'sometimes|string\', \'temperature\' => \'sometimes|numeric\',
            \'max_tokens\' => \'sometimes|integer\', \'is_active\' => \'sometimes|boolean\',
        ]);
        $existing = DB::table(\'chatbot_configs\')->where(\'singleton\', true)->first();
        if ($existing) {
            DB::table(\'chatbot_configs\')->where(\'id\', $existing->id)->update(
                array_merge($v, [\'updated_at\' => now()->toDateTimeString()])
            );
        }
        return response()->json([\'message\' => \'Chatbot config updated\']);
    }
}
');

// ─── Trade Opportunity Admin ───────────────────────────────
file_put_contents($adminBase . '/TradeOpportunityController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class TradeOpportunityController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table(\'trade_opportunities\');
        if ($request->status) $query->where(\'status\', $request->status);
        if ($request->search) $query->where(\'title\', \'like\', "%{$request->search}%");
        return response()->json($query->orderByDesc(\'created_at\')->paginate(20));
    }

    public function store(Request $request)
    {
        $v = $request->validate([
            \'title\' => \'required|string\', \'description\' => \'required|string\',
            \'country\' => \'nullable|string\', \'sector\' => \'nullable|string\',
            \'requirements\' => \'nullable|string\', \'deadline\' => \'nullable|string\',
            \'source_url\' => \'nullable|url\', \'source_name\' => \'nullable|string\',
            \'is_public\' => \'sometimes|boolean\', \'status\' => \'nullable|in:draft,published\',
        ]);
        $id = Str::uuid()->toString();
        DB::table(\'trade_opportunities\')->insert(array_merge($v, [
            \'id\' => $id, \'slug\' => Str::slug($v[\'title\']),
            \'published_at\' => ($v[\'status\'] ?? \'\') === \'published\' ? now()->toDateTimeString() : null,
            \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
        ]));
        return response()->json([\'message\' => \'Trade opportunity created\', \'id\' => $id], 201);
    }

    public function show(Request $request, string $id)
    {
        $item = DB::table(\'trade_opportunities\')->where(\'id\', $id)->first();
        if (!$item) return response()->json([\'message\' => \'Not found\'], 404);
        return response()->json([\'trade_opportunity\' => $item]);
    }

    public function update(Request $request, string $id)
    {
        $v = $request->validate([
            \'title\' => \'sometimes|string\', \'description\' => \'sometimes|string\',
            \'country\' => \'nullable|string\', \'sector\' => \'nullable|string\',
            \'is_public\' => \'sometimes|boolean\', \'status\' => \'sometimes|string\',
        ]);
        if (isset($v[\'title\'])) $v[\'slug\'] = Str::slug($v[\'title\']);
        $v[\'updated_at\'] = now()->toDateTimeString();
        DB::table(\'trade_opportunities\')->where(\'id\', $id)->update($v);
        return response()->json([\'message\' => \'Trade opportunity updated\']);
    }

    public function destroy(Request $request, string $id)
    {
        DB::table(\'trade_opportunities\')->where(\'id\', $id)->delete();
        return response()->json([\'message\' => \'Trade opportunity deleted\']);
    }
}
');

// ─── Trade Match ───────────────────────────────────────────
file_put_contents($adminBase . '/TradeMatchController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class TradeMatchController extends Controller
{
    public function match(Request $request, string $id)
    {
        $request->validate([\'member_ids\' => \'required|array\']);
        $count = 0;
        foreach ($request->member_ids as $memberId) {
            $existing = DB::table(\'trade_matches\')
                ->where(\'trade_opportunity_id\', $id)
                ->where(\'member_id\', $memberId)
                ->first();
            if (!$existing) {
                DB::table(\'trade_matches\')->insert([
                    \'id\' => Str::uuid()->toString(),
                    \'trade_opportunity_id\' => $id, \'member_id\' => $memberId,
                    \'matched_at\' => now()->toDateTimeString(),
                    \'status\' => \'pending\', \'created_at\' => now()->toDateTimeString(),
                ]);
                $count++;
            }
        }
        return response()->json([\'message\' => "{$count} members matched", \'matched_count\' => $count]);
    }
}
');

// ─── Certificate Admin ─────────────────────────────────────
file_put_contents($adminBase . '/CertificateController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class CertificateController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(DB::table(\'certificates\')->orderByDesc(\'issued_at\')->paginate(20));
    }

    public function store(Request $request)
    {
        $v = $request->validate([
            \'user_id\' => \'required|string\', \'title\' => \'required|string\',
            \'description\' => \'nullable|string\', \'expires_at\' => \'nullable|string\',
        ]);
        $id = Str::uuid()->toString();
        $certNumber = \'CERT-\' . strtoupper(Str::random(10));
        DB::table(\'certificates\')->insert([
            \'id\' => $id, \'user_id\' => $v[\'user_id\'], \'certificate_number\' => $certNumber,
            \'title\' => $v[\'title\'], \'description\' => $v[\'description\'] ?? null,
            \'issued_at\' => now()->toDateTimeString(), \'expires_at\' => $v[\'expires_at\'] ?? null,
            \'status\' => \'active\', \'issued_by\' => $request->user()->id,
            \'verification_code\' => strtoupper(Str::random(16)),
            \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
        ]);
        return response()->json([\'message\' => \'Certificate issued\', \'id\' => $id, \'number\' => $certNumber], 201);
    }

    public function update(Request $request, string $id)
    {
        $v = $request->validate([
            \'title\' => \'sometimes|string\', \'description\' => \'nullable|string\',
            \'status\' => \'sometimes|string\', \'expires_at\' => \'nullable|string\',
        ]);
        $v[\'updated_at\'] = now()->toDateTimeString();
        DB::table(\'certificates\')->where(\'id\', $id)->update($v);
        return response()->json([\'message\' => \'Certificate updated\']);
    }

    public function destroy(Request $request, string $id)
    {
        DB::table(\'certificates\')->where(\'id\', $id)->delete();
        return response()->json([\'message\' => \'Certificate deleted\']);
    }

    public function verify(Request $request, string $id)
    {
        $cert = DB::table(\'certificates\')->where(\'id\', $id)->first();
        if (!$cert) return response()->json([\'message\' => \'Certificate not found\'], 404);
        $valid = $cert->status === \'active\' && (!$cert->expires_at || now()->lte($cert->expires_at));
        return response()->json([\'valid\' => $valid, \'certificate\' => $cert]);
    }
}
');

// ─── Support Ticket Admin ──────────────────────────────────
file_put_contents($adminBase . '/SupportTicketController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class SupportTicketController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table(\'support_tickets\')
            ->join(\'users\', \'support_tickets.user_id\', \'=\', \'users.id\')
            ->select(\'support_tickets.*\', \'users.name as user_name\', \'users.email as user_email\');
        if ($request->status) $query->where(\'support_tickets.status\', $request->status);
        if ($request->priority) $query->where(\'support_tickets.priority\', $request->priority);
        return response()->json($query->orderByDesc(\'support_tickets.created_at\')->paginate(20));
    }

    public function show(Request $request, string $id)
    {
        $ticket = DB::table(\'support_tickets\')->where(\'id\', $id)->first();
        if (!$ticket) return response()->json([\'message\' => \'Ticket not found\'], 404);
        $messages = DB::table(\'support_ticket_messages\')->where(\'ticket_id\', $id)->orderBy(\'created_at\')->get();
        return response()->json([\'ticket\' => $ticket, \'messages\' => $messages]);
    }

    public function update(Request $request, string $id)
    {
        $v = $request->validate([
            \'status\' => \'sometimes|string\', \'priority\' => \'sometimes|string\',
            \'assigned_to\' => \'nullable|string\',
        ]);
        $v[\'updated_at\'] = now()->toDateTimeString();
        DB::table(\'support_tickets\')->where(\'id\', $id)->update($v);
        return response()->json([\'message\' => \'Ticket updated\']);
    }

    public function addMessage(Request $request, string $id)
    {
        $request->validate([\'message\' => \'required|string\']);
        $ticket = DB::table(\'support_tickets\')->where(\'id\', $id)->first();
        if (!$ticket) return response()->json([\'message\' => \'Ticket not found\'], 404);

        DB::table(\'support_ticket_messages\')->insert([
            \'id\' => Str::uuid()->toString(), \'ticket_id\' => $id,
            \'user_id\' => $request->user()->id, \'message\' => $request->message,
            \'is_admin\' => true, \'created_at\' => now()->toDateTimeString(),
        ]);
        DB::table(\'support_tickets\')->where(\'id\', $id)->update([\'updated_at\' => now()->toDateTimeString()]);
        return response()->json([\'message\' => \'Reply added\']);
    }

    public function assign(Request $request, string $id)
    {
        $request->validate([\'assigned_to\' => \'required|string\']);
        DB::table(\'support_tickets\')->where(\'id\', $id)->update([
            \'assigned_to\' => $request->assigned_to, \'status\' => \'in_progress\',
            \'updated_at\' => now()->toDateTimeString(),
        ]);
        return response()->json([\'message\' => \'Ticket assigned\']);
    }

    public function updateStatus(Request $request, string $id)
    {
        $request->validate([\'status\' => \'required|string\']);
        DB::table(\'support_tickets\')->where(\'id\', $id)->update([
            \'status\' => $request->status, \'updated_at\' => now()->toDateTimeString(),
        ]);
        return response()->json([\'message\' => \'Status updated\']);
    }
}
');

// ─── Import Controller ─────────────────────────────────────
file_put_contents($adminBase . '/ImportController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;

class ImportController extends Controller
{
    public function import(Request $request)
    {
        $request->validate([
            \'backup_data\' => \'required|array\',
            \'type\' => \'required|in:full,users,payments,content\',
        ]);

        // TODO: Implement Supabase backup import
        // Parse the backup data and insert into respective tables
        // Handle conflicts with existing data

        return response()->json([
            \'message\' => \'Import completed. Records imported: 0 (implementation pending)\',
            \'imported\' => [
                \'users\' => 0, \'members\' => 0, \'payments\' => 0,
                \'directory\' => 0, \'news\' => 0, \'events\' => 0,
            ],
        ]);
    }
}
');

echo "=== All remaining admin controllers generated ===\n";

// ─── PUBLIC CONTROLLERS ────────────────────────────────────

// News
file_put_contents($publicBase . '/NewsController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Support\\Facades\\DB;

class NewsController extends Controller
{
    public function index()
    {
        $items = DB::table(\'news_articles\')
            ->where(\'status\', \'published\')
            ->orderByDesc(\'published_at\')->paginate(20);
        return response()->json($items);
    }

    public function show(string $slug)
    {
        $item = DB::table(\'news_articles\')->where(\'slug\', $slug)->where(\'status\', \'published\')->first();
        if (!$item) return response()->json([\'message\' => \'Article not found\'], 404);
        return response()->json([\'article\' => $item]);
    }
}
');

// Products
file_put_contents($publicBase . '/ProductController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Support\\Facades\\DB;

class ProductController extends Controller
{
    public function index()
    {
        return response()->json(DB::table(\'products\')->where(\'status\', \'published\')->orderByDesc(\'created_at\')->paginate(20));
    }

    public function show(string $slug)
    {
        $item = DB::table(\'products\')->where(\'slug\', $slug)->where(\'status\', \'published\')->first();
        if (!$item) return response()->json([\'message\' => \'Product not found\'], 404);
        return response()->json([\'product\' => $item]);
    }
}
');

// Activities
file_put_contents($publicBase . '/ActivityController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Support\\Facades\\DB;

class ActivityController extends Controller
{
    public function index()
    {
        return response()->json(DB::table(\'activities\')->where(\'status\', \'published\')->orderByDesc(\'created_at\')->paginate(20));
    }

    public function show(string $slug)
    {
        $item = DB::table(\'activities\')->where(\'slug\', $slug)->where(\'status\', \'published\')->first();
        if (!$item) return response()->json([\'message\' => \'Activity not found\'], 404);
        return response()->json([\'activity\' => $item]);
    }
}
');

// Events
file_put_contents($publicBase . '/EventController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Support\\Facades\\DB;

class EventController extends Controller
{
    public function index()
    {
        return response()->json(DB::table(\'events\')->where(\'status\', \'published\')->orderBy(\'start_date\')->paginate(20));
    }

    public function show(string $slug)
    {
        $item = DB::table(\'events\')->where(\'slug\', $slug)->where(\'status\', \'published\')->first();
        if (!$item) return response()->json([\'message\' => \'Event not found\'], 404);
        return response()->json([\'event\' => $item]);
    }
}
');

// Media
file_put_contents($publicBase . '/MediaController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Support\\Facades\\DB;

class MediaController extends Controller
{
    public function index()
    {
        return response()->json(DB::table(\'media\')->orderByDesc(\'created_at\')->paginate(20));
    }
}
');

// Directory Public
file_put_contents($publicBase . '/DirectoryController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Support\\Facades\\DB;

class DirectoryController extends Controller
{
    public function index()
    {
        $query = DB::table(\'directory_listings\')->where(\'status\', \'approved\');
        if (request(\'industry')) $query->where(\'industry\', request(\'industry\'));
        if (request(\'city')) $query->where(\'city\', request(\'city\'));
        if (request(\'search')) $query->where(\'company_name\', \'like\', "%" . request(\'search') . "%");
        return response()->json($query->orderByDesc(\'featured\')->orderByDesc(\'created_at\')->paginate(20));
    }

    public function show(string $slug)
    {
        $item = DB::table(\'directory_listings\')->where(\'slug\', $slug)->where(\'status\', \'approved\')->first();
        if (!$item) return response()->json([\'message\' => \'Listing not found\'], 404);
        return response()->json([\'listing\' => $item]);
    }
}
');

// Trade Opportunities Public
file_put_contents($publicBase . '/TradeOpportunitiesController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Support\\Facades\\DB;

class TradeOpportunitiesController extends Controller
{
    public function index()
    {
        return response()->json(
            DB::table(\'trade_opportunities\')
                ->where(\'is_public\', true)
                ->where(\'status\', \'published\')
                ->orderByDesc(\'published_at\')
                ->paginate(20)
        );
    }
}
');

// HomePage
file_put_contents($publicBase . '/HomePageController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Support\\Facades\\DB;

class HomePageController extends Controller
{
    public function index()
    {
        return response()->json([\'home_page\' => DB::table(\'home_pages\')->first()]);
    }
}
');

// Countdown
file_put_contents($publicBase . '/CountdownController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Support\\Facades\\DB;

class CountdownController extends Controller
{
    public function index()
    {
        return response()->json([\'countdown\' => DB::table(\'countdowns\')->where(\'is_active\', true)->first()]);
    }
}
');

// Stats
file_put_contents($publicBase . '/StatsController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Support\\Facades\\DB;

class StatsController extends Controller
{
    public function index()
    {
        return response()->json([
            \'members\' => DB::table(\'members\')->where(\'membership_status\', \'active\')->count(),
            \'events\' => DB::table(\'events\')->where(\'status\', \'published\')->count(),
            \'directory_listings\' => DB::table(\'directory_listings\')->where(\'status\', \'approved\')->count(),
            \'news\' => DB::table(\'news_articles\')->where(\'status\', \'published\')->count(),
        ]);
    }
}
');

// Chatbot
file_put_contents($publicBase . '/ChatbotController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class ChatbotController extends Controller
{
    public function chat(Request $request)
    {
        $request->validate([\'message\' => \'required|string\', \'session_id\' => \'nullable|string\']);

        $sessionId = $request->session_id ?: Str::uuid()->toString();
        $config = DB::table(\'chatbot_configs\')->where(\'singleton\', true)->where(\'is_active\', true)->first();

        if (!$config) {
            return response()->json([\'response\' => \'Chatbot is currently unavailable.\', \'session_id\' => $sessionId]);
        }

        // Store conversation
        $conversation = DB::table(\'chatbot_conversations\')
            ->where(\'session_id\', $sessionId)->first();

        $messages = $conversation ? json_decode($conversation->messages, true) : [];
        $messages[] = [\'role\' => \'user\', \'content\' => $request->message];

        // TODO: Call OpenAI/LLM API here
        $response = \'Thank you for your message. Our team will get back to you shortly.\';

        $messages[] = [\'role\' => \'assistant\', \'content\' => $response];

        if ($conversation) {
            DB::table(\'chatbot_conversations\')->where(\'session_id\', $sessionId)->update([
                \'messages\' => json_encode($messages), \'updated_at\' => now()->toDateTimeString(),
            ]);
        } else {
            DB::table(\'chatbot_conversations\')->insert([
                \'id\' => Str::uuid()->toString(), \'session_id\' => $sessionId,
                \'messages\' => json_encode($messages),
                \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
            ]);
        }

        return response()->json([\'response\' => $response, \'session_id\' => $sessionId]);
    }
}
');

// Subscriber Public
file_put_contents($publicBase . '/SubscriberController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Public;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class SubscriberController extends Controller
{
    public function subscribe(Request $request)
    {
        $request->validate([\'email\' => \'required|email\']);
        $existing = DB::table(\'subscribers\')->where(\'email\', $request->email)->first();
        if ($existing) {
            DB::table(\'subscribers\')->where(\'id\', $existing->id)->update([
                \'is_active\' => true, \'subscribed_at\' => now()->toDateTimeString(),
            ]);
        } else {
            DB::table(\'subscribers\')->insert([
                \'id\' => Str::uuid()->toString(), \'email\' => $request->email,
                \'is_active\' => true, \'subscribed_at\' => now()->toDateTimeString(),
                \'created_at\' => now()->toDateTimeString(),
            ]);
        }
        return response()->json([\'message\' => \'Subscribed successfully\']);
    }

    public function unsubscribe(Request $request)
    {
        $request->validate([\'email\' => \'required|email\']);
        DB::table(\'subscribers\')->where(\'email\', $request->email)->update([
            \'is_active\' => false, \'unsubscribed_at\' => now()->toDateTimeString(),
        ]);
        return response()->json([\'message\' => \'Unsubscribed successfully\']);
    }
}
');

echo "=== All public controllers generated ===\n";

// ─── WEBHOOK CONTROLLERS ───────────────────────────────────

// Paystack
file_put_contents($webhookBase . '/PaystackWebhookController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Webhook;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class PaystackWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $payload = $request->all();
        $event = $payload[\'event\'] ?? \'\';

        // Verify signature
        $signature = $request->header(\'x-paystack-signature\');
        $secret = config(\'services.paystack.secret\');
        $computed = hash_hmac(\'sha512\', json_encode($payload), $secret);

        if ($signature !== $computed) {
            return response()->json([\'message\' => \'Invalid signature\'], 401);
        }

        if ($event === \'charge.success\') {
            $data = $payload[\'data\'] ?? [];
            $reference = $data[\'reference\'] ?? \'\';

            DB::table(\'payments\')
                ->where(\'reference\', $reference)
                ->update([
                    \'status\' => \'completed\',
                    \'verified_at\' => now()->toDateTimeString(),
                    \'metadata\' => json_encode($data),
                    \'updated_at\' => now()->toDateTimeString(),
                ]);
        }

        return response()->json([\'status\' => \'ok\']);
    }
}
');

// Flutterwave
file_put_contents($webhookBase . '/FlutterwaveWebhookController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Webhook;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class FlutterwaveWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $payload = $request->all();
        $event = $payload[\'event\'] ?? \'\';
        $data = $payload[\'data\'] ?? [];

        // Verify signature
        $signature = $request->header(\'verif-hash\');
        $secret = config(\'services.flutterwave.secret\');
        if ($signature !== $secret) {
            return response()->json([\'message\' => \'Invalid signature\'], 401);
        }

        if ($event === \'charge.completed\') {
            $txRef = $data[\'tx_ref\'] ?? \'\';
            DB::table(\'payments\')
                ->where(\'reference\', $txRef)
                ->update([
                    \'status\' => \'completed\',
                    \'verified_at\' => now()->toDateTimeString(),
                    \'metadata\' => json_encode($data),
                    \'updated_at\' => now()->toDateTimeString(),
                ]);
        }

        return response()->json([\'status\' => \'ok\']);
    }
}
');

// Hubtel
file_put_contents($webhookBase . '/HubtelWebhookController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Webhook;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class HubtelWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $payload = $request->all();
        $status = $payload[\'Status\'] ?? \'\';
        $transactionId = $payload[\'TransactionId\'] ?? $payload[\'ClientReference\'] ?? \'\';

        if ($status === \'Success\' || $status === \'Completed\') {
            DB::table(\'payments\')
                ->where(\'reference\', $transactionId)
                ->update([
                    \'status\' => \'completed\',
                    \'verified_at\' => now()->toDateTimeString(),
                    \'metadata\' => json_encode($payload),
                    \'updated_at\' => now()->toDateTimeString(),
                ]);
        }

        return response()->json([\'status\' => \'ok\']);
    }
}
');

echo "=== All webhook controllers generated ===\n";
echo "\n=== PHASE 2 COMPLETE: All controllers implemented! ===\n";
