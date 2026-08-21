#!/bin/bash
# This script creates all migration files for the FAGE Ghana backend
# Run from the backend directory

MIGRATIONS_DIR="database/migrations"

# Remove default Laravel migrations
rm -f "$MIGRATIONS_DIR/0001_01_01_000000_create_users_table.php"
rm -f "$MIGRATIONS_DIR/0001_01_01_000001_create_cache_table.php"
rm -f "$MIGRATIONS_DIR/0001_01_01_000002_create_jobs_table.php"

echo "Creating migrations..."

# ============================================
# 001 - Users Table (extends default)
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000001_create_users_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->string('phone')->nullable();
            $table->string('timezone')->nullable()->default('Africa/Accra');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignUuid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
MIGRATION

# ============================================
# 002 - Cache & Jobs tables
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000002_create_cache_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->integer('expiration');
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cache_locks');
        Schema::dropIfExists('cache');
    }
};
MIGRATION

cat > "$MIGRATIONS_DIR/2026_01_01_000003_create_jobs_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jobs', function (Blueprint $table) {
            $table->id();
            $table->string('queue')->index();
            $table->longText('payload');
            $table->unsignedTinyInteger('attempts');
            $table->unsignedInteger('reserved_at')->nullable();
            $table->unsignedInteger('available_at');
            $table->unsignedInteger('created_at');
        });

        Schema::create('job_batches', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->integer('total_jobs');
            $table->integer('pending_jobs');
            $table->integer('failed_jobs');
            $table->longText('failed_job_ids');
            $table->mediumText('options')->nullable();
            $table->integer('cancelled_at')->nullable();
            $table->integer('created_at');
            $table->integer('finished_at')->nullable();
        });

        Schema::create('failed_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestamp('failed_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('failed_jobs');
        Schema::dropIfExists('job_batches');
        Schema::dropIfExists('jobs');
    }
};
MIGRATION

# ============================================
# 004 - User Roles
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000004_create_user_roles_table.php" << 'MIGRATION'
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
            $table->unique(['user_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_roles');
    }
};
MIGRATION

# ============================================
# 005 - Role Permissions
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000005_create_role_permissions_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_permissions', function (Blueprint $table) {
            $table->string('role', 50);
            $table->string('permission_key');
            $table->boolean('enabled')->default(true);
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->primary(['role', 'permission_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
    }
};
MIGRATION

# ============================================
# 006 - Role Help
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000006_create_role_help_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_help', function (Blueprint $table) {
            $table->string('role', 50)->primary();
            $table->string('summary')->default('');
            $table->text('details')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_help');
    }
};
MIGRATION

# ============================================
# 007 - Login Attempts
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000007_create_login_attempts_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_attempts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('ip', 45);
            $table->string('subnet', 45);
            $table->string('email_tried')->nullable();
            $table->string('outcome'); // success, failure, blocked
            $table->string('portal')->default('member'); // member, admin, console
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::index('login_attempts', 'login_attempts_ip_idx');
        Schema::index('login_attempts', 'login_attempts_created_idx');
    }

    public function down(): void
    {
        Schema::dropIfExists('login_attempts');
    }
};
MIGRATION

# ============================================
# 008 - IP Bans
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000008_create_ip_bans_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ip_bans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('ip', 45)->unique();
            $table->string('subnet', 45);
            $table->integer('strikes')->default(0);
            $table->integer('warning_count')->default(0);
            $table->string('last_email_tried')->nullable();
            $table->string('reason')->nullable();
            $table->timestamp('banned_at')->nullable();
            $table->timestamp('unbanned_at')->nullable();
            $table->string('unbanned_by')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ip_bans');
    }
};
MIGRATION

# ============================================
# 009 - User Sessions (device tracking)
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000009_create_user_sessions_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('session_fingerprint');
            $table->string('browser')->nullable();
            $table->string('os')->nullable();
            $table->string('device_label')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->boolean('suspicious')->default(false);
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_reason')->nullable();
            $table->timestamp('last_seen_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_sessions');
    }
};
MIGRATION

# ============================================
# 010 - User Email MFA
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000010_create_user_email_mfa_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_email_mfa', function (Blueprint $table) {
            $table->uuid('user_id')->primary();
            $table->boolean('enabled')->default(false);
            $table->timestamp('enabled_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_email_mfa');
    }
};
MIGRATION

