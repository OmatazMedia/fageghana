<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trade_opportunities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('source')->nullable();
            $table->string('source_url')->nullable()->unique();
            $table->string('category')->nullable();
            $table->string('country')->nullable();
            $table->date('deadline')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('posted_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trade_opportunities');
    }
};
