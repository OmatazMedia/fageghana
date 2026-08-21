<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('news', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('excerpt')->nullable();
            $table->longText('body')->default('');
            $table->string('category')->default('Industry News');
            $table->string('cover_image_url')->nullable();
            $table->string('author')->default('FAGE Admin');
            $table->boolean('published')->default(true);
            $table->timestamp('published_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('news');
    }
};
