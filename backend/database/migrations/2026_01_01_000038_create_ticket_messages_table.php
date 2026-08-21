<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('ticket_id');
            $table->uuid('sender_id');
            $table->boolean('is_admin')->default(false);
            $table->text('body');
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('ticket_id')->references('id')->on('support_tickets');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_messages');
    }
};
