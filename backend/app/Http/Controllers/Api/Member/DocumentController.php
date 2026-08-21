<?php
namespace App\Http\Controllers\Api\Member;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class DocumentController extends Controller
{
    /** List all documents for the current user. */
    public function index(Request $r)
    {
        $docs = DB::table('member_documents')
            ->where('user_id', $r->user()->id)
            ->orderByDesc('uploaded_at')
            ->get();

        return response()->json(['documents' => $docs]);
    }

    /** Upload a document. */
    public function store(Request $r)
    {
        $v = $r->validate([
            'name' => 'required|string|max:255',
            'doc_type' => 'required|string|max:100',
            'file' => 'required|file|max:10240', // 10MB max
        ]);

        $file = $r->file('file');
        $dir = storage_path('app/private/documents/' . $r->user()->id);
        if (!is_dir($dir)) @mkdir($dir, 0755, true);

        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $file->move($dir, $filename);

        $id = Str::uuid()->toString();
        $relativePath = 'private/documents/' . $r->user()->id . '/' . $filename;

        DB::table('member_documents')->insert([
            'id' => $id,
            'user_id' => $r->user()->id,
            'name' => $v['name'],
            'doc_type' => $v['doc_type'],
            'file_path' => $relativePath,
            'file_size' => $file->getSize(),
            'uploaded_at' => now(),
        ]);

        return response()->json([
            'message' => 'Document uploaded',
            'document' => [
                'id' => $id,
                'name' => $v['name'],
                'doc_type' => $v['doc_type'],
                'file_path' => $relativePath,
                'file_size' => $file->getSize(),
            ],
        ], 201);
    }

    /** Download a document. */
    public function download(Request $r, string $id)
    {
        $doc = DB::table('member_documents')
            ->where('id', $id)
            ->where('user_id', $r->user()->id)
            ->first();

        if (!$doc) return response()->json(['message' => 'Not found'], 404);

        $fullPath = storage_path('app/' . $doc->file_path);
        if (!file_exists($fullPath)) return response()->json(['message' => 'File not found on disk'], 404);

        $mime = File::mimeType($fullPath) ?: 'application/octet-stream';
        return response()->file($fullPath, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'attachment; filename="' . basename($doc->file_path) . '"',
        ]);
    }

    /** Delete a document. */
    public function destroy(Request $r, string $id)
    {
        $doc = DB::table('member_documents')
            ->where('id', $id)
            ->where('user_id', $r->user()->id)
            ->first();

        if (!$doc) return response()->json(['message' => 'Not found'], 404);

        $fullPath = storage_path('app/' . $doc->file_path);
        if (file_exists($fullPath)) @unlink($fullPath);

        DB::table('member_documents')->where('id', $id)->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
