<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('membership_resources', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->longText('body')->nullable();
            $table->string('category')->nullable();
            $table->string('cover_image_url')->nullable();
            $table->string('file_url')->nullable();
            $table->string('external_url')->nullable();
            $table->string('min_tier')->nullable();
            $table->boolean('published')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('membership_resources');
    }
};
