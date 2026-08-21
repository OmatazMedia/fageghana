<?php
namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BackupDestinationController extends Controller
{

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    public function test(Request $r, string $id) {
        $dest = DB::table("backup_destinations")->where("id", $id)->first();
        if (!$dest) return response()->json(["ok" => false, "message" => "Destination not found"], 404);

        $config = json_decode((string) ($dest->config ?? '{}'), true) ?: [];
        $ok = false;
        $message = '';

        switch ($dest->provider) {
            case 'google_drive':
                if (empty($config['client_email']) || empty($config['private_key'])) {
                    $message = 'Missing client_email or private_key in config';
                } else {
                    try {
                        $header = self::base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
                        $claims = self::base64UrlEncode(json_encode([
                            'iss' => $config['client_email'],
                            'scope' => 'https://www.googleapis.com/auth/drive',
                            'aud' => 'https://oauth2.googleapis.com/token',
                            'iat' => time(),
                            'exp' => time() + 3600,
                        ]));
                        $signature = '';
                        $signed = openssl_sign("{$header}.{$claims}", $signature, $config['private_key'], OPENSSL_ALGO_SHA256);
                        $ok = $signed && $signature !== '';
                        $message = $ok
                            ? 'Google Drive credentials valid (JWT assertion signed)'
                            : 'Failed to sign JWT with the configured private key';
                    } catch (\Throwable $e) {
                        $message = 'Invalid Google Drive config: ' . $e->getMessage();
                    }
                }
                break;

            case 'local':
                $path = $config['path'] ?? null;
                if (!$path) {
                    $message = 'Missing path in config';
                } elseif (!is_dir($path)) {
                    $message = "Path is not a directory: {$path}";
                } elseif (!is_writable($path)) {
                    $message = "Path is not writable: {$path}";
                } else {
                    $ok = true;
                    $message = "Local path is writable: {$path}";
                }
                break;

            case 'ftp':
            case 'sftp':
                if (empty($config['host']) || empty($config['user'])) {
                    $message = 'Missing host or user in config';
                } else {
                    $ok = true;
                    $message = "{$dest->provider} config valid ({$config['host']})";
                }
                break;

            case 'webdav':
                if (empty($config['url']) || !filter_var($config['url'], FILTER_VALIDATE_URL)) {
                    $message = 'Missing or invalid url in config';
                } else {
                    $ok = true;
                    $message = 'WebDAV url configured';
                }
                break;

            default:
                $message = "Unsupported provider: {$dest->provider}";
        }

        DB::table("backup_destinations")->where("id", $id)->update([
            "last_test_ok" => $ok,
            "last_test_message" => $message,
            "last_test_at" => now(),
            "updated_at" => now(),
        ]);

        return response()->json(["ok" => $ok, "message" => $message]);
    }

}