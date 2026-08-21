<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificate_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('tier');
            $table->string('image_url');
            $table->json('field_positions')->default('{}');
            $table->json('signers')->default('[]');
            $table->string('authorized_name')->nullable();
            $table->string('signature_url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificate_templates');
    }
};