# ============================================
# 011 - Email OTP Codes
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000011_create_email_otp_codes_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_otp_codes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('purpose')->default('mfa');
            $table->string('code_hash');
            $table->integer('attempts')->default(0);
            $table->timestamp('consumed_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'purpose', 'created_at'], 'email_otp_codes_user_idx');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_otp_codes');
    }
};
MIGRATION

# ============================================
# 012 - Activity Log
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000012_create_activity_log_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_log', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('event_type');
            $table->text('detail')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_log');
    }
};
MIGRATION

# ============================================
# 013 - News
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000013_create_news_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('news', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('excerpt')->nullable();
            $table->longText('body')->default('');
            $table->string('category')->default('Industry News');
            $table->string('cover_image_url')->nullable();
            $table->string('author')->default('FAGE Admin');
            $table->boolean('published')->default(true);
            $table->timestamp('published_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('news');
    }
};
MIGRATION

# ============================================
# 014 - Products
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000014_create_products_table.php" << 'MIGRATION'
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
MIGRATION

# ============================================
# 015 - Activities
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000015_create_activities_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('category')->default('Event');
            $table->text('description')->default('');
            $table->string('image_url')->nullable();
            $table->string('location')->nullable();
            $table->timestamp('event_date')->nullable();
            $table->integer('spots_remaining')->nullable();
            $table->boolean('is_featured')->default(false);
            $table->boolean('published')->default(true);
            $table->integer('view_count')->default(0);
            $table->string('register_button_text')->nullable();
            $table->string('register_button_link')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activities');
    }
};
MIGRATION

# ============================================
# 016 - Event RSVPs
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000016_create_event_rsvps_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_rsvps', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('activity_id');
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->foreign('activity_id')->references('id')->on('activities');
            $table->unique(['user_id', 'activity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_rsvps');
    }
};
MIGRATION

# ============================================
# 017 - Media
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000017_create_media_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('media_type')->default('photo'); // photo, video
            $table->string('url');
            $table->string('thumbnail_url')->nullable();
            $table->string('category')->default('General');
            $table->boolean('published')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media');
    }
};
MIGRATION

# ============================================
# 018 - Site Hero Slides
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000018_create_site_hero_slides_table.php" << 'MIGRATION'
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
MIGRATION

# ============================================
# 019 - Site Partner Logos
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000019_create_site_partner_logos_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_partner_logos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('logo_url');
            $table->string('link_url')->nullable();
            $table->integer('display_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_partner_logos');
    }
};
MIGRATION

# ============================================
# 020 - Membership Applications
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000020_create_membership_applications_table.php" << 'MIGRATION'
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
MIGRATION

# ============================================
# 021 - Subscription Plans
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000021_create_subscription_plans_table.php" << 'MIGRATION'
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
MIGRATION

# ============================================
# 022 - Pending Applications
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000022_create_pending_applications_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('claim_token')->unique();
            $table->string('full_name');
            $table->string('company_name')->nullable();
            $table->string('email');
            $table->string('phone');
            $table->string('tier');
            $table->uuid('plan_id')->nullable();
            $table->string('status')->default('pending'); // pending, claimed, expired
            $table->uuid('user_id')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('plan_id')->references('id')->on('subscription_plans');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_applications');
    }
};
MIGRATION

# ============================================
# 023 - Member Profiles
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000023_create_member_profiles_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('member_id')->nullable()->unique();
            $table->string('company_name')->default('');
            $table->string('contact_name')->default('');
            $table->string('email')->default('');
            $table->string('phone')->default('');
            $table->string('country')->default('');
            $table->string('industry')->nullable();
            $table->string('products_exported')->nullable();
            $table->string('tier')->default('associate');
            $table->string('status')->default('new');
            $table->text('notes')->nullable();
            $table->string('directory_bio')->nullable();
            $table->string('directory_logo_url')->nullable();
            $table->string('directory_website')->nullable();
            $table->boolean('directory_visible')->default(false);
            $table->timestamp('subscription_start')->nullable();
            $table->timestamp('subscription_expiry')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_profiles');
    }
};
MIGRATION

