<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blog_reactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('news_id');
            $table->string('session_id');
            $table->string('emoji');
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['news_id', 'session_id', 'emoji']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blog_reactions');
    }
};
