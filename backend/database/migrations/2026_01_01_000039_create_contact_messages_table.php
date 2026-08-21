<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email');
            $table->string('phone')->nullable();
            $table->string('subject')->nullable();
            $table->text('message');
            $table->string('source')->default('website');
            $table->timestamp('handled_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_messages');
    }
};
