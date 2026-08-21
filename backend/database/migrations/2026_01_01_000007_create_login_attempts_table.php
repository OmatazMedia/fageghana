<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_attempts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('ip', 45);
            $table->string('subnet', 45);
            $table->string('email_tried')->nullable();
            $table->string('outcome');
            $table->string('portal')->default('member');
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index('ip');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_attempts');
    }
};
