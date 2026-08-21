<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chatbot_feedback', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('session_id');
            $table->uuid('user_id')->nullable();
            $table->string('kind');
            $table->text('question')->nullable();
            $table->text('bot_reply')->nullable();
            $table->boolean('helpful')->nullable();
            $table->integer('rating')->nullable();
            $table->text('comment')->nullable();
            $table->string('page_url')->nullable();
            $table->json('transcript')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chatbot_feedback');
    }
};
