<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('session_fingerprint');
            $table->string('browser')->nullable();
            $table->string('os')->nullable();
            $table->string('device_label')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->boolean('suspicious')->default(false);
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_reason')->nullable();
            $table->timestamp('last_seen_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_sessions');
    }
};
