<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_hero_slides', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('image_url');
            $table->string('eyebrow')->nullable();
            $table->string('title')->nullable();
            $table->text('subtitle')->nullable();
            $table->string('cta_label')->nullable();
            $table->string('cta_href')->nullable();
            $table->integer('display_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_hero_slides');
    }
};
