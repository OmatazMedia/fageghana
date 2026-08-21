<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->uuid('gateway_id')->nullable();
            $table->string('method');
            $table->decimal('amount', 12, 2);
            $table->string('currency')->default('GHS');
            $table->integer('duration_months')->default(12);
            $table->string('status')->default('pending');
            $table->string('reference')->nullable();
            $table->string('kind')->default('new');
            $table->string('member_message')->nullable();
            $table->uuid('pending_application_id')->nullable();
            $table->text('admin_notes')->nullable();
            $table->string('proof_url')->nullable();
            $table->uuid('confirmed_by')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->foreign('gateway_id')->references('id')->on('payment_gateways');
            $table->foreign('pending_application_id')->references('id')->on('pending_applications');
            $table->index('reference');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_submissions');
    }
};
