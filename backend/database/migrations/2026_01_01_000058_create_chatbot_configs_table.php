<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('chatbot_configs')) {
            Schema::create('chatbot_configs', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->boolean('singleton')->default(false);
                $table->text('welcome_message')->nullable();
                $table->text('system_prompt')->nullable();
                $table->string('model', 100)->default('gpt-3.5-turbo');
                $table->float('temperature')->default(0.7);
                $table->integer('max_tokens')->default(1000);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('chatbot_configs');
    }
};
