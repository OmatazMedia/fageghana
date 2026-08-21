<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('directory_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug')->unique();
            $table->string('company_name');
            $table->string('contact_name')->nullable();
            $table->string('director_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('website')->nullable();
            $table->string('country')->default('Ghana');
            $table->string('region')->nullable();
            $table->string('physical_address')->nullable();
            $table->string('postal_address')->nullable();
            $table->string('category')->nullable();
            $table->string('entry_type')->default('association'); // association, corporate
            $table->text('short_description')->nullable();
            $table->longText('long_description')->nullable();
            $table->text('mission')->nullable();
            $table->text('vision')->nullable();
            $table->json('products')->default('[]');
            $table->json('services')->default('[]');
            $table->json('executives')->default('[]');
            $table->json('custom_fields')->default('{}');
            $table->string('logo_url')->nullable();
            $table->string('cover_image_url')->nullable();
            $table->boolean('featured')->default(false);
            $table->boolean('published')->default(true);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_admin_owned')->default(false);
            $table->string('status')->default('draft'); // draft, submitted, reviewed, published
            $table->text('review_notes')->nullable();
            $table->uuid('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->integer('display_order')->default(0);
            $table->uuid('user_id')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('directory_entries');
    }
};
