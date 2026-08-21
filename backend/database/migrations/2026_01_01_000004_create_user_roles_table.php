<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_roles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('role', 50); // enum: admin,editor,user,staff,moderator,finance,ceo,developer,coordinator,superadmin
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['user_id', 'role']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_roles');
    }
};
