<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StorageController extends Controller
{
    private const BUCKET_PATTERN = '/^[a-z0-9_-]+$/i';

    private function disk()
    {
        return Storage::disk('public');
    }

    private function sanitizeBucket(string $bucket): ?string
    {
        $bucket = trim($bucket, '/');
        return preg_match(self::BUCKET_PATTERN, $bucket) ? $bucket : null;
    }

    private function sanitizePath(string $path): ?string
    {
        $path = str_replace('\\', '/', $path);
        $path = trim($path, '/');
        if ($path === '') return null;
        $parts = explode('/', $path);
        foreach ($parts as $part) {
            if ($part === '' || $part === '.' || $part === '..') return null;
        }
        if (preg_match('/[^\w.\-\/ ]/', $path)) return null;
        return $path;
    }

    private function publicUrl(string $bucket, string $path): string
    {
        return '/api/storage/' . rawurlencode($bucket) . '/' . implode('/', array_map('rawurlencode', explode('/', $path)));
    }

    /**
     * POST /api/storage/upload — multipart form: file, bucket, path
     */
    public function upload(Request $request)
    {
        $bucket = $this->sanitizeBucket((string) $request->input('bucket', 'content'));
        $path = $this->sanitizePath((string) $request->input('path', ''));
        if (!$bucket || !$path) {
            return response()->json(['message' => 'Invalid bucket or path'], 422);
        }
        if (!$request->hasFile('file') || !$request->file('file')->isValid()) {
            return response()->json(['message' => 'No valid file provided'], 422);
        }

        $file = $request->file('file');
        $relative = $bucket . '/' . $path;
        $this->disk()->putFileAs(dirname($relative), $file, basename($relative));

        return response()->json([
            'url' => $this->publicUrl($bucket, $path),
            'path' => $path,
            'fullPath' => $this->publicUrl($bucket, $path),
            'bucket' => $bucket,
        ]);
    }

    /**
     * DELETE /api/storage/remove — JSON { bucket, paths: [...] }
     */
    public function remove(Request $request)
    {
        $data = $request->json()->all();
        $bucket = $this->sanitizeBucket((string) ($data['bucket'] ?? ''));
        $paths = $data['paths'] ?? [];
        if (!$bucket || !is_array($paths)) {
            return response()->json(['message' => 'Invalid request'], 422);
        }

        $removed = [];
        foreach ($paths as $p) {
            $clean = $this->sanitizePath((string) $p);
            if ($clean === null) continue;
            $relative = $bucket . '/' . $clean;
            if ($this->disk()->exists($relative)) {
                $this->disk()->delete($relative);
                $removed[] = $p;
            }
        }
        return response()->json(['data' => ['removed' => $removed]]);
    }

    /**
     * POST /api/storage/{bucket}/list — JSON { prefix }
     */
    public function list(Request $request, string $bucket)
    {
        $bucket = $this->sanitizeBucket($bucket);
        if (!$bucket) {
            return response()->json(['message' => 'Invalid bucket'], 422);
        }
        $prefix = $this->sanitizePath((string) ($request->json('prefix') ?? ''));
        $dir = $prefix !== null ? $bucket . '/' . $prefix : $bucket;

        $files = [];
        $all = $this->disk()->allFiles($dir);
        foreach ($all as $f) {
            $rel = substr($f, strlen($bucket) + 1);
            $files[] = [
                'name' => basename($f),
                'path' => $rel,
                'url' => $this->publicUrl($bucket, $rel),
                'size' => $this->disk()->size($f),
                'updated_at' => $this->disk()->lastModified($f),
            ];
        }
        return response()->json(['data' => $files]);
    }

    /**
     * GET /api/storage/{bucket}/{path} — serve the file
     */
    public function serve(Request $request, string $bucket, string $path)
    {
        $bucket = $this->sanitizeBucket($bucket);
        $path = $this->sanitizePath($path);
        if (!$bucket || !$path) {
            abort(404);
        }
        $relative = $bucket . '/' . $path;
        if (!$this->disk()->exists($relative)) {
            abort(404);
        }
        $mime = $this->disk()->mimeType($relative) ?? 'application/octet-stream';
        return response()->file($this->disk()->path($relative), ['Content-Type' => $mime]);
    }
}