<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('category')->default('Event');
            $table->text('description')->default('');
            $table->string('image_url')->nullable();
            $table->string('location')->nullable();
            $table->timestamp('event_date')->nullable();
            $table->integer('spots_remaining')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->boolean('published')->default(true);
            $table->integer('view_count')->default(0);
            $table->string('register_button_text')->nullable();
            $table->string('register_button_link')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activities');
    }
};
