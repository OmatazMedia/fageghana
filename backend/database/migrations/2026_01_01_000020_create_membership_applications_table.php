<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('membership_applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tier')->default('associate'); // associate, corporate, standard
            $table->string('company_name');
            $table->string('contact_name');
            $table->string('email');
            $table->string('phone');
            $table->string('country')->default('Ghana');
            $table->string('industry')->nullable();
            $table->string('products_exported')->nullable();
            $table->text('message')->nullable();
            $table->string('status')->default('new'); // new, reviewing, approved, rejected
            $table->text('admin_notes')->nullable();
            $table->uuid('user_id')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('membership_applications');
    }
};
