<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class GenericTableController extends Controller
{
    /**
     * Tables that anonymous visitors may read (Supabase RLS public policies).
     * Everything else requires a valid Bearer token.
     */
    private const PUBLIC_TABLES = [
        'news', 'products', 'activities', 'media', 'directory_entries',
        'trade_opportunities', 'subscription_plans', 'certificate_templates',
        'site_hero_slides', 'site_partner_logos', 'readiness_checklist_items',
        'application_forms', 'blog_reactions', 'directory_custom_field_defs',
        'membership_resources',
    ];

    /**
     * Tables that only admin/superadmin/developer roles may read or write
     * through the generic data endpoints (replaces Supabase RLS admin-only
     * policies).
     */
    public const RESTRICTED_TABLES = [
        'ip_bans', 'login_attempts', 'user_sessions', 'user_roles', 'user_email_mfa',
        'email_otp_codes', 'email_log', 'email_settings', 'email_templates',
        'backup_destinations', 'backup_schedules', 'backup_runs', 'backup_run_uploads',
        'admin_notification_settings', 'notifications', 'notification_reads',
        'pending_applications', 'member_documents', 'member_profiles',
        'application_submissions', 'member_email_preferences', 'member_readiness_responses',
        'support_tickets', 'ticket_messages', 'certificates',
        'security_settings', 'member_id_counters', 'activity_log',
        'password_reset_tokens', 'users', 'role_permissions', 'role_help',
        'chatbot_knowledge', 'login_attempts',
    ];

    private function isAdminLike(): bool
    {
        $user = Auth::guard('sanctum')->user();
        if (!$user) return false;
        return DB::table('user_roles')
            ->where('user_id', $user->id)
            ->whereIn('role', ['admin', 'superadmin', 'developer'])
            ->exists();
    }

    private function validIdent(string $name): bool
    {
        return (bool) preg_match('/^[a-z_][a-z0-9_]*$/', $name);
    }

    /**
     * GET /api/public/{table}?select=..&filter[]=col=op.val&sort[]=col.asc&limit=&offset=
     */
    public function index(Request $request, string $table)
    {
        if (!$this->validIdent($table)) {
            return response()->json(['data' => [], 'count' => 0, 'error' => 'Invalid table'], 400);
        }

        $public = in_array($table, self::PUBLIC_TABLES, true);
        if (!$public && !Auth::guard('sanctum')->user()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        if (in_array($table, self::RESTRICTED_TABLES, true) && !$this->isAdminLike()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (!Schema::hasTable($table)) {
            return response()->json(['data' => [], 'count' => 0], 200);
        }

        $query = DB::table($table);

        // select columns
        $select = $request->query('select', '*');
        if ($select !== '*' && is_string($select)) {
            $cols = array_filter(array_map('trim', explode(',', $select)));
            $safe = [];
            foreach ($cols as $c) {
                if ($this->validIdent($c)) $safe[] = $c;
            }
            if ($safe) $query->select($safe);
        }

        // filters: col=eq.value | col=neq.value | col=gt.value | col=gte.value | col=lt.value
        //          | col=lte.value | col=like.value | col=ilike.value | col=in.(a,b)
        //          | col=is.null|true|false | col=cs.{json} | or=(cond1,cond2)
        $filters = $request->query('filter', []);
        if (is_string($filters)) $filters = [$filters];
        foreach ((array) $filters as $filter) {
            if (!is_string($filter)) continue;
            if (str_starts_with($filter, 'or=(') && str_ends_with($filter, ')')) {
                $inner = substr($filter, 4, -1);
                $parts = array_filter(array_map('trim', explode(',', $inner)));
                $query->where(function ($q) use ($parts) {
                    $first = true;
                    foreach ($parts as $part) {
                        $cond = $this->parseCondition($part);
                        if (!$cond) continue;
                        [$col, $op, $val] = $cond;
                        if ($first) {
                            $this->applyOperator($q, $col, $op, $val);
                            $first = false;
                        } else {
                            $q->orWhere(function ($sub) use ($col, $op, $val) {
                                $this->applyOperator($sub, $col, $op, $val);
                            });
                        }
                    }
                });
                continue;
            }
            $cond = $this->parseCondition($filter);
            if ($cond) {
                [$col, $op, $val] = $cond;
                $this->applyOperator($query, $col, $op, $val);
            }
        }

        // sort: col.asc | col.desc
        $sorts = $request->query('sort', []);
        if (is_string($sorts)) $sorts = [$sorts];
        foreach ((array) $sorts as $sort) {
            if (!is_string($sort)) continue;
            $parts = explode('.', $sort, 2);
            if (count($parts) !== 2 || !$this->validIdent($parts[0])) continue;
            $dir = strtolower($parts[1]) === 'desc' ? 'desc' : 'asc';
            $query->orderBy($parts[0], $dir);
        }

        $count = (clone $query)->count();

        // limit / offset
        if ($request->has('limit') && is_numeric($request->query('limit'))) {
            $query->limit((int) $request->query('limit'));
        }
        if ($request->has('offset') && is_numeric($request->query('offset'))) {
            $query->offset((int) $request->query('offset'));
        }

        $rows = $query->get();

        return response()->json(['data' => $rows, 'count' => $count]);
    }

    /**
     * Helper: build a query with filters from request (reused by write ops).
     */
    private function filteredQuery(Request $request, string $table)
    {
        $query = DB::table($table);
        $filters = $request->query('filter', []);
        if (is_string($filters)) $filters = [$filters];
        foreach ((array) $filters as $filter) {
            if (!is_string($filter)) continue;
            if (str_starts_with($filter, 'or=(') && str_ends_with($filter, ')')) {
                $inner = substr($filter, 4, -1);
                $parts = array_filter(array_map('trim', explode(',', $inner)));
                $query->where(function ($q) use ($parts) {
                    $first = true;
                    foreach ($parts as $part) {
                        $cond = $this->parseCondition($part);
                        if (!$cond) continue;
                        [$col, $op, $val] = $cond;
                        if ($first) {
                            $this->applyOperator($q, $col, $op, $val);
                            $first = false;
                        } else {
                            $q->orWhere(function ($sub) use ($col, $op, $val) {
                                $this->applyOperator($sub, $col, $op, $val);
                            });
                        }
                    }
                });
                continue;
            }
            $cond = $this->parseCondition($filter);
            if ($cond) {
                [$col, $op, $val] = $cond;
                $this->applyOperator($query, $col, $op, $val);
            }
        }
        return $query;
    }

    /**
     * POST /api/data/{table} — Insert rows
     */
    public function store(Request $request, string $table)
    {
        if (!$this->validIdent($table)) {
            return response()->json(['data' => null, 'error' => 'Invalid table'], 400);
        }
        if (!Schema::hasTable($table)) {
            return response()->json(['data' => null, 'error' => 'Table not found'], 404);
        }
        if (!Auth::guard('sanctum')->user()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $body = $request->json()->all();
        $rows = is_array($body) && array_is_list($body) ? $body : [$body];
        $inserted = [];

        foreach ($rows as $row) {
            // Auto-generate UUID if no id provided
            if (empty($row['id'])) {
                $row['id'] = Str::uuid()->toString();
            }
            if (empty($row['created_at'])) {
                $row['created_at'] = now()->toDateTimeString();
            }
            if (empty($row['updated_at'])) {
                $row['updated_at'] = now()->toDateTimeString();
            }
            // Filter to only valid columns
            $columns = Schema::getColumnListing($table);
            $safe = array_intersect_key($row, array_flip($columns));
            DB::table($table)->insert($safe);
            $inserted[] = $safe;
        }

        return response()->json(['data' => $inserted]);
    }

    /**
     * POST /api/data/{table}/upsert — Upsert rows (insert or update on conflict)
     */
    public function upsert(Request $request, string $table)
    {
        if (!$this->validIdent($table)) {
            return response()->json(['data' => null, 'error' => 'Invalid table'], 400);
        }
        if (!Schema::hasTable($table)) {
            return response()->json(['data' => null, 'error' => 'Table not found'], 404);
        }
        if (!Auth::guard('sanctum')->user()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $body = $request->json()->all();
        $rows = is_array($body) && array_is_list($body) ? $body : [$body];
        $columns = Schema::getColumnListing($table);
        $saved = [];

        foreach ($rows as $row) {
            if (empty($row['id'])) {
                $row['id'] = Str::uuid()->toString();
            }
            $row['updated_at'] = now()->toDateTimeString();
            if (empty($row['created_at'])) {
                $row['created_at'] = now()->toDateTimeString();
            }
            $safe = array_intersect_key($row, array_flip($columns));

            $existing = DB::table($table)->where('id', $safe['id'] ?? null)->first();
            if ($existing) {
                DB::table($table)->where('id', $safe['id'])->update($safe);
            } else {
                DB::table($table)->insert($safe);
            }
            $saved[] = DB::table($table)->where('id', $safe['id'])->first();
        }

        return response()->json(['data' => $saved]);
    }

    /**
     * PUT /api/data/{table}?filter[]=... — Update rows matching filters
     */
    public function update(Request $request, string $table)
    {
        if (!$this->validIdent($table)) {
            return response()->json(['data' => null, 'error' => 'Invalid table'], 400);
        }
        if (!Schema::hasTable($table)) {
            return response()->json(['data' => null, 'error' => 'Table not found'], 404);
        }
        if (!Auth::guard('sanctum')->user()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $body = $request->json()->all();
        $body['updated_at'] = now()->toDateTimeString();
        $columns = Schema::getColumnListing($table);
        $safe = array_intersect_key($body, array_flip($columns));

        $query = $this->filteredQuery($request, $table);
        $query->update($safe);

        return response()->json(['data' => $safe]);
    }

    /**
     * DELETE /api/data/{table}?filter[]=... — Delete rows matching filters
     */
    public function destroy(Request $request, string $table)
    {
        if (!$this->validIdent($table)) {
            return response()->json(['data' => null, 'error' => 'Invalid table'], 400);
        }
        if (!Schema::hasTable($table)) {
            return response()->json(['data' => null, 'error' => 'Table not found'], 404);
        }
        if (!Auth::guard('sanctum')->user()) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $query = $this->filteredQuery($request, $table);
        $deleted = $query->delete();

        return response()->json(['data' => ['deleted' => $deleted]]);
    }

    private function parseCondition(string $filter): ?array
    {
        if (!str_contains($filter, '=')) return null;
        [$col, $rest] = explode('=', $filter, 2);
        $col = trim($col);
        if (!$this->validIdent($col)) return null;

        if (str_contains($rest, '.')) {
            [$op, $val] = explode('.', $rest, 2);
        } else {
            $op = $rest;
            $val = '';
        }
        return [$col, strtolower(trim($op)), trim($val)];
    }

    private function applyOperator($query, string $col, string $op, string $val): void
    {
        switch ($op) {
            case 'eq':
                $query->where($col, $val === 'null' ? null : $val);
                break;
            case 'neq':
                $query->where($col, '!=', $val === 'null' ? null : $val);
                break;
            case 'gt':
                $query->where($col, '>', $val);
                break;
            case 'gte':
                $query->where($col, '>=', $val);
                break;
            case 'lt':
                $query->where($col, '<', $val);
                break;
            case 'lte':
                $query->where($col, '<=', $val);
                break;
            case 'like':
                $query->where($col, 'like', $val);
                break;
            case 'ilike':
                if (DB::connection()->getDriverName() === 'pgsql') {
                    $query->where($col, 'ilike', $val);
                } else {
                    $query->where($col, 'like', $val);
                }
                break;
            case 'in':
                $vals = array_map('trim', explode(',', trim($val, '()')));
                $query->whereIn($col, $vals);
                break;
            case 'is':
                if ($val === 'null') $query->whereNull($col);
                elseif ($val === 'true') $query->where($col, true);
                elseif ($val === 'false') $query->where($col, false);
                break;
            case 'cs':
                $decoded = json_decode($val, true);
                if (is_array($decoded)) $query->whereJsonContains($col, $decoded);
                break;
        }
    }
}