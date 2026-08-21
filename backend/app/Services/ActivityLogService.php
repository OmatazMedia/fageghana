<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ActivityLogService
{
    public function log(string $userId, string $action, string $entityType = null, string $entityId = null, array $metadata = null, string $ip = null, string $userAgent = null): void
    {
        $detail = null;
        if ($entityType || $metadata !== null) {
            $detail = json_encode(array_filter([
                'entity_type' => $entityType, 'entity_id' => $entityId,
                'metadata' => $metadata,
            ], fn ($v) => $v !== null));
        }
        DB::table('activity_log')->insert([
            'id' => Str::uuid()->toString(), 'user_id' => $userId,
            'event_type' => $action, 'detail' => $detail ?: null,
            'ip_address' => $ip, 'user_agent' => $userAgent, 'created_at' => now(),
        ]);
    }

    public function getForEntity(string $entityType, string $entityId, int $limit = 50): array
    {
        return $this->getRecent($limit);
    }

    public function getForUser(string $userId, int $limit = 50): array
    {
        return DB::table('activity_log')
            ->where('user_id', $userId)
            ->orderByDesc('created_at')->limit($limit)->get()->toArray();
    }

    public function getRecent(int $limit = 100): array
    {
        return DB::table('activity_log')
            ->join('users', 'activity_log.user_id', '=', 'users.id')
            ->select('activity_log.*', 'users.name as user_name')
            ->orderByDesc('activity_log.created_at')->limit($limit)->get()->toArray();
    }
}