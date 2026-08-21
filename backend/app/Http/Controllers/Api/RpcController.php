<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Replaces Supabase RPC functions (supabase.rpc / functions.invoke).
 * Note: response bodies are the RAW value — the frontend client wraps the
 * whole JSON body as `data`, so verify_certificate returns a bare array,
 * has_role a bare boolean, etc.
 */
class RpcController extends Controller
{
    private function user(): ?object
    {
        return Auth::guard('sanctum')->user();
    }

    private function hasRole(string $userId, string $role): bool
    {
        return DB::table('user_roles')
            ->where('user_id', $userId)
            ->where('role', $role)
            ->exists();
    }

    private function isAdminLike(string $userId): bool
    {
        foreach (['admin', 'staff', 'superadmin', 'developer', 'coordinator', 'ceo'] as $role) {
            if ($this->hasRole($userId, $role)) return true;
        }
        return false;
    }

    public function invoke(Request $request, string $function)
    {
        $params = $request->json()->all();
        $user = $this->user();

        return match ($function) {
            // ─── Public RPCs (called from anonymous pages) ───────────────
            'verify_certificate' => $this->verifyCertificate($params['_code'] ?? ''),
            'public_search_members' => $this->publicSearchMembers($params['_q'] ?? ''),
            'list_enabled_gateways' => $this->listEnabledGateways(),
            'increment_activity_views' => $this->incrementActivityViews($params['activity_id'] ?? null),
            'get_pending_application' => $this->getPendingApplication($params['_token'] ?? null),
            'delete_blog_reaction' => $this->deleteBlogReaction(
                $params['p_news_id'] ?? null,
                $params['p_session_id'] ?? null,
                $params['p_emoji'] ?? null,
            ),

            // ─── Auth-required RPCs ───────────────────────────────────────
            'has_role' => $this->requireUser($user, fn () =>
                response()->json($this->hasRole(
                    $params['_user_id'] ?? $params['user_id'] ?? $user->id,
                    $params['_role'] ?? $params['role'] ?? '',
                ))),
            'get_readiness_score' => $this->requireUser($user, fn () =>
                response()->json($this->readinessScore($params['_user_id'] ?? $user->id))),
            'revoke_user_session' => $this->requireUser($user, fn () =>
                $this->revokeUserSession($user, $params['_id'] ?? null, $params['_reason'] ?? 'manual')),
            'submit_my_directory_entry' => $this->requireUser($user, fn () =>
                $this->submitDirectoryEntry($user, $params['_payload'] ?? [], $params['_submit'] ?? true)),
            'generate_structured_member_id' => $this->requireAdminLike($user, fn () =>
                response()->json($this->generateMemberId($params['_abbrev'] ?? 'MEMBER'))),
            'admin_review_directory_entry' => $this->requireAdminLike($user, fn () =>
                $this->reviewDirectoryEntry($user, $params['_id'] ?? null, $params['_action'] ?? '', $params['_notes'] ?? null)),
            'admin_list_public_tables' => $this->requireAdminLike($user, fn () =>
                response()->json($this->listTables())),
            'admin_dump_table' => $this->requireAdminLike($user, fn () =>
                response()->json($this->dumpTable($params['_name'] ?? ''))),
            'manage-email-preferences' => $this->requireUser($user, fn () =>
                $this->manageEmailPreferences($params)),

            default => response()->json(['data' => null, 'error' => "RPC {$function} not implemented"], 404),
        };
    }

