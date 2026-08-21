<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_reads', function (Blueprint $table) {
            $table->uuid('user_id');
            $table->string('source_table');
            $table->uuid('source_id');
            $table->timestamp('read_at')->useCurrent();
            $table->primary(['user_id', 'source_table', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_reads');
    }
};
