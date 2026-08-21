<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->boolean('singleton')->default(true)->unique();
            $table->string('primary_provider')->default('smtp');
            $table->boolean('smtp_enabled')->default(false);
            $table->string('smtp_host')->nullable();
            $table->integer('smtp_port')->nullable()->default(587);
            $table->boolean('smtp_secure')->default(true);
            $table->string('smtp_user')->nullable();
            $table->string('smtp_password')->nullable();
            $table->string('smtp_from')->nullable();
            $table->boolean('resend_enabled')->default(false);
            $table->string('resend_api_key')->nullable();
            $table->string('resend_from')->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_settings');
    }
};
