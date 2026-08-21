<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('member_id');
            $table->uuid('template_id')->nullable();
            $table->string('full_name');
            $table->string('tier');
            $table->string('verification_code');
            $table->boolean('revoked')->default(false);
            $table->timestamp('issued_at')->useCurrent();
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('template_id')->references('id')->on('certificate_templates');
            $table->index('verification_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificates');
    }
};
