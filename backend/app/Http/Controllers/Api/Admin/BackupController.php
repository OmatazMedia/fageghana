<?php
namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\BackupService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BackupController extends Controller
{
    public function __construct(private BackupService $backupService) {}

    public function index(Request $r)
    {
        return response()->json(DB::table('backup_runs')->orderByDesc('created_at')->paginate(20));
    }

    public function create(Request $r)
    {
        $result = $this->backupService->createBackup('manual');
        return response()->json(['message' => $result['status'] === 'completed' ? 'Backup created' : 'Backup failed', 'backup' => $result]);
    }

    public function download(Request $r, string $id)
    {
        $backup = DB::table('backup_runs')->where('id', $id)->first();
        if (!$backup) return response()->json(['message' => 'Not found'], 404);
        if (!$backup->file_path || !file_exists($backup->file_path)) return response()->json(['message' => 'Backup file not found'], 404);
        return response()->download($backup->file_path, basename($backup->file_path));
    }

    public function restore(Request $r, string $id)
    {
        $backup = DB::table('backup_runs')->where('id', $id)->first();
        if (!$backup || !$backup->file_path) return response()->json(['message' => 'Not found'], 404);
        $success = $this->backupService->restoreBackup($backup->file_path);
        return response()->json(['message' => $success ? 'Restored' : 'Restore failed']);
    }

    public function destroy(Request $r, string $id)
    {
        $backup = DB::table('backup_runs')->where('id', $id)->first();
        if ($backup && $backup->storage_path && file_exists($backup->storage_path)) unlink($backup->storage_path);
        DB::table('backup_run_uploads')->where('run_id', $id)->delete();
        DB::table('backup_runs')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function testDestination(Request $r)
    {
        $v = $r->validate([
            'provider' => 'required|in:google_drive,s3,local',
            'config' => 'required|array',
        ]);
        $result = $this->backupService->testDestination($v['provider'], $v['config']);
        return response()->json($result);
    }

    public function uploadResults(Request $r, string $id)
    {
        $uploads = DB::table('backup_run_uploads')->where('run_id', $id)->orderByDesc('created_at')->get();
        return response()->json(['uploads' => $uploads]);
    }
}
