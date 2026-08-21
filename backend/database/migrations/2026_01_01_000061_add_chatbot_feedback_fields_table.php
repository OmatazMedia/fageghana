<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chatbot_feedback', function (Blueprint $table) {
            if (!Schema::hasColumn('chatbot_feedback', 'user_message')) {
                $table->text('user_message')->nullable()->after('session_id');
            }
            if (!Schema::hasColumn('chatbot_feedback', 'bot_response')) {
                $table->text('bot_response')->nullable()->after('user_message');
            }
        });
    }

    public function down(): void
    {
        Schema::table('chatbot_feedback', function (Blueprint $table) {
            $table->dropColumn(['user_message', 'bot_response']);
        });
    }
};
