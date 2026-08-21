<?php
/**
 * Generate Eloquent models for all 42+ FAGE tables
 */

$base = __DIR__ . '/app/Models';

function createModel(string $dir, string $name, string $table, array $fillable = [], string $parent = null, bool $timestamps = true): void
{
    $path = $dir . '/' . $name . '.php';
    $fillableStr = "'" . implode("', '", $fillable) . "'";
    $parentClass = $parent ? " extends {$parent}" : " extends Model";
    $timestampStr = $timestamps ? '' : "\n    public \$timestamps = false;";

    $content = "<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;

class {$name}{$parentClass}
{
    protected \$table = '{$table}';
    protected \$keyType = 'string';
    public \$incrementing = false;
    protected \$fillable = [{$fillableStr}];
{$timestampStr}

    protected static function boot()
    {
        parent::boot();
        static::creating(function (\$model) {
            if (empty(\$model->id)) {
                \$model->id = \\Illuminate\\Support\\Str::uuid()->toString();
            }
        });
    }
}
";
    file_put_contents($path, $content);
    echo "Model: {$name} ({$table})\n";
}

// ─── Auth & Users ──────────────────────────────────────────
createModel($base, 'User', 'users', [
    'name', 'email', 'password', 'email_verified_at', 'avatar_url', 'phone'
]);

createModel($base, 'UserRole', 'user_roles', [
    'user_id', 'role', 'description'
]);

// ─── Members ───────────────────────────────────────────────
createModel($base, 'Member', 'members', [
    'user_id', 'membership_number', 'first_name', 'last_name', 'email',
    'phone', 'company_name', 'position', 'industry', 'membership_tier',
    'membership_status', 'joining_date', 'profile_photo_url'
]);

createModel($base, 'MembershipApplication', 'membership_applications', [
    'user_id', 'first_name', 'last_name', 'email', 'phone',
    'company_name', 'position', 'industry', 'membership_tier',
    'status', 'submitted_at', 'reviewed_at', 'reviewed_by', 'notes'
]);

// ─── Directory ─────────────────────────────────────────────
createModel($base, 'DirectoryListing', 'directory_listings', [
    'user_id', 'member_id', 'company_name', 'slug', 'description',
    'industry', 'website', 'email', 'phone', 'address', 'city',
    'logo_url', 'images', 'services', 'status', 'featured',
    'approved_at', 'approved_by'
]);

// ─── Payments ──────────────────────────────────────────────
createModel($base, 'Payment', 'payments', [
    'user_id', 'member_id', 'amount', 'currency', 'provider',
    'reference', 'status', 'description', 'metadata',
    'paid_at', 'verified_at', 'subscription_tier', 'payment_type'
]);

createModel($base, 'PaymentConfig', 'payment_configs', [
    'provider', 'public_key', 'secret_key', 'merchant_id',
    'webhook_secret', 'is_active', 'test_mode'
]);

// ─── Content ───────────────────────────────────────────────
createModel($base, 'NewsArticle', 'news_articles', [
    'title', 'slug', 'content', 'excerpt', 'cover_image',
    'author', 'status', 'published_at', 'tags'
]);

createModel($base, 'Product', 'products', [
    'title', 'slug', 'description', 'price', 'image',
    'category', 'status', 'featured', 'tags'
]);

createModel($base, 'Activity', 'activities', [
    'title', 'slug', 'description', 'image', 'location',
    'date', 'time', 'status', 'category'
]);

createModel($base, 'Event', 'events', [
    'title', 'slug', 'description', 'image', 'location',
    'start_date', 'end_date', 'time', 'status', 'capacity',
    'registration_url', 'tags'
]);

createModel($base, 'Media', 'media', [
    'title', 'type', 'url', 'thumbnail_url', 'description',
    'category', 'uploaded_by'
]);

createModel($base, 'HomePage', 'home_pages', [
    'hero_title', 'hero_subtitle', 'hero_image', 'hero_cta_text',
    'hero_cta_url', 'about_title', 'about_content', 'about_image',
    'sections', 'seo_title', 'seo_description'
]);

createModel($base, 'Countdown', 'countdowns', [
    'title', 'target_date', 'description', 'is_active'
]);

