<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('app_settings')) {
            Schema::create('app_settings', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->boolean('singleton')->default(false);
                $table->string('site_name')->nullable();
                $table->string('site_url')->nullable();
                $table->string('currency', 10)->nullable()->default('GHS');
                $table->string('timezone', 100)->nullable()->default('Africa/Accra');
                $table->string('logo_url')->nullable();
                $table->string('primary_color', 20)->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
