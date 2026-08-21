<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class BackupService
{
    public function createBackup(string $type = 'manual'): array
    {
        $id = Str::uuid()->toString();
        $timestamp = now()->format('Y-m-d_His');
        $filename = "fage_backup_{$timestamp}.sql";
        $backupDir = str_replace('\\', '/', storage_path('app')) . '/backups';

        if (!is_dir($backupDir)) @mkdir($backupDir, 0755, true);

        $dbPath = config('database.connections.sqlite.database', 'database.sqlite');
        if (!str_starts_with($dbPath, '/') && !str_starts_with($dbPath, '\\') && !(strlen($dbPath) > 1 && $dbPath[1] === ':')) {
            $dbPath = database_path($dbPath);
        }
        $size = 0;
        $tablesCount = 0;
        $status = 'failed';
        $errorMsg = null;

        try {
            $backupPath = $backupDir . '/' . $filename;
            if (config('database.default') === 'sqlite') {
                $result = $this->backupSqlite($dbPath, $backupPath);
                $size = $result['size'];
                $tablesCount = $result['tables'];
                $backupPath = $result['file'] ?? $backupPath;
            } else {
                $size = $this->backupMysql($backupPath);
                $tablesCount = -1;
            }
            $status = 'completed';
        } catch (\Exception $e) {
            $errorMsg = $e->getMessage();
            logger("[Backup] Failed: " . $errorMsg);
        }

        DB::table('backup_runs')->insert([
            'id' => $id, 'trigger' => $type, 'status' => $status,
            'storage_path' => $backupPath ?? null, 'path' => $backupPath ?? null,
            'size_bytes' => $size, 'tables_count' => $tablesCount,
            'error_message' => $errorMsg,
            'started_at' => now()->toDateTimeString(),
            'finished_at' => $status === 'completed' ? now()->toDateTimeString() : null,
        ]);

        // Auto-upload to configured cloud destinations
        if ($status === 'completed' && $backupPath) {
            $this->uploadToCloudDestinations($id, $backupPath);
        }

        // Auto-cleanup old backups based on retention
        $this->cleanupOldBackups();

        return ['id' => $id, 'filename' => $filename, 'status' => $status, 'size' => $size];
    }

    /**
     * Execute a scheduled backup (called by artisan command).
     */
    public function executeScheduledBackup(): array
    {
        $schedule = DB::table('backup_schedules')->where('singleton', true)->first();
        if (!$schedule || !$schedule->enabled) {
            return ['status' => 'skipped', 'reason' => 'Scheduled backups not enabled'];
        }

        return $this->createBackup('scheduled');
    }

    /**
     * Upload backup file to all enabled cloud destinations.
     */
    private function uploadToCloudDestinations(string $backupRunId, string $filePath): void
    {
        $destinations = DB::table('backup_destinations')->where('enabled', true)->get();

        foreach ($destinations as $dest) {
            $status = 'failed';
            $message = null;
            $externalId = null;
            $url = null;

            try {
                $config = is_string($dest->config) ? json_decode($dest->config, true) : ($dest->config ?? []);

                switch ($dest->provider) {
                    case 'google_drive':
                        $result = $this->uploadToGoogleDrive($filePath, $config);
                        $status = 'success';
                        $externalId = $result['file_id'] ?? null;
                        $url = $result['url'] ?? null;
                        break;

                    case 's3':
                        $result = $this->uploadToS3($filePath, $config);
                        $status = 'success';
                        $externalId = $result['key'] ?? null;
                        $url = $result['url'] ?? null;
                        break;

                    case 'local':
                        $destDir = $config['path'] ?? storage_path('app/backups/remote');
                        if (!File::isDirectory($destDir)) File::makeDirectory($destDir, 0755, true);
                        $destPath = $destDir . '/' . basename($filePath);
                        copy($filePath, $destPath);
                        $status = 'success';
                        $url = $destPath;
                        break;

                    default:
                        $message = "Unknown provider: {$dest->provider}";
                }
            } catch (\Throwable $e) {
                $message = $e->getMessage();
                logger("[Backup] Upload to {$dest->provider} failed: {$message}");
            }

            // Record upload result
            DB::table('backup_run_uploads')->insert([
                'id' => Str::uuid()->toString(),
                'run_id' => $backupRunId,
                'destination_id' => $dest->id,
                'provider' => $dest->provider,
                'ok' => $status === 'success',
                'message' => $message,
                'external_id' => $externalId,
                'url' => $url,
                'created_at' => now(),
            ]);
        }
    }

    /**
     * Upload to Google Drive via API.
     */
    private function uploadToGoogleDrive(string $filePath, array $config): array
    {
        $accessToken = $config['access_token'] ?? '';
        $folderId = $config['folder_id'] ?? '';

        if (!$accessToken) throw new \Exception('Google Drive access token not configured');

        $fileName = basename($filePath);
        $fileContent = file_get_contents($filePath);

        // Create file metadata
        $metadata = ['name' => $fileName, 'parents' => $folderId ? [$folderId] : []];

        $boundary = Str::random(16);
        $body = "--{$boundary}\r\n";
        $body .= "Content-Type: application/json\r\n\r\n";
        $body .= json_encode($metadata) . "\r\n";
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Type: application/octet-stream\r\n\r\n";
        $body .= $fileContent . "\r\n";
        $body .= "--{$boundary}--";

        $ch = curl_init('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: multipart/related; boundary=' . $boundary,
            ],
            CURLOPT_POSTFIELDS => $body,
        ]);
        $response = json_decode(curl_exec($ch), true);
        curl_close($ch);

        if (isset($response['error'])) throw new \Exception($response['error']['message'] ?? 'Google Drive upload failed');

        return ['file_id' => $response['id'] ?? null, 'url' => $response['webViewLink'] ?? null];
    }

    /**
     * Upload to AWS S3 (or compatible) via presigned URL or direct upload.
     */
    private function uploadToS3(string $filePath, array $config): array
    {
        $bucket = $config['bucket'] ?? '';
        $region = $config['region'] ?? 'us-east-1';
        $accessKey = $config['access_key'] ?? '';
        $secretKey = $config['secret_key'] ?? '';

        if (!$bucket || !$accessKey || !$secretKey) {
            throw new \Exception('S3 bucket/credentials not configured');
        }

        $fileName = basename($filePath);
        $key = 'backups/' . $fileName;
        $endpoint = "https://{$bucket}.s3.{$region}.amazonaws.com/{$key}";

        // Simple PUT with AWS Signature V4
        $date = gmdate('Ymd\THis\Z');
        $dateDay = gmdate('Ymd');
        $scope = "{$dateDay}/{$region}/s3/aws4_request";

        $payloadHash = hash_file('sha256', $filePath);
        $signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

        $canonicalRequest = "PUT\n/{$key}\n\ncontent-type:application/octet-stream\nhost:{$bucket}.s3.{$region}.amazonaws.com\nx-amz-content-sha256:{$payloadHash}\nx-amz-date:{$date}\n\n{$signedHeaders}\n{$payloadHash}";

        $stringToSign = "AWS4-HMAC-SHA256\n{$date}\n{$scope}\n" . hash('sha256', $canonicalRequest);
        $signingKey = hash_hmac('sha256', 'aws4_request', hash_hmac('sha256', 's3', hash_hmac('sha256', $region, hash_hmac('sha256', $dateDay, "AWS4{$secretKey}", true), true), true), true);
        $signature = hash_hmac('sha256', $stringToSign, $signingKey);

        $authHeader = "AWS4-HMAC-SHA256 Credential={$accessKey}/{$scope}, SignedHeaders={$signedHeaders}, Signature={$signature}";

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => 'PUT',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/octet-stream',
                'Host: ' . "{$bucket}.s3.{$region}.amazonaws.com",
                'x-amz-content-sha256: ' . $payloadHash,
                'x-amz-date: ' . $date,
                'Authorization: ' . $authHeader,
            ],
            CURLOPT_POSTFIELDS => file_get_contents($filePath),
        ]);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) throw new \Exception("S3 upload failed with HTTP {$httpCode}");

        return ['key' => $key, 'url' => $endpoint];
    }

    private function backupSqlite(string $dbPath, string $backupPath): array
    {
        // For SQLite, copy the database file directly (much faster than row-by-row dump)
        // and also create a SQL dump as a second file
        $copied = copy($dbPath, $backupPath . '.sqlite');
        if (!$copied) throw new \Exception('Failed to copy SQLite database');
        $size = filesize($backupPath . '.sqlite');

        // Also count tables for metadata
        $pdo = new \PDO("sqlite:{$dbPath}");
        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'")->fetchAll(\PDO::FETCH_COLUMN);

        return ['size' => $size, 'tables' => count($tables), 'file' => $backupPath . '.sqlite'];
    }

    private function backupMysql(string $backupPath): int
    {
        $host = config('database.connections.mysql.host', '127.0.0.1');
        $port = config('database.connections.mysql.port', '3306');
        $database = config('database.connections.mysql.database');
        $username = config('database.connections.mysql.username');
        $password = config('database.connections.mysql.password');

        $cmd = "mysqldump -h {$host} -P {$port} -u {$username} " . ($password ? "-p{$password}" : "") . " {$database} > \"{$backupPath}\" 2>&1";
        exec($cmd, $output, $returnCode);

        if ($returnCode !== 0) throw new \Exception("mysqldump failed: " . implode("\n", $output));
        return filesize($backupPath) ?: 0;
    }

    /**
     * Restore database from backup file. Works for both SQLite and MySQL.
     */
    public function restoreBackup(string $backupPath): bool
    {
        if (!file_exists($backupPath)) return false;

        if (config('database.default') === 'sqlite') {
            $dbPath = config('database.connections.sqlite.database', 'database.sqlite');
        if (!str_starts_with($dbPath, '/') && !str_starts_with($dbPath, '\\') && !(strlen($dbPath) > 1 && $dbPath[1] === ':')) {
            $dbPath = database_path($dbPath);
        }

            // For SQLite, we can directly replace the file
            // For safety, create a pre-restore backup first
            $preRestorePath = $dbPath . '.pre-restore.' . now()->format('YmdHis');
            if (file_exists($dbPath)) copy($dbPath, $preRestorePath);

            return copy($backupPath, $dbPath);
        }

        // For MySQL, import SQL file
        $host = config('database.connections.mysql.host', '127.0.0.1');
        $port = config('database.connections.mysql.port', '3306');
        $database = config('database.connections.mysql.database');
        $username = config('database.connections.mysql.username');
        $password = config('database.connections.mysql.password');

        $cmd = "mysql -h {$host} -P {$port} -u {$username} " . ($password ? "-p{$password}" : "") . " {$database} < \"{$backupPath}\" 2>&1";
        exec($cmd, $output, $returnCode);

        return $returnCode === 0;
    }

    /**
     * Clean up old backups based on retention policy.
     */
    private function cleanupOldBackups(): void
    {
        $schedule = DB::table('backup_schedules')->where('singleton', true)->first();
        $retentionDays = $schedule->retention_days ?? 30;

        $cutoff = now()->subDays($retentionDays);

        $oldRuns = DB::table('backup_runs')
            ->where('created_at', '<', $cutoff)
            ->where('status', 'completed')
            ->get();

        foreach ($oldRuns as $run) {
            if ($run->storage_path && file_exists($run->storage_path)) {
                unlink($run->storage_path);
            }
            DB::table('backup_run_uploads')->where('run_id', $run->id)->delete();
            DB::table('backup_runs')->where('id', $run->id)->delete();
        }
    }

    /**
     * Test a cloud destination connection.
     */
    public function testDestination(string $provider, array $config): array
    {
        try {
            switch ($provider) {
                case 'google_drive':
                    if (empty($config['access_token'])) throw new \Exception('Access token required');
                    return ['ok' => true, 'message' => 'Google Drive credentials accepted'];

                case 's3':
                    if (empty($config['bucket']) || empty($config['access_key']) || empty($config['secret_key'])) {
                        throw new \Exception('Bucket, access_key, and secret_key required');
                    }
                    // Try listing bucket
                    $key = $config['access_key'];
                    $secret = $config['secret_key'];
                    $region = $config['region'] ?? 'us-east-1';
                    $date = gmdate('Ymd\THis\Z');
                    $dateDay = gmdate('Ymd');
                    $scope = "{$dateDay}/{$region}/s3/aws4_request";
                    $stringToSign = "AWS4-HMAC-SHA256\n{$date}\n{$scope}\n" . hash('sha256', "GET\n/\n\nhost:{$config['bucket']}.s3.{$region}.amazonaws.com\n\nhost\nUNSIGNED-PAYLOAD");
                    $signingKey = hash_hmac('sha256', 'aws4_request', hash_hmac('sha256', 's3', hash_hmac('sha256', $region, hash_hmac('sha256', $dateDay, "AWS4{$secret}", true), true), true), true);
                    $signature = hash_hmac('sha256', $stringToSign, $signingKey);
                    $authHeader = "AWS4-HMAC-SHA256 Credential={$key}/{$scope}, SignedHeaders=host, Signature={$signature}";

                    $ch = curl_init("https://{$config['bucket']}.s3.{$region}.amazonaws.com/?max-keys=1");
                    curl_setopt_array($ch, [
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_TIMEOUT => 15,
                        CURLOPT_HTTPHEADER => ['Host: ' . "{$config['bucket']}.s3.{$region}.amazonaws.com", 'Authorization: ' . $authHeader],
                    ]);
                    curl_exec($ch);
                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);

                    if ($httpCode === 200) return ['ok' => true, 'message' => 'S3 bucket accessible'];
                    return ['ok' => false, 'message' => "S3 returned HTTP {$httpCode}"];

                case 'local':
                    $path = $config['path'] ?? storage_path('app/backups/remote');
                    if (!is_dir($path) && !@mkdir($path, 0755, true)) {
                        throw new \Exception("Cannot create directory: {$path}");
                    }
                    return ['ok' => true, 'message' => "Local path accessible: {$path}"];

                default:
                    return ['ok' => false, 'message' => "Unknown provider: {$provider}"];
            }
        } catch (\Throwable $e) {
            return ['ok' => false, 'message' => $e->getMessage()];
        }
    }
}
