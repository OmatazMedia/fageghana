<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NotificationService
{
    public function send(string $userId, string $title, string $body, string $type = 'info', string $url = null): string
    {
        $id = Str::uuid()->toString();
        DB::table('notifications')->insert([
            'id' => $id, 'user_id' => $userId,
            'title' => $title, 'body' => $body,
            'link' => $url, 'read_at' => null, 'created_at' => now(),
        ]);
        return $id;
    }

    public function getForUser(string $userId, bool $unreadOnly = false, int $limit = 50): array
    {
        $q = DB::table('notifications')->where('user_id', $userId);
        if ($unreadOnly) $q->whereNull('read_at');
        return $q->orderByDesc('created_at')->limit($limit)->get()->toArray();
    }

    public function markRead(string $notificationId): bool
    {
        return DB::table('notifications')->where('id', $notificationId)
            ->update(['read_at' => now()]) > 0;
    }

    public function markAllRead(string $userId): int
    {
        return DB::table('notifications')->where('user_id', $userId)
            ->whereNull('read_at')->update(['read_at' => now()]);
    }

    public function getUnreadCount(string $userId): int
    {
        return DB::table('notifications')->where('user_id', $userId)
            ->whereNull('read_at')->count();
    }

    public function delete(string $notificationId): bool
    {
        return DB::table('notifications')->where('id', $notificationId)->delete() > 0;
    }
}