# ============================================
# 024 - Member ID Counters
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000024_create_member_id_counters_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_id_counters', function (Blueprint $table) {
            $table->string('year_abbrev')->primary();
            $table->integer('next_seq')->default(1);
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_id_counters');
    }
};
MIGRATION

# ============================================
# 025 - Member Documents
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000025_create_member_documents_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('name');
            $table->string('doc_type');
            $table->string('file_path');
            $table->bigInteger('file_size')->nullable();
            $table->timestamp('uploaded_at')->nullable()->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_documents');
    }
};
MIGRATION

# ============================================
# 026 - Member Email Preferences
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000026_create_member_email_preferences_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_email_preferences', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->unique();
            $table->boolean('newsletters')->default(true);
            $table->boolean('event_alerts')->default(true);
            $table->boolean('trade_notices')->default(true);
            $table->boolean('payment_reminders')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_email_preferences');
    }
};
MIGRATION

# ============================================
# 027 - Application Forms
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000027_create_application_forms_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('application_forms', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tier');
            $table->json('schema')->default('[]');
            $table->boolean('published')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_forms');
    }
};
MIGRATION

# ============================================
# 028 - Application Submissions
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000028_create_application_submissions_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('application_submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('tier');
            $table->json('answers')->default('[]');
            $table->string('status')->default('new');
            $table->uuid('payment_id')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_submissions');
    }
};
MIGRATION

# ============================================
# 029 - Payment Gateways
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000029_create_payment_gateways_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_gateways', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('provider'); // paystack, flutterwave, hubtel, bank_deposit
            $table->json('config')->default('{}');
            $table->json('bank_details')->nullable();
            $table->boolean('enabled')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_gateways');
    }
};
MIGRATION

# ============================================
# 030 - Payment Submissions
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000030_create_payment_submissions_table.php" << 'MIGRATION'
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
            $table->string('status')->default('pending'); // pending, confirmed, rejected
            $table->string('reference')->nullable();
            $table->string('kind')->default('new'); // new, renew
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
            $table->index('reference', 'payment_submissions_reference_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_submissions');
    }
};
MIGRATION

# ============================================
# 031 - Directory Entries
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000031_create_directory_entries_table.php" << 'MIGRATION'
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
MIGRATION

# ============================================
# 032 - Directory Custom Field Definitions
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000032_create_directory_custom_field_defs_table.php" << 'MIGRATION'
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
MIGRATION

# ============================================
# 033 - Certificate Templates
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000033_create_certificate_templates_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificate_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('tier');
            $table->string('image_url');
            $table->json('field_positions')->default('{}');
            $table->json('signers')->default('[]');
            $table->string('authorized_name')->nullable();
            $table->string('signature_url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificate_templates');
    }
};
MIGRATION

# ============================================
# 034 - Certificates
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000034_create_certificates_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('member_id');
            $table->uuid('template_id')->nullable();
            $table->string('full_name');
            $table->string('tier');
            $table->string('verification_code');
            $table->boolean('revoked')->default(false);
            $table->timestamp('issued_at')->useCurrent();
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('template_id')->references('id')->on('certificate_templates');
            $table->index('verification_code', 'certificates_verification_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificates');
    }
};
MIGRATION

# ============================================
# 035 - Readiness Checklist Items
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000035_create_readiness_checklist_items_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('readiness_checklist_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('label');
            $table->text('description')->nullable();
            $table->string('category');
            $table->integer('weight')->default(1);
            $table->integer('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('readiness_checklist_items');
    }
};
MIGRATION

# ============================================
# 036 - Member Readiness Responses
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000036_create_member_readiness_responses_table.php" << 'MIGRATION'
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
            $table->string('status')->default('not_started'); // not_started, in_progress, complete
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
MIGRATION

# ============================================
# 037 - Support Tickets
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000037_create_support_tickets_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('subject');
            $table->string('status')->default('open'); // open, pending, resolved, closed
            $table->string('priority')->default('normal');
            $table->string('source')->default('dashboard'); // dashboard, chat_widget, email
            $table->string('contact_name')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_phone')->nullable();
            $table->text('message')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_tickets');
    }
};
MIGRATION

