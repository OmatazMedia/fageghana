<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_schedules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('frequency')->default('daily'); // daily, weekly, monthly
            $table->string('cron_expression')->nullable();
            $table->integer('hour_of_day')->default(2);
            $table->integer('minute_of_hour')->default(0);
            $table->integer('day_of_week')->default(0);
            $table->integer('day_of_month')->default(1);
            $table->integer('retention_days')->default(30);
            $table->boolean('enabled')->default(true);
            $table->timestamp('last_run_at')->nullable();
            $table->string('last_status')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamp('next_run_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_schedules');
    }
};
