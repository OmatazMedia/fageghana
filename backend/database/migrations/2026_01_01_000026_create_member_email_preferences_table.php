<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_email_preferences', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->unique();
            $table->boolean('newsletters')->default(true);
            $table->boolean('event_alerts')->default(true);
            $table->boolean('trade_notices')->default(true);
            $table->boolean('payment_reminders')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_email_preferences');
    }
};