# ============================================
# 038 - Ticket Messages
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000038_create_ticket_messages_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('ticket_id');
            $table->uuid('sender_id');
            $table->boolean('is_admin')->default(false);
            $table->text('body');
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('ticket_id')->references('id')->on('support_tickets');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_messages');
    }
};
MIGRATION

# ============================================
# 039 - Contact Messages
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000039_create_contact_messages_table.php" << 'MIGRATION'
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
MIGRATION

# ============================================
# 040 - Trade Opportunities
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000040_create_trade_opportunities_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trade_opportunities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('source')->nullable();
            $table->string('source_url')->nullable()->unique();
            $table->string('category')->nullable();
            $table->string('country')->nullable();
            $table->date('deadline')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('posted_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trade_opportunities');
    }
};
MIGRATION

# ============================================
# 041 - Trade Opportunity Interests
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000041_create_trade_opportunity_interests_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trade_opportunity_interests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('opportunity_id');
            $table->uuid('user_id');
            $table->text('message')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('opportunity_id')->references('id')->on('trade_opportunities');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trade_opportunity_interests');
    }
};
MIGRATION

# ============================================
# 042 - Email Settings
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000042_create_email_settings_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->boolean('singleton')->default(true)->unique();
            $table->string('primary_provider')->default('smtp');
            $table->boolean('smtp_enabled')->default(false);
            $table->string('smtp_host')->nullable();
            $table->integer('smtp_port')->nullable()->default(587);
            $table->boolean('smtp_secure')->default(true);
            $table->string('smtp_user')->nullable();
            $table->string('smtp_password')->nullable();
            $table->string('smtp_from')->nullable();
            $table->boolean('resend_enabled')->default(false);
            $table->string('resend_api_key')->nullable();
            $table->string('resend_from')->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_settings');
    }
};
MIGRATION

# ============================================
# 043 - Email Templates
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000043_create_email_templates_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('key')->unique();
            $table->string('name');
            $table->string('subject')->default('');
            $table->text('description')->nullable();
            $table->json('blocks')->default('[]');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_templates');
    }
};
MIGRATION

# ============================================
# 044 - Email Log
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000044_create_email_log_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_log', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('to_email');
            $table->string('subject')->default('');
            $table->string('template_key')->nullable();
            $table->string('provider');
            $table->string('status');
            $table->text('error')->nullable();
            $table->boolean('fallback_used')->default(false);
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_log');
    }
};
MIGRATION

# ============================================
# 045 - Chatbot Knowledge
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000045_create_chatbot_knowledge_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chatbot_knowledge', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('section');
            $table->text('content');
            $table->integer('display_order')->default(0);
            $table->boolean('enabled')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chatbot_knowledge');
    }
};
MIGRATION

# ============================================
# 046 - Chatbot Feedback
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000046_create_chatbot_feedback_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chatbot_feedback', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('session_id');
            $table->uuid('user_id')->nullable();
            $table->string('kind');
            $table->text('question')->nullable();
            $table->text('bot_reply')->nullable();
            $table->boolean('helpful')->nullable();
            $table->integer('rating')->nullable();
            $table->text('comment')->nullable();
            $table->string('page_url')->nullable();
            $table->json('transcript')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chatbot_feedback');
    }
};
MIGRATION

# ============================================
# 047 - Notifications
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000047_create_notifications_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('title');
            $table->text('body')->default('');
            $table->string('link')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
MIGRATION

# ============================================
# 048 - Notification Reads
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000048_create_notification_reads_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_reads', function (Blueprint $table) {
            $table->uuid('user_id');
            $table->string('source_table');
            $table->uuid('source_id');
            $table->timestamp('read_at')->useCurrent();
            $table->primary(['user_id', 'source_table', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_reads');
    }
};
MIGRATION

# ============================================
# 049 - Admin Notification Settings
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000049_create_admin_notification_settings_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_notification_settings', function (Blueprint $table) {
            $table->integer('id')->primary();
            $table->json('chat_message_recipients')->default('[]');
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_notification_settings');
    }
};
MIGRATION

