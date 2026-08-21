<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ip_bans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('ip', 45)->unique();
            $table->string('subnet', 45);
            $table->integer('strikes')->default(0);
            $table->integer('warning_count')->default(0);
            $table->string('last_email_tried')->nullable();
            $table->string('reason')->nullable();
            $table->timestamp('banned_at')->nullable();
            $table->timestamp('unbanned_at')->nullable();
            $table->string('unbanned_by')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ip_bans');
    }
};
