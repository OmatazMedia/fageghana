<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_readiness_responses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('item_id');
            $table->string('status')->default('not_started');
            $table->text('notes')->nullable();
            $table->uuid('evidence_doc_id')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->foreign('item_id')->references('id')->on('readiness_checklist_items');
            $table->foreign('evidence_doc_id')->references('id')->on('member_documents');
            $table->unique(['user_id', 'item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_readiness_responses');
    }
};
