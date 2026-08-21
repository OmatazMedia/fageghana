<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('directory_custom_field_defs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('key');
            $table->string('label');
            $table->string('field_type'); // text, textarea, select, number, date, checkbox
            $table->json('options')->default('[]');
            $table->boolean('required')->default(false);
            $table->string('help_text')->nullable();
            $table->string('applies_to')->default('all'); // all, association, corporate
            $table->integer('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('directory_custom_field_defs');
    }
};
