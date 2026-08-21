<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->boolean('singleton')->default(true)->unique();
            $table->integer('member_idle_minutes')->default(10);
            $table->integer('console_idle_minutes')->default(10);
            $table->integer('countdown_seconds')->default(10);
            $table->boolean('beep_enabled')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });

        DB::table('security_settings')->insert([
            'id' => \Illuminate\Support\Str::uuid()->toString(),
            'singleton' => true,
            'member_idle_minutes' => 10,
            'console_idle_minutes' => 10,
            'countdown_seconds' => 10,
            'beep_enabled' => true,
            'created_at' => now()->toDateTimeString(),
            'updated_at' => now()->toDateTimeString(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('security_settings');
    }
};
