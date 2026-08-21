<?php
namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Command;

class ScheduledBackup extends Command
{
    protected $signature = 'backup:run';
    protected $description = 'Execute a scheduled backup if one is due';

    public function handle(BackupService $backupService): int
    {
        $result = $backupService->executeScheduledBackup();

        if ($result['status'] === 'skipped') {
            $this->info("Skipped: " . ($result['reason'] ?? 'Not scheduled'));
            return self::SUCCESS;
        }

        if ($result['status'] === 'completed') {
            $this->info("Backup completed: {$result['filename']} ({$result['size']} bytes)");
            return self::SUCCESS;
        }

        $this->error("Backup failed");
        return self::FAILURE;
    }
}
