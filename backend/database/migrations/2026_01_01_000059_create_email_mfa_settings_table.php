<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_mfa_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->index();
            $table->boolean('enabled')->default(false);
            $table->timestamp('enabled_at')->nullable();
            $table->timestamp('disabled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_mfa_settings');
    }
};
