<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('app_settings', 'setting_key')) {
                $table->string('setting_key')->nullable()->after('id');
            }
            if (!Schema::hasColumn('app_settings', 'setting_value')) {
                $table->text('setting_value')->nullable()->after('setting_key');
            }
        });
    }

    public function down(): void
    {
        Schema::table('app_settings', function (Blueprint $table) {
            $table->dropColumn(['setting_key', 'setting_value']);
        });
    }
};
