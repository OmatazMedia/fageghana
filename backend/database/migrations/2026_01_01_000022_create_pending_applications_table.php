<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('claim_token')->unique();
            $table->string('full_name');
            $table->string('company_name')->nullable();
            $table->string('email');
            $table->string('phone');
            $table->string('tier');
            $table->uuid('plan_id')->nullable();
            $table->string('status')->default('pending'); // pending, claimed, expired
            $table->uuid('user_id')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('plan_id')->references('id')->on('subscription_plans');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_applications');
    }
};
