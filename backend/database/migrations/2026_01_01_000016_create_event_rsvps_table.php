<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_rsvps', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('activity_id');
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->foreign('activity_id')->references('id')->on('activities');
            $table->unique(['user_id', 'activity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_rsvps');
    }
};
