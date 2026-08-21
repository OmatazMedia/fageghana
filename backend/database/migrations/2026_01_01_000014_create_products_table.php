<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('category')->default('Fresh Produce');
            $table->text('description')->default('');
            $table->string('image_url')->nullable();
            $table->json('features')->default('[]');
            $table->integer('display_order')->default(0);
            $table->boolean('published')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
