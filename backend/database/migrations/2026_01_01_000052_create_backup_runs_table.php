<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('trigger')->default('manual'); // manual, scheduled
            $table->string('status')->default('running'); // running, success, failed
            $table->string('storage_path')->nullable();
            $table->string('path')->nullable();
            $table->bigInteger('size_bytes')->nullable();
            $table->integer('tables_count')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('finished_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_runs');
    }
};
