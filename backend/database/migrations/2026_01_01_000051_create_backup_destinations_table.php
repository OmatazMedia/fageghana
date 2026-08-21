<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_destinations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('provider'); // local, google_drive, s3
            $table->json('config')->default('{}');
            $table->boolean('enabled')->default(true);
            $table->boolean('is_default')->default(false);
            $table->uuid('created_by')->nullable();
            $table->boolean('last_test_ok')->nullable();
            $table->text('last_test_message')->nullable();
            $table->timestamp('last_test_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_destinations');
    }
};
