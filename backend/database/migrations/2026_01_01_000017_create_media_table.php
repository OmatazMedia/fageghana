<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('media_type')->default('photo'); // photo, video
            $table->string('url');
            $table->string('thumbnail_url')->nullable();
            $table->string('category')->default('General');
            $table->boolean('published')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media');
    }
};
