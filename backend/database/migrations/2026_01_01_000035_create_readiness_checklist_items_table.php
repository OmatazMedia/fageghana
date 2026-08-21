<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('readiness_checklist_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('label');
            $table->text('description')->nullable();
            $table->string('category');
            $table->integer('weight')->default(1);
            $table->integer('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('readiness_checklist_items');
    }
};