    private function requireUser(?object $user, callable $cb)
    {
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);
        return $cb();
    }

    private function requireAdminLike(?object $user, callable $cb)
    {
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);
        if (!$this->isAdminLike($user->id)) return response()->json(['message' => 'Forbidden'], 403);
        return $cb();
    }

    // ─── Public ──────────────────────────────────────────────────────────

    private function verifyCertificate(string $code)
    {
        $row = DB::table('certificates')
            ->where('verification_code', $code)
            ->select('full_name', 'member_id', 'tier', 'issued_at', 'expires_at', 'revoked', 'verification_code')
            ->first();
        return response()->json($row ? [$row] : []);
    }

    private function publicSearchMembers(string $q)
    {
        $q = trim($q);
        if ($q === '' || mb_strlen($q) < 2) return response()->json([]);
        $like = '%' . $q . '%';
        $rows = DB::table('member_profiles')
            ->whereNotNull('member_id')
            ->where(function ($b) use ($like) {
                $b->where('member_id', 'like', $like)
                    ->orWhere('company_name', 'like', $like)
                    ->orWhere('contact_name', 'like', $like)
                    ->orWhere('email', 'like', $like);
            })
            ->orderByRaw("CASE WHEN member_id = ? THEN 0 ELSE 1 END", [$q])
            ->orderBy('company_name')
            ->limit(20)
            ->select('contact_name', 'company_name', 'member_id', 'tier', 'subscription_expiry')
            ->get();
        return response()->json($rows);
    }

    private function listEnabledGateways()
    {
        $rows = DB::table('payment_gateways')
            ->where('enabled', true)
            ->orderBy('display_order')
            ->get()
            ->map(fn ($g) => [
                'id' => $g->id,
                'name' => $g->name,
                'provider' => $g->provider,
                'enabled' => (bool) $g->enabled,
                'display_order' => $g->display_order,
                'bank_details' => $g->bank_details,
                'public_key' => json_decode((string) ($g->config ?? '{}'), true)['public_key'] ?? null,
            ]);
        return response()->json($rows);
    }

    private function incrementActivityViews($activityId)
    {
        if ($activityId) {
            DB::table('activities')->where('id', $activityId)->increment('view_count');
        }
        return response()->json(true);
    }

    private function getPendingApplication($token)
    {
        $row = DB::table('pending_applications')
            ->where('claim_token', $token)
            ->select('id', 'email', 'full_name', 'phone', 'company_name', 'tier', 'plan_id', 'status', 'claim_token', 'user_id', 'expires_at', 'created_at')
            ->first();
        return response()->json($row ? [$row] : []);
    }

    private function deleteBlogReaction($newsId, $sessionId, $emoji)
    {
        if ($sessionId && mb_strlen($sessionId) >= 8 && mb_strlen($sessionId) <= 64) {
            DB::table('blog_reactions')
                ->where('news_id', $newsId)
                ->where('session_id', $sessionId)
                ->where('emoji', $emoji)
                ->delete();
        }
        return response()->json(true);
    }

    // ─── Auth ────────────────────────────────────────────────────────────

    private function readinessScore(string $userId): float
    {
        $items = DB::table('readiness_checklist_items')->where('active', true)->get();
        $responses = DB::table('member_readiness_responses')
            ->where('user_id', $userId)
            ->pluck('status', 'item_id');
        $total = 0.0;
        $earned = 0.0;
        foreach ($items as $item) {
            $total += (float) $item->weight;
            $status = $responses[$item->id] ?? 'not_started';
            $earned += match ($status) {
                'complete' => (float) $item->weight,
                'in_progress' => (float) $item->weight * 0.5,
                default => 0.0,
            };
        }
        if ($total <= 0) return 0.0;
        return round(($earned / $total) * 100, 1);
    }

    private function revokeUserSession(object $user, ?string $id, string $reason)
    {
        if (!$id) return response()->json(['message' => 'Session id required'], 422);
        $session = DB::table('user_sessions')->where('id', $id)->first();
        if (!$session) return response()->json(true);
        $allowed = $session->user_id === $user->id || $this->hasRole($user->id, 'admin')
            || $this->hasRole($user->id, 'superadmin') || $this->hasRole($user->id, 'developer');
        if (!$allowed) return response()->json(['message' => 'Forbidden'], 403);
        DB::table('user_sessions')->where('id', $id)->update([
            'revoked_at' => now(),
            'revoked_reason' => $reason,
        ]);
        return response()->json(true);
    }

    private function submitDirectoryEntry(object $user, array $payload, bool $submit)
    {
        $profile = DB::table('member_profiles')->where('user_id', $user->id)->first();
        $active = $profile && $profile->subscription_expiry && strtotime($profile->subscription_expiry) > time();
        if (!$active) {
            return response()->json(['message' => 'Active subscription required to publish a directory listing'], 403);
        }

        $existing = DB::table('directory_entries')->where('user_id', $user->id)->first();
        $newStatus = $submit ? 'pending' : 'draft';

        $baseSlug = trim((string) ($payload['slug'] ?? ''), '-');
        if ($baseSlug === '') {
            $baseSlug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', (string) ($payload['company_name'] ?? '')));
            $baseSlug = trim($baseSlug, '-');
        }
        if ($baseSlug === '') $baseSlug = 'member-' . substr($user->id, 0, 8);
        $finalSlug = $baseSlug;
        $i = 0;
        while (DB::table('directory_entries')
            ->where('slug', $finalSlug)
            ->when($existing, fn ($q) => $q->where('id', '!=', $existing->id))
            ->exists()) {
            $i++;
            $finalSlug = $baseSlug . '-' . $i;
        }

        $data = [
            'user_id' => $user->id,
            'entry_type' => $payload['entry_type'] ?? 'corporate',
            'slug' => $finalSlug,
            'company_name' => $payload['company_name'] ?? '',
            'short_description' => $payload['short_description'] ?? null,
            'long_description' => $payload['long_description'] ?? null,
            'mission' => $payload['mission'] ?? null,
            'vision' => $payload['vision'] ?? null,
            'services' => json_encode($payload['services'] ?? []),
            'products' => json_encode($payload['products'] ?? []),
            'executives' => json_encode($payload['executives'] ?? []),
            'director_name' => $payload['director_name'] ?? null,
            'contact_name' => $payload['contact_name'] ?? null,
            'phone' => $payload['phone'] ?? null,
            'email' => $payload['email'] ?? null,
            'website' => $payload['website'] ?? null,
            'physical_address' => $payload['physical_address'] ?? null,
            'postal_address' => $payload['postal_address'] ?? null,
            'country' => $payload['country'] ?? 'Ghana',
            'region' => $payload['region'] ?? null,
            'logo_url' => $payload['logo_url'] ?? null,
            'cover_image_url' => $payload['cover_image_url'] ?? null,
            'category' => $payload['category'] ?? null,
            'custom_fields' => json_encode($payload['custom_fields'] ?? (object) []),
            'status' => $newStatus,
            'submitted_at' => $submit ? now() : ($existing->submitted_at ?? null),
        ];

        if (!$existing) {
            $id = (string) Str::uuid();
            $data['id'] = $id;
            DB::table('directory_entries')->insert($data);
        } else {
            DB::table('directory_entries')->where('id', $existing->id)->update($data);
            $id = $existing->id;
        }
        return response()->json(['id' => $id]);
    }

    private function reviewDirectoryEntry(object $user, ?string $id, string $action, ?string $notes)
    {
        if (!in_array($action, ['approve', 'reject', 'withdraw', 'suspend'], true)) {
            return response()->json(['message' => 'Invalid action'], 422);
        }
        DB::table('directory_entries')->where('id', $id)->update([
            'status' => match ($action) {
                'approve' => 'approved',
                'reject' => 'rejected',
                'withdraw' => 'pending',
                'suspend' => 'suspended',
            },
            'reviewed_at' => now(),
            'reviewed_by' => $user->id,
            'review_notes' => $notes,
        ]);
        return response()->json(true);
    }

    private function generateMemberId(string $abbrev): string
    {
        $year = (int) date('Y');
        $yy = str_pad((string) ($year % 100), 2, '0', STR_PAD_LEFT);
        $yearCode = str_pad($yy, 4, '0', STR_PAD_LEFT);
        $key = $yearCode . '-' . strtoupper($abbrev);

        DB::beginTransaction();
        try {
            $counter = DB::table('member_id_counters')->where('year_abbrev', $key)->first();
            if ($counter) {
                $seq = $counter->next_seq;
                DB::table('member_id_counters')->where('year_abbrev', $key)
                    ->update(['next_seq' => $seq + 1, 'updated_at' => now()]);
            } else {
                $seq = 1;
                DB::table('member_id_counters')->insert([
                    'year_abbrev' => $key,
                    'next_seq' => 2,
                    'updated_at' => now(),
                ]);
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return 'FAGE/' . strtoupper($abbrev) . '/' . $yearCode . '/' . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
    }

    private function listTables(): array
    {
        $tables = DB::select('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name', ['table']);
        if (empty($tables)) {
            $tables = DB::select('SHOW TABLES');
        }
        $names = [];
        foreach ($tables as $t) {
            $v = (array) $t;
            $names[] = reset($v);
        }
        return array_values(array_diff($names, ['migrations']));
    }

    private function dumpTable(string $name)
    {
        if (!preg_match('/^[a-z_][a-z0-9_]*$/', $name)) {
            return response()->json(['message' => 'Invalid table'], 422);
        }
        return response()->json(DB::table($name)->get()->toArray());
    }

    private function manageEmailPreferences(array $params)
    {
        $userId = $params['user_id'] ?? null;
        if (!$userId) return response()->json(['message' => 'user_id required'], 422);

        $keys = ['newsletters', 'event_alerts', 'trade_notices', 'payment_reminders'];
        $merged = [];
        $existing = DB::table('member_email_preferences')->where('user_id', $userId)->first();
        foreach ($keys as $k) {
            $merged[$k] = isset($params[$k]) && is_bool($params[$k])
                ? $params[$k]
                : (bool) ($existing->{$k} ?? true);
        }
        $merged['updated_at'] = now();

        if ($existing) {
            DB::table('member_email_preferences')->where('user_id', $userId)->update($merged);
        } else {
            $merged['id'] = (string) Str::uuid();
            $merged['user_id'] = $userId;
            $merged['created_at'] = now();
            DB::table('member_email_preferences')->insert($merged);
        }
        $updated = DB::table('member_email_preferences')->where('user_id', $userId)->first();

        return response()->json(['success' => true, 'updated' => $updated]);
    }
}