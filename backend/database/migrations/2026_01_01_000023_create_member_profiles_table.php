<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('member_id')->nullable()->unique();
            $table->string('company_name')->default('');
            $table->string('contact_name')->default('');
            $table->string('email')->default('');
            $table->string('phone')->default('');
            $table->string('country')->default('');
            $table->string('industry')->nullable();
            $table->string('products_exported')->nullable();
            $table->string('tier')->default('associate');
            $table->string('status')->default('new');
            $table->text('notes')->nullable();
            $table->string('directory_bio')->nullable();
            $table->string('directory_logo_url')->nullable();
            $table->string('directory_website')->nullable();
            $table->boolean('directory_visible')->default(false);
            $table->timestamp('subscription_start')->nullable();
            $table->timestamp('subscription_expiry')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_profiles');
    }
};
