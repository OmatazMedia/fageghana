<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tier'); // associate, corporate, standard
            $table->string('name')->nullable();
            $table->text('description')->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('currency')->default('GHS');
            $table->integer('duration_months')->default(12);
            $table->boolean('active')->default(true);
            $table->integer('display_order')->default(0);
            $table->string('slug')->nullable();
            $table->string('id_abbreviation')->nullable();
            $table->string('application_form_pdf_url')->nullable();
            $table->string('bank_deposit_email')->nullable();
            $table->text('post_download_message')->nullable();
            $table->uuid('certificate_template_id')->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_plans');
    }
};
