<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trade_opportunity_interests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('opportunity_id');
            $table->uuid('user_id');
            $table->text('message')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('opportunity_id')->references('id')->on('trade_opportunities');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trade_opportunity_interests');
    }
};
