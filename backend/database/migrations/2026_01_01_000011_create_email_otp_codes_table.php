<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_otp_codes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('purpose')->default('mfa');
            $table->string('code_hash');
            $table->integer('attempts')->default(0);
            $table->timestamp('consumed_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'purpose', 'created_at']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_otp_codes');
    }
};
