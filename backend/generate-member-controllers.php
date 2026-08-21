<?php
/**
 * Generate all Member controller implementations
 */

$base = __DIR__ . '/app/Http/Controllers/Api/Member';

// ─── Dashboard Controller ──────────────────────────────────
file_put_contents($base . '/DashboardController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Member;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user()->load([\'member\', \'roles\']);
        $member = $user->member;

        $recentPayments = DB::table(\'payments\')
            ->where(\'user_id\', $user->id)
            ->orderByDesc(\'created_at\')
            ->limit(5)
            ->get();

        $applications = DB::table(\'membership_applications\')
            ->where(\'user_id\', $user->id)
            ->orderByDesc(\'submitted_at\')
            ->limit(5)
            ->get();

        $tickets = DB::table(\'support_tickets\')
            ->where(\'user_id\', $user->id)
            ->orderByDesc(\'created_at\')
            ->limit(5)
            ->get();

        $certificates = DB::table(\'certificates\')
            ->where(\'user_id\', $user->id)
            ->orderByDesc(\'issued_at\')
            ->limit(5)
            ->get();

        return response()->json([
            \'user\' => [
                \'id\' => $user->id,
                \'name\' => $user->name,
                \'email\' => $user->email,
                \'avatar_url\' => $user->avatar_url,
                \'roles\' => $user->roles->pluck(\'role\'),
            ],
            \'member\' => $member ? [
                \'membership_number\' => $member->membership_number,
                \'membership_tier\' => $member->membership_tier,
                \'membership_status\' => $member->membership_status,
            ] : null,
            \'recent_payments\' => $recentPayments,
            \'applications\' => $applications,
            \'support_tickets\' => $tickets,
            \'certificates\' => $certificates,
        ]);
    }
}
');

// ─── Directory Controller ──────────────────────────────────
file_put_contents($base . '/DirectoryController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Member;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class DirectoryController extends Controller
{
    public function myListing(Request $request)
    {
        $listing = DB::table(\'directory_listings\')
            ->where(\'user_id\', $request->user()->id)
            ->first();

        if (!$listing) {
            return response()->json([\'message\' => \'No directory listing found\', \'listing\' => null]);
        }

        return response()->json([\'listing\' => $listing]);
    }

    public function createListing(Request $request)
    {
        $validated = $request->validate([
            \'company_name\' => \'required|string|max:255\',
            \'description\' => \'required|string\',
            \'industry\' => \'nullable|string|max:255\',
            \'website\' => \'nullable|url|max:500\',
            \'phone\' => \'nullable|string|max:50\',
            \'address\' => \'nullable|string|max:500\',
            \'city\' => \'nullable|string|max:255\',
            \'services\' => \'nullable\',
        ]);

        $existing = DB::table(\'directory_listings\')
            ->where(\'user_id\', $request->user()->id)
            ->first();

        if ($existing) {
            return response()->json([\'message\' => \'You already have a directory listing. Update it instead.\'], 422);
        }

        $slug = Str::slug($validated[\'company_name\']);
        $id = Str::uuid()->toString();

        DB::table(\'directory_listings\')->insert([
            \'id\' => $id,
            \'user_id\' => $request->user()->id,
            \'member_id\' => $request->user()->member?->id,
            \'company_name\' => $validated[\'company_name\'],
            \'slug\' => $slug,
            \'description\' => $validated[\'description\'],
            \'industry\' => $validated[\'industry\'] ?? null,
            \'website\' => $validated[\'website\'] ?? null,
            \'phone\' => $validated[\'phone\'] ?? null,
            \'address\' => $validated[\'address\'] ?? null,
            \'city\' => $validated[\'city\'] ?? null,
            \'services\' => $validated[\'services\'] ?? null,
            \'status\' => \'pending\',
            \'created_at\' => now()->toDateTimeString(),
            \'updated_at\' => now()->toDateTimeString(),
        ]);

        return response()->json([\'message\' => \'Directory listing submitted for approval\', \'id\' => $id], 201);
    }

    public function updateListing(Request $request)
    {
        $validated = $request->validate([
            \'company_name\' => \'sometimes|string|max:255\',
            \'description\' => \'sometimes|string\',
            \'industry\' => \'nullable|string|max:255\',
            \'website\' => \'nullable|url|max:500\',
            \'phone\' => \'nullable|string|max:50\',
            \'address\' => \'nullable|string|max:500\',
            \'city\' => \'nullable|string|max:255\',
            \'services\' => \'nullable\',
        ]);

        $updated = DB::table(\'directory_listings\')
            ->where(\'user_id\', $request->user()->id)
            ->update(array_merge($validated, [\'updated_at\' => now()->toDateTimeString(), \'status\' => \'pending\']));

        if (!$updated) {
            return response()->json([\'message\' => \'Directory listing not found\'], 404);
        }

        return response()->json([\'message\' => \'Directory listing updated and resubmitted for approval\']);
    }
}
');

// ─── Payment Controller ────────────────────────────────────
file_put_contents($base . '/PaymentController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Member;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $payments = DB::table(\'payments\')
            ->where(\'user_id\', $request->user()->id)
            ->orderByDesc(\'created_at\')
            ->paginate(20);

        return response()->json($payments);
    }

    public function show(Request $request, string $id)
    {
        $payment = DB::table(\'payments\')
            ->where(\'id\', $id)
            ->where(\'user_id\', $request->user()->id)
            ->first();

        if (!$payment) {
            return response()->json([\'message\' => \'Payment not found\'], 404);
        }

        return response()->json([\'payment\' => $payment]);
    }

    public function initialize(Request $request)
    {
        $validated = $request->validate([
            \'amount\' => \'required|numeric|min:1\',
            \'currency\' => \'nullable|string|max:3\',
            \'provider\' => \'required|in:paystack,flutterwave,hubtel\',
            \'description\' => \'nullable|string|max:500\',
            \'subscription_tier\' => \'nullable|string\',
            \'payment_type\' => \'nullable|string\',
        ]);

        $user = $request->user();
        $reference = strtoupper(Str::random(12)) . time();

        $paymentId = Str::uuid()->toString();
        DB::table(\'payments\')->insert([
            \'id\' => $paymentId,
            \'user_id\' => $user->id,
            \'member_id\' => $user->member?->id,
            \'amount\' => $validated[\'amount\'],
            \'currency\' => $validated[\'currency\'] ?? \'GHS\',
            \'provider\' => $validated[\'provider\'],
            \'reference\' => $reference,
            \'status\' => \'pending\',
            \'description\' => $validated[\'description\'] ?? null,
            \'subscription_tier\' => $validated[\'subscription_tier\'] ?? null,
            \'payment_type\' => $validated[\'payment_type\'] ?? \'membership\',
            \'created_at\' => now()->toDateTimeString(),
            \'updated_at\' => now()->toDateTimeString(),
        ]);

        // Get payment config for the provider
        $config = DB::table(\'payment_configs\')
            ->where(\'provider\', $validated[\'provider\'])
            ->where(\'is_active\', true)
            ->first();

        $redirectUrl = config(\'app.url\') . \'/payments/callback?reference=\' . $reference;

        // Build provider-specific initialization response
        $paymentData = [
            \'payment_id\' => $paymentId,
            \'reference\' => $reference,
            \'amount\' => $validated[\'amount\'],
            \'currency\' => $validated[\'currency\'] ?? \'GHS\',
            \'provider\' => $validated[\'provider\'],
            \'redirect_url\' => $redirectUrl,
            \'email\' => $user->email,
        ];

        // Provider-specific authorization URLs would be generated here
        switch ($validated[\'provider\']) {
            case \'paystack\':
                $paymentData[\'authorization_url\'] = \'https://checkout.paystack.com/\' . $reference;
                $paymentData[\'access_code\'] = \'test_\' . $reference;
                break;
            case \'flutterwave\':
                $paymentData[\'flutterwave_url\'] = \'https://checkout.flutterwave.com/o/\' . $reference;
                $paymentData[\'flw_ref\'] = $reference;
                break;
            case \'hubtel\':
                $paymentData[\'checkout_url\'] = \'https://pay.hubtel.com/\' . $reference;
                break;
        }

        return response()->json($paymentData);
    }

    public function initializePublic(Request $request)
    {
        return $this->initialize($request);
    }

    public function initializePublicFw(Request $request)
    {
        return $this->initialize($request);
    }

    public function initializePublicHt(Request $request)
    {
        return $this->initialize($request);
    }
}
');

// ─── Application Controller ────────────────────────────────
file_put_contents($base . '/ApplicationController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Member;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class ApplicationController extends Controller
{
    public function index(Request $request)
    {
        $applications = DB::table(\'membership_applications\')
            ->where(\'user_id\', $request->user()->id)
            ->orderByDesc(\'submitted_at\')
            ->get();

        return response()->json([\'applications\' => $applications]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            \'first_name\' => \'required|string|max:255\',
            \'last_name\' => \'required|string|max:255\',
            \'email\' => \'required|email\',
            \'phone\' => \'nullable|string|max:50\',
            \'company_name\' => \'required|string|max:255\',
            \'position\' => \'nullable|string|max:255\',
            \'industry\' => \'nullable|string|max:255\',
            \'membership_tier\' => \'required|string\',
        ]);

        $id = Str::uuid()->toString();
        DB::table(\'membership_applications\')->insert([
            \'id\' => $id,
            \'user_id\' => $request->user()->id,
            \'first_name\' => $validated[\'first_name\'],
            \'last_name\' => $validated[\'last_name\'],
            \'email\' => $validated[\'email\'],
            \'phone\' => $validated[\'phone\'] ?? null,
            \'company_name\' => $validated[\'company_name\'],
            \'position\' => $validated[\'position\'] ?? null,
            \'industry\' => $validated[\'industry\'] ?? null,
            \'membership_tier\' => $validated[\'membership_tier\'],
            \'status\' => \'pending\',
            \'submitted_at\' => now()->toDateTimeString(),
            \'created_at\' => now()->toDateTimeString(),
            \'updated_at\' => now()->toDateTimeString(),
        ]);

        return response()->json([\'message\' => \'Application submitted\', \'id\' => $id], 201);
    }

    public function show(Request $request, string $id)
    {
        $application = DB::table(\'membership_applications\')
            ->where(\'id\', $id)
            ->where(\'user_id\', $request->user()->id)
            ->first();

        if (!$application) {
            return response()->json([\'message\' => \'Application not found\'], 404);
        }

        return response()->json([\'application\' => $application]);
    }

    public function adminIndex(Request $request)
    {
        $applications = DB::table(\'membership_applications\')
            ->orderByDesc(\'submitted_at\')
            ->paginate(20);

        return response()->json($applications);
    }

    public function adminShow(Request $request, string $id)
    {
        $application = DB::table(\'membership_applications\')
            ->where(\'id\', $id)
            ->first();

        if (!$application) {
            return response()->json([\'message\' => \'Application not found\'], 404);
        }

        return response()->json([\'application\' => $application]);
    }

    public function updateStatus(Request $request, string $id)
    {
        $validated = $request->validate([
            \'status\' => \'required|in:approved,rejected,under_review\',
            \'notes\' => \'nullable|string\',
        ]);

        $updated = DB::table(\'membership_applications\')
            ->where(\'id\', $id)
            ->update([
                \'status\' => $validated[\'status\'],
                \'notes\' => $validated[\'notes\'] ?? null,
                \'reviewed_at\' => now()->toDateTimeString(),
                \'reviewed_by\' => $request->user()->id,
                \'updated_at\' => now()->toDateTimeString(),
            ]);

        if (!$updated) {
            return response()->json([\'message\' => \'Application not found\'], 404);
        }

        // If approved, create member record and assign role
        if ($validated[\'status\'] === \'approved\') {
            $app = DB::table(\'membership_applications\')->where(\'id\', $id)->first();
            $this->activateMember($app);
        }

        return response()->json([\'message\' => \'Application status updated\']);
    }

    private function activateMember($app)
    {
        // Update the user\'s member record
        DB::table(\'members\')
            ->where(\'user_id\', $app->user_id)
            ->update([
                \'membership_tier\' => $app->membership_tier,
                \'membership_status\' => \'active\',
                \'first_name\' => $app->first_name,
                \'last_name\' => $app->last_name,
                \'company_name\' => $app->company_name,
                \'position\' => $app->position,
                \'industry\' => $app->industry,
                \'membership_number\' => \'FAGE-\' . strtoupper(Str::random(8)),
                \'joining_date\' => now()->toDateTimeString(),
                \'updated_at\' => now()->toDateTimeString(),
            ]);

        // Assign member role
        $existingRole = DB::table(\'user_roles\')
            ->where(\'user_id\', $app->user_id)
            ->where(\'role\', \'user\')
            ->first();

        if ($existingRole) {
            DB::table(\'user_roles\')
                ->where(\'id\', $existingRole->id)
                ->update([\'role\' => \'user\']);
        }
    }
}
');

// ─── Certificate Controller ────────────────────────────────
file_put_contents($base . '/CertificateController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Member;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class CertificateController extends Controller
{
    public function index(Request $request)
    {
        $certificates = DB::table(\'certificates\')
            ->where(\'user_id\', $request->user()->id)
            ->orderByDesc(\'issued_at\')
            ->get();

        return response()->json([\'certificates\' => $certificates]);
    }

    public function download(Request $request, string $id)
    {
        $cert = DB::table(\'certificates\')
            ->where(\'id\', $id)
            ->where(\'user_id\', $request->user()->id)
            ->first();

        if (!$cert) {
            return response()->json([\'message\' => \'Certificate not found\'], 404);
        }

        // In production, generate PDF
        return response()->json([
            \'certificate\' => $cert,
            \'download_url\' => $cert->download_url,
            \'message\' => \'Certificate download link generated\',
        ]);
    }
}
');

// ─── Resource Controller ───────────────────────────────────
file_put_contents($base . '/ResourceController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Member;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class ResourceController extends Controller
{
    public function index(Request $request)
    {
        $resources = DB::table(\'membership_resources\')
            ->orderByDesc(\'created_at\')
            ->get();

        return response()->json([\'resources\' => $resources]);
    }
}
');

// ─── Trade Controller ──────────────────────────────────────
file_put_contents($base . '/TradeController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Member;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class TradeController extends Controller
{
    public function index(Request $request)
    {
        $opportunities = DB::table(\'trade_opportunities\')
            ->where(\'is_public\', true)
            ->where(\'status\', \'published\')
            ->orderByDesc(\'published_at\')
            ->paginate(20);

        return response()->json($opportunities);
    }

    public function show(Request $request, string $id)
    {
        $opportunity = DB::table(\'trade_opportunities\')
            ->where(\'id\', $id)
            ->first();

        if (!$opportunity) {
            return response()->json([\'message\' => \'Trade opportunity not found\'], 404);
        }

        return response()->json([\'trade_opportunity\' => $opportunity]);
    }
}
');

// ─── Support Ticket Controller ─────────────────────────────
file_put_contents($base . '/SupportTicketController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Member;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class SupportTicketController extends Controller
{
    public function index(Request $request)
    {
        $tickets = DB::table(\'support_tickets\')
            ->where(\'user_id\', $request->user()->id)
            ->orderByDesc(\'created_at\')
            ->paginate(20);

        return response()->json($tickets);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            \'subject\' => \'required|string|max:255\',
            \'description\' => \'required|string\',
            \'category\' => \'nullable|string\',
            \'priority\' => \'nullable|in:low,medium,high,urgent\',
        ]);

        $id = Str::uuid()->toString();
        DB::table(\'support_tickets\')->insert([
            \'id\' => $id,
            \'user_id\' => $request->user()->id,
            \'subject\' => $validated[\'subject\'],
            \'description\' => $validated[\'description\'],
            \'category\' => $validated[\'category\'] ?? \'general\',
            \'priority\' => $validated[\'priority\'] ?? \'medium\',
            \'status\' => \'open\',
            \'created_at\' => now()->toDateTimeString(),
        ]);

        // Add initial message
        DB::table(\'support_ticket_messages\')->insert([
            \'id\' => Str::uuid()->toString(),
            \'ticket_id\' => $id,
            \'user_id\' => $request->user()->id,
            \'message\' => $validated[\'description\'],
            \'is_admin\' => false,
            \'created_at\' => now()->toDateTimeString(),
        ]);

        return response()->json([\'message\' => \'Ticket created\', \'id\' => $id], 201);
    }

    public function show(Request $request, string $id)
    {
        $ticket = DB::table(\'support_tickets\')
            ->where(\'id\', $id)
            ->where(\'user_id\', $request->user()->id)
            ->first();

        if (!$ticket) {
            return response()->json([\'message\' => \'Ticket not found\'], 404);
        }

        $messages = DB::table(\'support_ticket_messages\')
            ->where(\'ticket_id\', $id)
            ->orderBy(\'created_at\')
            ->get();

        return response()->json([\'ticket\' => $ticket, \'messages\' => $messages]);
    }

    public function addMessage(Request $request, string $id)
    {
        $request->validate([\'message\' => \'required|string\']);

        $ticket = DB::table(\'support_tickets\')
            ->where(\'id\', $id)
            ->where(\'user_id\', $request->user()->id)
            ->first();

        if (!$ticket) {
            return response()->json([\'message\' => \'Ticket not found\'], 404);
        }

        DB::table(\'support_ticket_messages\')->insert([
            \'id\' => Str::uuid()->toString(),
            \'ticket_id\' => $id,
            \'user_id\' => $request->user()->id,
            \'message\' => $request->message,
            \'is_admin\' => false,
            \'created_at\' => now()->toDateTimeString(),
        ]);

        return response()->json([\'message\' => \'Reply added\']);
    }
}
');

// ─── Email Preferences Controller ──────────────────────────
file_put_contents($base . '/EmailPreferencesController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Member;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class EmailPreferencesController extends Controller
{
    public function show(Request $request)
    {
        $prefs = DB::table(\'email_preferences\')
            ->where(\'user_id\', $request->user()->id)
            ->first();

        if (!$prefs) {
            // Create default preferences
            $id = Str::uuid()->toString();
            DB::table(\'email_preferences\')->insert([
                \'id\' => $id,
                \'user_id\' => $request->user()->id,
                \'newsletters\' => true,
                \'event_alerts\' => true,
                \'trade_notices\' => true,
                \'payment_reminders\' => true,
                \'created_at\' => now()->toDateTimeString(),
                \'updated_at\' => now()->toDateTimeString(),
            ]);
            $prefs = DB::table(\'email_preferences\')->where(\'id\', $id)->first();
        }

        return response()->json([\'preferences\' => $prefs]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            \'newsletters\' => \'sometimes|boolean\',
            \'event_alerts\' => \'sometimes|boolean\',
            \'trade_notices\' => \'sometimes|boolean\',
            \'payment_reminders\' => \'sometimes|boolean\',
        ]);

        $existing = DB::table(\'email_preferences\')
            ->where(\'user_id\', $request->user()->id)
            ->first();

        if ($existing) {
            DB::table(\'email_preferences\')
                ->where(\'user_id\', $request->user()->id)
                ->update(array_merge($validated, [\'updated_at\' => now()->toDateTimeString()]));
        } else {
            DB::table(\'email_preferences\')->insert(array_merge([
                \'id\' => Str::uuid()->toString(),
                \'user_id\' => $request->user()->id,
                \'created_at\' => now()->toDateTimeString(),
            ], $validated));
        }

        return response()->json([\'message\' => \'Email preferences updated\']);
    }
}
');

echo "=== All Member controllers generated! ===\n";
