<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_run_uploads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('run_id');
            $table->uuid('destination_id')->nullable();
            $table->string('provider');
            $table->boolean('ok');
            $table->string('external_id')->nullable();
            $table->string('url')->nullable();
            $table->text('message')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('run_id')->references('id')->on('backup_runs');
            $table->foreign('destination_id')->references('id')->on('backup_destinations');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_run_uploads');
    }
};