# ============================================
# 050 - Membership Resources
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000050_create_membership_resources_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('membership_resources', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->longText('body')->nullable();
            $table->string('category')->nullable();
            $table->string('cover_image_url')->nullable();
            $table->string('file_url')->nullable();
            $table->string('external_url')->nullable();
            $table->string('min_tier')->nullable();
            $table->boolean('published')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('membership_resources');
    }
};
MIGRATION

# ============================================
# 051 - Backup Destinations
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000051_create_backup_destinations_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_destinations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('provider'); // local, google_drive, s3
            $table->json('config')->default('{}');
            $table->boolean('enabled')->default(true);
            $table->boolean('is_default')->default(false);
            $table->uuid('created_by')->nullable();
            $table->boolean('last_test_ok')->nullable();
            $table->text('last_test_message')->nullable();
            $table->timestamp('last_test_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_destinations');
    }
};
MIGRATION

# ============================================
# 052 - Backup Runs
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000052_create_backup_runs_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('trigger')->default('manual'); // manual, scheduled
            $table->string('status')->default('running'); // running, success, failed
            $table->string('storage_path')->nullable();
            $table->string('path')->nullable();
            $table->bigInteger('size_bytes')->nullable();
            $table->integer('tables_count')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('finished_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_runs');
    }
};
MIGRATION

# ============================================
# 053 - Backup Run Uploads
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000053_create_backup_run_uploads_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_run_uploads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('run_id');
            $table->uuid('destination_id')->nullable();
            $table->string('provider');
            $table->boolean('ok');
            $table->string('external_id')->nullable();
            $table->string('url')->nullable();
            $table->text('message')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('run_id')->references('id')->on('backup_runs');
            $table->foreign('destination_id')->references('id')->on('backup_destinations');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_run_uploads');
    }
};
MIGRATION

# ============================================
# 054 - Backup Schedules
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000054_create_backup_schedules_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_schedules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('frequency')->default('daily'); // daily, weekly, monthly
            $table->string('cron_expression')->nullable();
            $table->integer('hour_of_day')->default(2);
            $table->integer('minute_of_hour')->default(0);
            $table->integer('day_of_week')->default(0);
            $table->integer('day_of_month')->default(1);
            $table->integer('retention_days')->default(30);
            $table->boolean('enabled')->default(true);
            $table->timestamp('last_run_at')->nullable();
            $table->string('last_status')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamp('next_run_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_schedules');
    }
};
MIGRATION

# ============================================
# 055 - Security Settings
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000055_create_security_settings_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->boolean('singleton')->default(true)->unique();
            $table->integer('member_idle_minutes')->default(10);
            $table->integer('console_idle_minutes')->default(10);
            $table->integer('countdown_seconds')->default(10);
            $table->boolean('beep_enabled')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });

        // Insert default row
        \DB::table('security_settings')->insert([
            'singleton' => true,
            'member_idle_minutes' => 10,
            'console_idle_minutes' => 10,
            'countdown_seconds' => 10,
            'beep_enabled' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('security_settings');
    }
};
MIGRATION

# ============================================
# 056 - Blog Reactions
# ============================================
cat > "$MIGRATIONS_DIR/2026_01_01_000056_create_blog_reactions_table.php" << 'MIGRATION'
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blog_reactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('news_id');
            $table->string('session_id');
            $table->string('emoji');
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['news_id', 'session_id', 'emoji']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blog_reactions');
    }
};
MIGRATION

echo "✅ All 56 migration files created successfully!"
echo "Tables: users, cache, jobs, user_roles, role_permissions, role_help, login_attempts, ip_bans, user_sessions, user_email_mfa, email_otp_codes, activity_log, news, products, activities, event_rsvps, media, site_hero_slides, site_partner_logos, membership_applications, subscription_plans, pending_applications, member_profiles, member_id_counters, member_documents, member_email_preferences, application_forms, application_submissions, payment_gateways, payment_submissions, directory_entries, directory_custom_field_defs, certificate_templates, certificates, readiness_checklist_items, member_readiness_responses, support_tickets, ticket_messages, contact_messages, trade_opportunities, trade_opportunity_interests, email_settings, email_templates, email_log, chatbot_knowledge, chatbot_feedback, notifications, notification_reads, admin_notification_settings, membership_resources, backup_destinations, backup_runs, backup_run_uploads, backup_schedules, security_settings, blog_reactions"
