<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webhook_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('provider'); // paystack, flutterwave, hubtel
            $table->string('event_type');
            $table->text('payload');
            $table->string('status'); // received, processed, failed, rejected, error
            $table->string('reference')->nullable();
            $table->text('error')->nullable();
            $table->integer('retry_count')->default(0);
            $table->timestamp('next_retry_at')->nullable();
            $table->timestamps();

            $table->index(['provider', 'status']);
            $table->index('next_retry_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_logs');
    }
};
