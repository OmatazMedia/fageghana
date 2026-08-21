<?php
/**
 * Generate Admin controller implementations
 */

$base = __DIR__ . '/app/Http/Controllers/Api/Admin';

// ─── Admin Dashboard ───────────────────────────────────────
file_put_contents($base . '/DashboardController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        return $this->stats($request);
    }

    public function stats(Request $request)
    {
        $totalUsers = DB::table(\'users\')->count();
        $totalMembers = DB::table(\'members\')->where(\'membership_status\', \'active\')->count();
        $pendingApplications = DB::table(\'membership_applications\')->where(\'status\', \'pending\')->count();
        $totalPayments = DB::table(\'payments\')->where(\'status\', \'completed\')->sum(\'amount\');
        $recentPayments = DB::table(\'payments\')->orderByDesc(\'created_at\')->limit(10)->get();
        $openTickets = DB::table(\'support_tickets\')->where(\'status\', \'open\')->count();
        $totalDirectory = DB::table(\'directory_listings\')->where(\'status\', \'approved\')->count();
        $pendingDirectory = DB::table(\'directory_listings\')->where(\'status\', \'pending\')->count();
        $totalNews = DB::table(\'news_articles\')->count();
        $totalEvents = DB::table(\'events\')->count();
        $totalProducts = DB::table(\'products\')->count();
        $subscribers = DB::table(\'subscribers\')->where(\'is_active\', true)->count();
        $recentMembers = DB::table(\'members\')->orderByDesc(\'created_at\')->limit(5)->get();

        return response()->json([
            \'overview\' => [
                \'total_users\' => $totalUsers,
                \'active_members\' => $totalMembers,
                \'pending_applications\' => $pendingApplications,
                \'total_revenue\' => (float) $totalPayments,
                \'open_tickets\' => $openTickets,
                \'directory_listings\' => $totalDirectory,
                \'pending_directory_approvals\' => $pendingDirectory,
                \'subscribers\' => $subscribers,
            ],
            \'content\' => [
                \'news\' => $totalNews,
                \'events\' => $totalEvents,
                \'products\' => $totalProducts,
            ],
            \'recent_payments\' => $recentPayments,
            \'recent_members\' => $recentMembers,
        ]);
    }
}
');

// ─── Admin User Management ─────────────────────────────────
file_put_contents($base . '/AdminController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use App\\Models\\User;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class AdminController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with([\'roles\', \'member\']);

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where(\'name\', \'like\', "%{$request->search}%")
                  ->orWhere(\'email\', \'like\', "%{$request->search}%");
            });
        }

        $users = $query->orderByDesc(\'created_at\')->paginate(20);
        return response()->json($users);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            \'name\' => \'required|string|max:255\',
            \'email\' => \'required|email|unique:users\',
            \'password\' => \'required|string|min:8\',
            \'role\' => \'required|string\',
            \'phone\' => \'nullable|string\',
        ]);

        $user = User::create([
            \'name\' => $validated[\'name\'],
            \'email\' => $validated[\'email\'],
            \'password\' => \\Illuminate\\Support\\Facades\\Hash::make($validated[\'password\']),
            \'phone\' => $validated[\'phone\'] ?? null,
        ]);

        $user->roles()->create([\'role\' => $validated[\'role\']]);

        return response()->json([\'message\' => \'User created\', \'user\' => $user], 201);
    }

    public function show(Request $request, string $id)
    {
        $user = User::with([\'roles\', \'member\'])->find($id);
        if (!$user) return response()->json([\'message\' => \'User not found\'], 404);
        return response()->json([\'user\' => $user]);
    }

    public function update(Request $request, string $id)
    {
        $user = User::find($id);
        if (!$user) return response()->json([\'message\' => \'User not found\'], 404);

        $validated = $request->validate([
            \'name\' => \'sometimes|string|max:255\',
            \'email\' => \'sometimes|email\',
            \'phone\' => \'nullable|string\',
            \'password\' => \'sometimes|string|min:8\',
        ]);

        if (isset($validated[\'password\'])) {
            $validated[\'password\'] = \\Illuminate\\Support\\Facades\\Hash::make($validated[\'password\']);
        }

        $user->update(collect($validated)->filter()->toArray());
        return response()->json([\'message\' => \'User updated\', \'user\' => $user->fresh([\'roles\'])]);
    }

    public function destroy(Request $request, string $id)
    {
        $user = User::find($id);
        if (!$user) return response()->json([\'message\' => \'User not found\'], 404);
        $user->tokens()->delete();
        $user->delete();
        return response()->json([\'message\' => \'User deleted\']);
    }

    public function updateRole(Request $request, string $id)
    {
        $request->validate([\'role\' => \'required|string\']);
        $user = User::find($id);
        if (!$user) return response()->json([\'message\' => \'User not found\'], 404);

        $user->roles()->delete();
        $user->roles()->create([\'role\' => $request->role]);

        return response()->json([\'message\' => \'Role updated\', \'roles\' => [$request->role]]);
    }

    public function updateStatus(Request $request, string $id)
    {
        $request->validate([\'status\' => \'required|string\']);
        $user = User::find($id);
        if (!$user) return response()->json([\'message\' => \'User not found\'], 404);

        if ($user->member) {
            $user->member->update([\'membership_status\' => $request->status]);
        }

        return response()->json([\'message\' => \'Status updated\']);
    }
}
');

// ─── Member Management ─────────────────────────────────────
file_put_contents($base . '/MemberManagementController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class MemberManagementController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table(\'members\')->join(\'users\', \'members.user_id\', \'=\', \'users.id\')
            ->select(\'members.*\', \'users.name\', \'users.email\', \'users.avatar_url\');

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where(\'members.company_name\', \'like\', "%{$request->search}%")
                  ->orWhere(\'members.first_name\', \'like\', "%{$request->search}%")
                  ->orWhere(\'members.last_name\', \'like\', "%{$request->search}%");
            });
        }
        if ($request->status) {
            $query->where(\'members.membership_status\', $request->status);
        }
        if ($request->tier) {
            $query->where(\'members.membership_tier\', $request->tier);
        }

        $members = $query->orderByDesc(\'members.created_at\')->paginate(20);
        return response()->json($members);
    }

    public function show(Request $request, string $id)
    {
        $member = DB::table(\'members\')->where(\'id\', $id)->first();
        if (!$member) return response()->json([\'message\' => \'Member not found\'], 404);

        $user = DB::table(\'users\')->where(\'id\', $member->user_id)->first();
        $payments = DB::table(\'payments\')->where(\'user_id\', $member->user_id)->orderByDesc(\'created_at\')->limit(10)->get();

        return response()->json([\'member\' => $member, \'user\' => $user, \'recent_payments\' => $payments]);
    }

    public function update(Request $request, string $id)
    {
        $member = DB::table(\'members\')->where(\'id\', $id)->first();
        if (!$member) return response()->json([\'message\' => \'Member not found\'], 404);

        $validated = $request->validate([
            \'membership_tier\' => \'sometimes|string\',
            \'membership_status\' => \'sometimes|string\',
            \'company_name\' => \'sometimes|string\',
            \'position\' => \'sometimes|string\',
            \'industry\' => \'sometimes|string\',
        ]);

        DB::table(\'members\')->where(\'id\', $id)->update(
            array_merge($validated, [\'updated_at\' => now()->toDateTimeString()])
        );

        return response()->json([\'message\' => \'Member updated\']);
    }

    public function destroy(Request $request, string $id)
    {
        $member = DB::table(\'members\')->where(\'id\', $id)->first();
        if (!$member) return response()->json([\'message\' => \'Member not found\'], 404);

        DB::table(\'members\')->where(\'id\', $id)->delete();
        return response()->json([\'message\' => \'Member deleted\']);
    }
}
');

// ─── Directory Approval ────────────────────────────────────
file_put_contents($base . '/DirectoryApprovalController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class DirectoryApprovalController extends Controller
{
    public function pending(Request $request)
    {
        $listings = DB::table(\'directory_listings\')
            ->where(\'status\', \'pending\')
            ->orderByDesc(\'created_at\')
            ->paginate(20);

        return response()->json($listings);
    }

    public function approve(Request $request, string $id)
    {
        $updated = DB::table(\'directory_listings\')
            ->where(\'id\', $id)
            ->update([
                \'status\' => \'approved\',
                \'approved_at\' => now()->toDateTimeString(),
                \'approved_by\' => $request->user()->id,
                \'updated_at\' => now()->toDateTimeString(),
            ]);

        if (!$updated) return response()->json([\'message\' => \'Listing not found\'], 404);
        return response()->json([\'message\' => \'Listing approved\']);
    }

    public function reject(Request $request, string $id)
    {
        $updated = DB::table(\'directory_listings\')
            ->where(\'id\', $id)
            ->update([
                \'status\' => \'rejected\',
                \'approved_by\' => $request->user()->id,
                \'updated_at\' => now()->toDateTimeString(),
            ]);

        if (!$updated) return response()->json([\'message\' => \'Listing not found\'], 404);
        return response()->json([\'message\' => \'Listing rejected\']);
    }
}
');

// ─── Admin Payment Controller ──────────────────────────────
file_put_contents($base . '/PaymentController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table(\'payments\')
            ->join(\'users\', \'payments.user_id\', \'=\', \'users.id\')
            ->select(\'payments.*\', \'users.name\', \'users.email\');

        if ($request->status) $query->where(\'payments.status\', $request->status);
        if ($request->provider) $query->where(\'payments.provider\', $request->provider);

        $payments = $query->orderByDesc(\'payments.created_at\')->paginate(20);
        return response()->json($payments);
    }

    public function show(Request $request, string $id)
    {
        $payment = DB::table(\'payments\')
            ->join(\'users\', \'payments.user_id\', \'=\', \'users.id\')
            ->select(\'payments.*\', \'users.name\', \'users.email\')
            ->where(\'payments.id\', $id)
            ->first();

        if (!$payment) return response()->json([\'message\' => \'Payment not found\'], 404);
        return response()->json([\'payment\' => $payment]);
    }

    public function updateStatus(Request $request, string $id)
    {
        $request->validate([\'status\' => \'required|in:pending,completed,failed,refunded\']);

        $updated = DB::table(\'payments\')
            ->where(\'id\', $id)
            ->update([
                \'status\' => $request->status,
                \'verified_at\' => $request->status === \'completed\' ? now()->toDateTimeString() : null,
                \'updated_at\' => now()->toDateTimeString(),
            ]);

        if (!$updated) return response()->json([\'message\' => \'Payment not found\'], 404);
        return response()->json([\'message\' => \'Payment status updated\']);
    }

    public function stats(Request $request)
    {
        $total = DB::table(\'payments\')->sum(\'amount\');
        $completed = DB::table(\'payments\')->where(\'status\', \'completed\')->sum(\'amount\');
        $pending = DB::table(\'payments\')->where(\'status\', \'pending\')->sum(\'amount\');
        $count = DB::table(\'payments\')->count();

        $byProvider = DB::table(\'payments\')
            ->select(\'provider\', DB::raw(\'count(*) as count\'), DB::raw(\'sum(amount) as total\'))
            ->groupBy(\'provider\')
            ->get();

        return response()->json([
            \'total_amount\' => (float) $total,
            \'completed_amount\' => (float) $completed,
            \'pending_amount\' => (float) $pending,
            \'total_count\' => $count,
            \'by_provider\' => $byProvider,
        ]);
    }
}
');

// ─── Content Controller ────────────────────────────────────
file_put_contents($base . '/ContentController.php', '<?php
namespace App\\Http\\Controllers\\Api\\Admin;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Str;

class ContentController extends Controller
{
    // ── NEWS ──
    public function indexNews(Request $request)
    {
        $items = DB::table(\'news_articles\')->orderByDesc(\'created_at\')->paginate(20);
        return response()->json($items);
    }

    public function storeNews(Request $request)
    {
        $v = $request->validate([
            \'title\' => \'required|string|max:255\',
            \'content\' => \'required|string\',
            \'excerpt\' => \'nullable|string\',
            \'cover_image\' => \'nullable|string\',
            \'status\' => \'nullable|in:draft,published\',
            \'tags\' => \'nullable\',
        ]);
        $id = Str::uuid()->toString();
        DB::table(\'news_articles\')->insert([
            \'id\' => $id, \'title\' => $v[\'title\'], \'slug\' => Str::slug($v[\'title\']),
            \'content\' => $v[\'content\'], \'excerpt\' => $v[\'excerpt\'] ?? null,
            \'cover_image\' => $v[\'cover_image\'] ?? null, \'author\' => $request->user()->name,
            \'status\' => $v[\'status\'] ?? \'draft\', \'tags\' => $v[\'tags\'] ?? null,
            \'published_at\' => $v[\'status\'] === \'published\' ? now()->toDateTimeString() : null,
            \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
        ]);
        return response()->json([\'message\' => \'News article created\', \'id\' => $id], 201);
    }

    public function updateNews(Request $request, string $id)
    {
        $v = $request->validate([
            \'title\' => \'sometimes|string|max:255\', \'content\' => \'sometimes|string\',
            \'excerpt\' => \'nullable|string\', \'cover_image\' => \'nullable|string\',
            \'status\' => \'nullable|in:draft,published\', \'tags\' => \'nullable\',
        ]);
        if (isset($v[\'title\'])) $v[\'slug\'] = Str::slug($v[\'title\']);
        if (($v[\'status\'] ?? \'\') === \'published\') $v[\'published_at\'] = now()->toDateTimeString();
        $v[\'updated_at\'] = now()->toDateTimeString();
        DB::table(\'news_articles\')->where(\'id\', $id)->update($v);
        return response()->json([\'message\' => \'News article updated\']);
    }

    public function destroyNews(Request $request, string $id)
    {
        DB::table(\'news_articles\')->where(\'id\', $id)->delete();
        return response()->json([\'message\' => \'News article deleted\']);
    }

    // ── PRODUCTS ──
    public function indexProducts(Request $request)
    {
        return response()->json(DB::table(\'products\')->orderByDesc(\'created_at\')->paginate(20));
    }

    public function storeProduct(Request $request)
    {
        $v = $request->validate([
            \'title\' => \'required|string|max:255\', \'description\' => \'required|string\',
            \'price\' => \'nullable|numeric\', \'image\' => \'nullable|string\',
            \'category\' => \'nullable|string\', \'status\' => \'nullable|in:draft,published\',
        ]);
        $id = Str::uuid()->toString();
        DB::table(\'products\')->insert(array_merge($v, [
            \'id\' => $id, \'slug\' => Str::slug($v[\'title\']),
            \'status\' => $v[\'status\'] ?? \'draft\',
            \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
        ]));
        return response()->json([\'message\' => \'Product created\', \'id\' => $id], 201);
    }

    public function updateProduct(Request $request, string $id)
    {
        $v = $request->validate([
            \'title\' => \'sometimes|string\', \'description\' => \'sometimes|string\',
            \'price\' => \'nullable|numeric\', \'image\' => \'nullable|string\',
            \'category\' => \'nullable|string\', \'status\' => \'nullable|string\',
        ]);
        if (isset($v[\'title\'])) $v[\'slug\'] = Str::slug($v[\'title\']);
        $v[\'updated_at\'] = now()->toDateTimeString();
        DB::table(\'products\')->where(\'id\', $id)->update($v);
        return response()->json([\'message\' => \'Product updated\']);
    }

    public function destroyProduct(Request $request, string $id)
    {
        DB::table(\'products\')->where(\'id\', $id)->delete();
        return response()->json([\'message\' => \'Product deleted\']);
    }

    // ── ACTIVITIES ──
    public function indexActivities(Request $request)
    {
        return response()->json(DB::table(\'activities\')->orderByDesc(\'created_at\')->paginate(20));
    }

    public function storeActivity(Request $request)
    {
        $v = $request->validate([
            \'title\' => \'required|string\', \'description\' => \'required|string\',
            \'image\' => \'nullable|string\', \'location\' => \'nullable|string\',
            \'date\' => \'nullable|string\', \'time\' => \'nullable|string\',
            \'status\' => \'nullable|in:draft,published\', \'category\' => \'nullable|string\',
        ]);
        $id = Str::uuid()->toString();
        DB::table(\'activities\')->insert(array_merge($v, [
            \'id\' => $id, \'slug\' => Str::slug($v[\'title\']),
            \'status\' => $v[\'status\'] ?? \'draft\',
            \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
        ]));
        return response()->json([\'message\' => \'Activity created\', \'id\' => $id], 201);
    }

    public function updateActivity(Request $request, string $id)
    {
        $v = $request->validate([
            \'title\' => \'sometimes|string\', \'description\' => \'sometimes|string\',
            \'image\' => \'nullable|string\', \'location\' => \'nullable|string\',
            \'date\' => \'nullable|string\', \'time\' => \'nullable|string\',
            \'status\' => \'nullable|string\', \'category\' => \'nullable|string\',
        ]);
        if (isset($v[\'title\'])) $v[\'slug\'] = Str::slug($v[\'title\']);
        $v[\'updated_at\'] = now()->toDateTimeString();
        DB::table(\'activities\')->where(\'id\', $id)->update($v);
        return response()->json([\'message\' => \'Activity updated\']);
    }

    public function destroyActivity(Request $request, string $id)
    {
        DB::table(\'activities\')->where(\'id\', $id)->delete();
        return response()->json([\'message\' => \'Activity deleted\']);
    }

    // ── EVENTS ──
    public function indexEvents(Request $request)
    {
        return response()->json(DB::table(\'events\')->orderByDesc(\'start_date\')->paginate(20));
    }

    public function storeEvent(Request $request)
    {
        $v = $request->validate([
            \'title\' => \'required|string\', \'description\' => \'required|string\',
            \'image\' => \'nullable|string\', \'location\' => \'nullable|string\',
            \'start_date\' => \'nullable|string\', \'end_date\' => \'nullable|string\',
            \'time\' => \'nullable|string\', \'status\' => \'nullable|in:draft,published\',
            \'capacity\' => \'nullable|integer\', \'registration_url\' => \'nullable|url\',
        ]);
        $id = Str::uuid()->toString();
        DB::table(\'events\')->insert(array_merge($v, [
            \'id\' => $id, \'slug\' => Str::slug($v[\'title\']),
            \'status\' => $v[\'status\'] ?? \'draft\',
            \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
        ]));
        return response()->json([\'message\' => \'Event created\', \'id\' => $id], 201);
    }

    public function updateEvent(Request $request, string $id)
    {
        $v = $request->validate([
            \'title\' => \'sometimes|string\', \'description\' => \'sometimes|string\',
            \'image\' => \'nullable|string\', \'location\' => \'nullable|string\',
            \'start_date\' => \'nullable|string\', \'end_date\' => \'nullable|string\',
            \'time\' => \'nullable|string\', \'status\' => \'nullable|string\',
            \'capacity\' => \'nullable|integer\', \'registration_url\' => \'nullable|url\',
        ]);
        if (isset($v[\'title\'])) $v[\'slug\'] = Str::slug($v[\'title\']);
        $v[\'updated_at\'] = now()->toDateTimeString();
        DB::table(\'events\')->where(\'id\', $id)->update($v);
        return response()->json([\'message\' => \'Event updated\']);
    }

    public function destroyEvent(Request $request, string $id)
    {
        DB::table(\'events\')->where(\'id\', $id)->delete();
        return response()->json([\'message\' => \'Event deleted\']);
    }

    // ── MEDIA ──
    public function indexMedia(Request $request)
    {
        return response()->json(DB::table(\'media\')->orderByDesc(\'created_at\')->paginate(20));
    }

    public function storeMedia(Request $request)
    {
        $v = $request->validate([
            \'title\' => \'required|string\', \'type\' => \'required|string\',
            \'url\' => \'required|string\', \'description\' => \'nullable|string\',
            \'category\' => \'nullable|string\',
        ]);
        $id = Str::uuid()->toString();
        DB::table(\'media\')->insert(array_merge($v, [
            \'id\' => $id, \'uploaded_by\' => $request->user()->id,
            \'created_at\' => now()->toDateTimeString(),
        ]));
        return response()->json([\'message\' => \'Media uploaded\', \'id\' => $id], 201);
    }

    public function destroyMedia(Request $request, string $id)
    {
        DB::table(\'media\')->where(\'id\', $id)->delete();
        return response()->json([\'message\' => \'Media deleted\']);
    }

    // ── HOME PAGE ──
    public function getHomePage(Request $request)
    {
        $page = DB::table(\'home_pages\')->first();
        return response()->json([\'home_page\' => $page]);
    }

    public function updateHomePage(Request $request)
    {
        $v = $request->validate([
            \'hero_title\' => \'sometimes|string\', \'hero_subtitle\' => \'sometimes|string\',
            \'hero_image\' => \'nullable|string\', \'hero_cta_text\' => \'nullable|string\',
            \'hero_cta_url\' => \'nullable|string\', \'about_title\' => \'nullable|string\',
            \'about_content\' => \'nullable|string\', \'about_image\' => \'nullable|string\',
            \'sections\' => \'nullable\', \'seo_title\' => \'nullable|string\',
            \'seo_description\' => \'nullable|string\',
        ]);
        $existing = DB::table(\'home_pages\')->first();
        if ($existing) {
            DB::table(\'home_pages\')->where(\'id\', $existing->id)->update(
                array_merge($v, [\'updated_at\' => now()->toDateTimeString()])
            );
        } else {
            DB::table(\'home_pages\')->insert(array_merge($v, [
                \'id\' => Str::uuid()->toString(),
                \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
            ]));
        }
        return response()->json([\'message\' => \'Home page updated\']);
    }

    // ── COUNTDOWN ──
    public function getCountdown(Request $request)
    {
        return response()->json([\'countdown\' => DB::table(\'countdowns\')->where(\'is_active\', true)->first()]);
    }

    public function updateCountdown(Request $request)
    {
        $v = $request->validate([
            \'title\' => \'sometimes|string\', \'target_date\' => \'sometimes|string\',
            \'description\' => \'nullable|string\', \'is_active\' => \'sometimes|boolean\',
        ]);
        $existing = DB::table(\'countdowns\')->first();
        if ($existing) {
            DB::table(\'countdowns\')->where(\'id\', $existing->id)->update(
                array_merge($v, [\'updated_at\' => now()->toDateTimeString()])
            );
        } else {
            DB::table(\'countdowns\')->insert(array_merge($v, [
                \'id\' => Str::uuid()->toString(),
                \'created_at\' => now()->toDateTimeString(), \'updated_at\' => now()->toDateTimeString(),
            ]));
        }
        return response()->json([\'message\' => \'Countdown updated\']);
    }
}
');

echo "=== Admin controllers generated ===\n";
