<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ImportSupabaseBackup extends Command
{
    protected $signature = 'backup:import-supabase {path : Path to the Supabase backup folder} {--force : Clear existing data and re-import}';
    protected $description = 'Import data from a Supabase backup folder into the Laravel database';

    // Map Supabase table names to Laravel table names (if different)
    private array $tableMap = [
        'members' => 'member_profiles',
        'member_profiles' => 'member_profiles',
    ];

    // Tables to skip (managed by the system, don't import from backup)
    private array $skipTables = [
        'migrations', 'personal_access_tokens', 'sessions',
        'jobs', 'job_batches', 'failed_jobs',
    ];

    // Tables where we should NOT overwrite existing data
    private array $skipIfNotEmpty = [
        'email_settings', 'security_settings', 'chatbot_configs',
        'payment_gateways',
    ];

    public function handle(): int
    {
        $backupPath = $this->argument('path');

        if (!is_dir($backupPath)) {
            $this->error("Backup folder not found: {$backupPath}");
            return self::FAILURE;
        }

        // Read manifest
        $manifestPath = $backupPath . '/manifest.json';
        if (!file_exists($manifestPath)) {
            $this->error("manifest.json not found in backup folder");
            return self::FAILURE;
        }

        $manifest = json_decode(file_get_contents($manifestPath), true);
        $this->info("Backup from: {$manifest['created_at']}");
        $this->info("Project: {$manifest['project_ref']}");
        $this->info("Tables: " . count($manifest['tables']));
        $this->newLine();

        // Step 1: Import auth users
        $this->importAuthUsers($backupPath);

        // Step 2: Import data tables (in dependency order)
        if ($this->option('force')) {
            $this->warn('Force mode: clearing existing data...');
            DB::statement('PRAGMA foreign_keys = OFF');
            foreach ($manifest['tables'] as $table => $count) {
                if (in_array($table, $this->skipTables)) continue;
                if (in_array($table, $this->skipIfNotEmpty)) continue;
                $targetTable = $this->tableMap[$table] ?? $table;
                try { DB::table($targetTable)->truncate(); } catch (\Throwable $e) {}
            }
            DB::statement('PRAGMA foreign_keys = ON');
            $this->info('Existing data cleared.');
        }
        $importOrder = [
            'subscription_plans',
            'readiness_checklist_items',
            'email_templates',
            'email_settings',
            'email_log',
            'payment_gateways',
            'certificate_templates',
            'application_forms',
            'activities',
            'news',
            'products',
            'media',
            'trade_opportunities',
            'contact_messages',
            'pending_applications',
            'member_profiles',
            'user_roles',
            'payment_submissions',
            'certificates',
            'notifications',
            'directory_entries',
            'directory_custom_field_defs',
            'backup_runs',
            'backup_schedules',
            'blog_reactions',
            'member_documents',
            'member_email_preferences',
            'trade_opportunity_interests',
            'application_submissions',
            'member_readiness_responses',
            'membership_applications',
            'event_rsvps',
            'support_tickets',
            'ticket_messages',
        ];

        $totalImported = 0;
        foreach ($importOrder as $tableName) {
            $filePath = $backupPath . '/data/' . $tableName . '.jsonl';
            if (!file_exists($filePath) || filesize($filePath) === 0) continue;

            // Skip system-managed tables
            if (in_array($tableName, $this->skipTables)) {
                $this->line("  SKIP (system): {$tableName}");
                continue;
            }

            // Skip config tables if they already have data
            if (in_array($tableName, $this->skipIfNotEmpty)) {
                $count = DB::table($tableName)->count();
                if ($count > 0) {
                    $this->line("  SKIP (exists): {$tableName} ({$count} rows)");
                    continue;
                }
            }

            $imported = $this->importJsonlTable($tableName, $filePath);
            $totalImported += $imported;
            $this->line("  OK: {$tableName} ({$imported} rows)");
        }

        // Import any remaining tables not in the ordered list
        $orderedTables = array_flip($importOrder);
        foreach ($manifest['tables'] as $tableName => $expectedCount) {
            if (isset($orderedTables[$tableName])) continue;
            if (in_array($tableName, $this->skipTables)) continue;

            $filePath = $backupPath . '/data/' . $tableName . '.jsonl';
            if (!file_exists($filePath) || filesize($filePath) === 0) continue;

            if (in_array($tableName, $this->skipIfNotEmpty)) {
                if (DB::table($tableName)->count() > 0) continue;
            }

            $imported = $this->importJsonlTable($tableName, $filePath);
            $totalImported += $imported;
            if ($imported > 0) $this->line("  OK: {$tableName} ({$imported} rows)");
        }

        // Step 3: Copy storage files
        $this->importStorage($backupPath);

        $this->newLine();
        $this->info("✅ Import complete! {$totalImported} total rows imported.");
        return self::SUCCESS;
    }

    private function importAuthUsers(string $backupPath): void
    {
        $usersPath = $backupPath . '/auth/users.json';
        if (!file_exists($usersPath)) {
            $this->warn("No auth users file found");
            return;
        }

        $users = json_decode(file_get_contents($usersPath), true);
        $this->info("Importing " . count($users) . " auth users...");

        foreach ($users as $supaUser) {
            $email = $supaUser['email'] ?? '';
            if (!$email) continue;

            $existing = DB::table('users')->where('email', $email)->first();

            $name = $supaUser['user_metadata']['full_name']
                ?? $supaUser['app_metadata']['full_name']
                ?? explode('@', $email)[0];

            if ($existing) {
                // Update name if different
                if ($existing->name !== $name) {
                    DB::table('users')->where('id', $existing->id)->update([
                        'name' => $name,
                        'updated_at' => now(),
                    ]);
                }
                $this->line("  EXISTS: {$email}");
                continue;
            }

            // Create user with a random password (they'll need to reset)
            $userId = $supaUser['id'] ?? Str::uuid()->toString();
            $randomPassword = Str::random(16);

            DB::table('users')->insert([
                'id' => $userId,
                'name' => $name,
                'email' => $email,
                'phone' => $supaUser['phone'] ?? null,
                'password' => Hash::make($randomPassword),
                'email_verified_at' => $supaUser['email_confirmed_at'] ?? now(),
                'created_at' => $supaUser['created_at'] ?? now(),
                'updated_at' => now(),
            ]);

            $this->line("  CREATED: {$email} (password: {$randomPassword})");
        }
    }

    private function importJsonlTable(string $tableName, string $filePath): int
    {
        $imported = 0;
        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        // Map table name if needed
        $targetTable = $this->tableMap[$tableName] ?? $tableName;

        foreach ($lines as $lineNum => $line) {
            $line = trim($line);
            if (empty($line)) continue;

            $row = json_decode($line, true);
            if (!$row || !is_array($row)) {
                $this->warn("  WARNING: Invalid JSON on line {$lineNum} of {$tableName}");
                continue;
            }

            // Check if row already exists by ID
            $id = $row['id'] ?? null;
            if ($id) {
                $exists = DB::table($targetTable)->where('id', $id)->first();
                if ($exists) continue; // Skip duplicates
            }

            // Clean row data - remove Supabase-specific fields
            unset($row['updated_at']); // Let MySQL manage this
            if (isset($row['created_at']) && $row['created_at']) {
                $row['created_at'] = $this->parseDate($row['created_at']);
            }

            // Normalize UUID format and date fields
            foreach ($row as $key => $value) {
                if ($value === null || $value === '') continue;
                // Clean ISO dates to Y-m-d H:i:s
                if (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}T/', $value)) {
                    $row[$key] = $this->parseDate($value);
                }
                // Ensure UUIDs are valid
                if ($key === 'id' && is_string($value)) {
                    $row[$key] = $this->cleanUuid($value);
                }
                if (Str::endsWith($key, '_id') && is_string($value)) {
                    $row[$key] = $this->cleanUuid($value);
                }
                // Decode JSON strings (Supabase stores JSON as strings)
                if (is_string($value) && in_array($key, ['blocks', 'schema', 'config', 'options', 'data', 'answers', 'custom_fields', 'transcript'])) {
                    // Keep as string - the column is TEXT/JSON
                }
            }

            // Ensure required columns exist
            if (!isset($row['created_at'])) {
                $row['created_at'] = now()->toDateTimeString();
            }
            if (!isset($row['updated_at'])) {
                $row['updated_at'] = now()->toDateTimeString();
            }

            // Validate all column names exist in the target table
            $existingCols = $this->getTableColumns($targetTable);
            $filteredRow = array_filter($row, fn($key) => in_array($key, $existingCols), ARRAY_FILTER_USE_KEY);

            // Encode arrays/objects as JSON strings for TEXT columns
            foreach ($filteredRow as $key => &$value) {
                if (is_array($value) || is_object($value)) {
                    $value = json_encode($value);
                }
            }
            unset($value);

            if (empty($filteredRow)) continue;

            try {
                DB::table($targetTable)->insert($filteredRow);
                $imported++;
            } catch (\Throwable $e) {
                // Try with just id + non-null values
                $safeRow = array_filter($filteredRow, fn($v) => $v !== null);
                try {
                    DB::table($targetTable)->insert($safeRow);
                    $imported++;
                } catch (\Throwable $e2) {
                    $this->warn("  SKIP row {$lineNum}: " . $e2->getMessage());
                }
            }
        }

        return $imported;
    }

    private function importStorage(string $backupPath): void
    {
        $storagePath = $backupPath . '/storage';
        if (!is_dir($storagePath)) return;

        $buckets = ['content', 'payment-proofs', 'certificate-assets'];
        $this->info("Importing storage files...");

        foreach ($buckets as $bucket) {
            $bucketPath = $storagePath . '/' . $bucket;
            if (!is_dir($bucketPath)) continue;

            $destDir = storage_path('app/public/' . $bucket);
            if (!is_dir($destDir)) @mkdir($destDir, 0755, true);

            $files = $this->getFilesRecursive($bucketPath);
            foreach ($files as $file) {
                $relativePath = str_replace($bucketPath . '/', '', $file);
                $dest = $destDir . '/' . $relativePath;
                $destDir2 = dirname($dest);
                if (!is_dir($destDir2)) @mkdir($destDir2, 0755, true);
                @copy($file, $dest);
            }
            $this->line("  OK: {$bucket} (" . count($files) . " files)");
        }
    }

    private function getFilesRecursive(string $dir): array
    {
        $files = [];
        $items = scandir($dir);
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $path = $dir . '/' . $item;
            if (is_dir($path)) {
                array_push($files, ...$this->getFilesRecursive($path));
            } else {
                $files[] = $path;
            }
        }
        return $files;
    }

    private function parseDate(string $date): string
    {
        $date = preg_replace('/\+\d{2}:\d{2}$/', '', $date); // Remove timezone
        $date = str_replace('T', ' ', $date);
        $date = preg_replace('/\.\d+$/', '', $date); // Remove microseconds
        $ts = strtotime($date);
        return $ts ? date('Y-m-d H:i:s', $ts) : now()->toDateTimeString();
    }

    private function cleanUuid(string $uuid): string
    {
        $uuid = trim($uuid, '"');
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $uuid)) {
            return $uuid;
        }
        return Str::uuid()->toString();
    }

    private function getTableColumns(string $table): array
    {
        static $cache = [];
        if (isset($cache[$table])) return $cache[$table];

        $columns = DB::getSchemaBuilder()->getColumnListing($table);
        $cache[$table] = $columns;
        return $columns;
    }
}