// ─── Trade Opportunities ───────────────────────────────────
createModel($base, 'TradeOpportunity', 'trade_opportunities', [
    'title', 'slug', 'description', 'country', 'sector',
    'requirements', 'deadline', 'source_url', 'source_name',
    'is_public', 'status', 'published_at', 'tags'
]);

createModel($base, 'TradeMatch', 'trade_matches', [
    'trade_opportunity_id', 'member_id', 'matched_at',
    'notified', 'status', 'notes'
]);

// ─── Certificates ──────────────────────────────────────────
createModel($base, 'Certificate', 'certificates', [
    'user_id', 'member_id', 'certificate_number', 'title',
    'description', 'issued_at', 'expires_at', 'status',
    'issued_by', 'download_url', 'verification_code'
]);

// ─── Support ───────────────────────────────────────────────
createModel($base, 'SupportTicket', 'support_tickets', [
    'user_id', 'subject', 'description', 'status', 'priority',
    'category', 'assigned_to', 'resolved_at', 'created_at'
]);

createModel($base, 'SupportTicketMessage', 'support_ticket_messages', [
    'ticket_id', 'user_id', 'message', 'is_admin', 'attachments'
]);

// ─── Chatbot ───────────────────────────────────────────────
createModel($base, 'ChatbotConfig', 'chatbot_configs', [
    'singleton', 'welcome_message', 'system_prompt', 'model',
    'temperature', 'max_tokens', 'is_active'
]);

createModel($base, 'ChatbotConversation', 'chatbot_conversations', [
    'session_id', 'user_id', 'messages', 'context'
]);

// ─── Email ─────────────────────────────────────────────────
createModel($base, 'EmailSetting', 'email_settings', [
    'singleton', 'primary_provider', 'smtp_enabled', 'smtp_host',
    'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from',
    'resend_enabled', 'resend_api_key', 'resend_from'
]);

createModel($base, 'EmailTemplate', 'email_templates', [
    'key', 'name', 'subject', 'blocks', 'is_active'
]);

createModel($base, 'EmailLog', 'email_logs', [
    'to', 'from', 'subject', 'status', 'provider',
    'template_key', 'error', 'metadata', 'sent_at'
]);

createModel($base, 'EmailPreference', 'email_preferences', [
    'user_id', 'newsletters', 'event_alerts',
    'trade_notices', 'payment_reminders'
]);

// ─── Settings ──────────────────────────────────────────────
createModel($base, 'SecuritySetting', 'security_settings', [
    'singleton', 'mfa_enabled', 'mfa_provider',
    'mfa_code_length', 'mfa_code_expiry', 'mfa_lockout_attempts'
]);

createModel($base, 'AppSetting', 'app_settings', [
    'singleton', 'site_name', 'site_url', 'currency',
    'timezone', 'logo_url', 'primary_color'
]);

// ─── Roles ─────────────────────────────────────────────────
createModel($base, 'RoleHelp', 'role_help', [
    'role', 'summary'
]);

// ─── Subscribers ───────────────────────────────────────────
createModel($base, 'Subscriber', 'subscribers', [
    'email', 'is_active', 'subscribed_at', 'unsubscribed_at'
]);

// ─── Backups ───────────────────────────────────────────────
createModel($base, 'Backup', 'backups', [
    'filename', 'path', 'size', 'type', 'status',
    'provider', 'metadata', 'created_by'
]);

createModel($base, 'ScheduledBackup', 'scheduled_backups', [
    'singleton', 'enabled', 'frequency', 'time',
    'provider', 'retention_days', 'last_run_at', 'next_run_at'
]);

createModel($base, 'ScheduledBackupLog', 'scheduled_backup_logs', [
    'scheduled_backup_id', 'status', 'filename', 'size',
    'error', 'started_at', 'completed_at'
]);

// ─── Password Resets ───────────────────────────────────────
createModel($base, 'PasswordReset', 'password_reset_tokens', [
    'email', 'token', 'created_at'
], null, false);

// ─── Sessions ──────────────────────────────────────────────
createModel($base, 'Session', 'sessions', [
    'user_id', 'ip_address', 'user_agent', 'payload', 'last_activity'
], null, false);

echo "\n=== All models generated! ===\n";
