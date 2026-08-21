<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add updated_at to chatbot_feedback (only has created_at)
        Schema::table('chatbot_feedback', function (Blueprint $table) {
            if (!Schema::hasColumn('chatbot_feedback', 'updated_at')) {
                $table->timestamp('updated_at')->nullable()->after('created_at');
            }
        });

        // Add category to support_tickets
        Schema::table('support_tickets', function (Blueprint $table) {
            if (!Schema::hasColumn('support_tickets', 'category')) {
                $table->string('category')->nullable()->after('priority');
            }
        });
    }

    public function down(): void
    {
        Schema::table('chatbot_feedback', function (Blueprint $table) {
            $table->dropColumn('updated_at');
        });
        Schema::table('support_tickets', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }
};
