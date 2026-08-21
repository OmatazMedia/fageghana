<?php
namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DirectoryCustomFieldController extends Controller
{
    /** List all custom field definitions. */
    public function index(Request $r)
    {
        $fields = DB::table('directory_custom_field_defs')
            ->orderBy('display_order')
            ->orderBy('created_at')
            ->get();

        return response()->json(['fields' => $fields]);
    }

    /** Create a new custom field definition. */
    public function store(Request $r)
    {
        $v = $r->validate([
            'key' => 'required|string|max:100|unique:directory_custom_field_defs,key',
            'label' => 'required|string|max:255',
            'field_type' => 'required|string|in:text,textarea,select,number,date,checkbox',
            'options' => 'nullable|array',
            'required' => 'sometimes|boolean',
            'help_text' => 'nullable|string',
            'applies_to' => 'nullable|string|in:all,association,corporate',
            'display_order' => 'nullable|integer',
        ]);

        $id = Str::uuid()->toString();
        DB::table('directory_custom_field_defs')->insert([
            'id' => $id,
            'key' => $v['key'],
            'label' => $v['label'],
            'field_type' => $v['field_type'],
            'options' => json_encode($v['options'] ?? []),
            'required' => $v['required'] ?? false,
            'help_text' => $v['help_text'] ?? null,
            'applies_to' => $v['applies_to'] ?? 'all',
            'display_order' => $v['display_order'] ?? 0,
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Field created', 'id' => $id], 201);
    }

    /** Update a custom field definition. */
    public function update(Request $r, string $id)
    {
        $field = DB::table('directory_custom_field_defs')->where('id', $id)->first();
        if (!$field) return response()->json(['message' => 'Not found'], 404);

        $v = $r->validate([
            'label' => 'sometimes|string|max:255',
            'field_type' => 'sometimes|string|in:text,textarea,select,number,date,checkbox',
            'options' => 'nullable|array',
            'required' => 'sometimes|boolean',
            'help_text' => 'nullable|string',
            'applies_to' => 'sometimes|string|in:all,association,corporate',
            'display_order' => 'sometimes|integer',
            'active' => 'sometimes|boolean',
        ]);

        if (isset($v['options'])) $v['options'] = json_encode($v['options']);
        $v['updated_at'] = now();

        DB::table('directory_custom_field_defs')->where('id', $id)->update($v);

        return response()->json(['message' => 'Updated']);
    }

    /** Delete a custom field definition. */
    public function destroy(Request $r, string $id)
    {
        $field = DB::table('directory_custom_field_defs')->where('id', $id)->first();
        if (!$field) return response()->json(['message' => 'Not found'], 404);

        DB::table('directory_custom_field_defs')->where('id', $id)->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
