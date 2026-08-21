<?php

use App\Http\Controllers\Api\Auth\LoginController;
use App\Http\Controllers\Api\Auth\RegisterController;
use App\Http\Controllers\Api\Auth\PasswordResetController;
use App\Http\Controllers\Api\Auth\MfaController;
use App\Http\Controllers\Api\Admin\AdminController;
use App\Http\Controllers\Api\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\Admin\MemberManagementController;
use App\Http\Controllers\Api\Admin\DirectoryApprovalController;
use App\Http\Controllers\Api\Admin\PaymentController as AdminPaymentController;
use App\Http\Controllers\Api\Admin\ContentController;
use App\Http\Controllers\Api\Admin\BackupController;
use App\Http\Controllers\Api\Admin\RoleHelpController;
use App\Http\Controllers\Api\Admin\EmailSettingsController;
use App\Http\Controllers\Api\Admin\EmailTemplatesController;
use App\Http\Controllers\Api\Admin\EmailLogsController;
use App\Http\Controllers\Api\Admin\SettingsController;
use App\Http\Controllers\Api\Admin\SecuritySettingsController;
use App\Http\Controllers\Api\Admin\SubscriberController;
use App\Http\Controllers\Api\Admin\ChatbotConfigController;
use App\Http\Controllers\Api\Admin\TradeOpportunityController as AdminTradeController;
use App\Http\Controllers\Api\Admin\TradeMatchController;
use App\Http\Controllers\Api\Admin\CertificateController;
use App\Http\Controllers\Api\Admin\SupportTicketController as AdminSupportTicketController;
use App\Http\Controllers\Api\Admin\ScheduledBackupController;
use App\Http\Controllers\Api\Admin\ImportController;
use App\Http\Controllers\Api\Member\DashboardController as MemberDashboardController;
use App\Http\Controllers\Api\Member\DirectoryController;
use App\Http\Controllers\Api\Member\ProfileController;
use App\Http\Controllers\Api\Member\PaymentController as MemberPaymentController;
use App\Http\Controllers\Api\Member\EmailPreferencesController;
use App\Http\Controllers\Api\Member\ResourceController;
use App\Http\Controllers\Api\Member\ApplicationController;
use App\Http\Controllers\Api\Member\CertificateController as MemberCertificateController;
use App\Http\Controllers\Api\Member\TradeController;
use App\Http\Controllers\Api\Member\SupportTicketController;
use App\Http\Controllers\Api\Public\NewsController;
use App\Http\Controllers\Api\Public\ProductController;
use App\Http\Controllers\Api\Public\ActivityController;
use App\Http\Controllers\Api\Public\MediaController;
use App\Http\Controllers\Api\Public\EventController;
use App\Http\Controllers\Api\Public\DirectoryController as PublicDirectoryController;
use App\Http\Controllers\Api\Public\TradeOpportunitiesController;
use App\Http\Controllers\Api\Public\ChatbotController;
use App\Http\Controllers\Api\Public\CountdownController;
use App\Http\Controllers\Api\Public\HomePageController;
use App\Http\Controllers\Api\Public\StatsController;
use App\Http\Controllers\Api\Public\SubscriberController as PublicSubscriberController;
use App\Http\Controllers\Api\Webhook\PaystackWebhookController;
use App\Http\Controllers\Api\Webhook\FlutterwaveWebhookController;
use App\Http\Controllers\Api\Webhook\HubtelWebhookController;
use App\Http\Controllers\Api\GenericTableController;
use App\Http\Controllers\Api\RpcController;
use App\Http\Controllers\Api\StorageController;
use App\Http\Controllers\Api\Member\SessionController;
use App\Http\Controllers\Api\Member\NotificationController as MemberNotificationController;
use App\Http\Controllers\Api\Public\LoginGateController;
use App\Http\Controllers\Api\Admin\LoginSecurityController;
use App\Http\Controllers\Api\Admin\ActivityLogController as AdminActivityLogController;
use App\Http\Controllers\Api\Admin\PaymentGatewayController;
use App\Http\Controllers\Api\Admin\DirectoryCustomFieldController;
use App\Http\Controllers\Api\Member\DocumentController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — FAGE Ghana
|--------------------------------------------------------------------------
| Replaces: Supabase Edge Functions, RPC calls, RLS-protected queries
|--------------------------------------------------------------------------
*/

Route::get('/health', fn () => response()->json(['status' => 'ok', 'version' => '1.0.0']));

// Named 'login' route required by Sanctum's auth:sanctum redirect
Route::name('login')->get('/login', fn () => response()->json(['message' => 'Unauthenticated'], 401));

// ─── Setup / Installation Wizard ────────────────────────────────
Route::prefix('setup')->group(function () {
    Route::get('/status', [\App\Http\Controllers\Api\SetupController::class, 'status']);
    Route::get('/requirements', [\App\Http\Controllers\Api\SetupController::class, 'checkRequirements']);
    Route::post('/test-database', [\App\Http\Controllers\Api\SetupController::class, 'testDatabase']);
    Route::post('/test-email', [\App\Http\Controllers\Api\SetupController::class, 'testEmail']);
    Route::post('/install', [\App\Http\Controllers\Api\SetupController::class, 'install']);
    Route::post('/import-backup', [\App\Http\Controllers\Api\SetupController::class, 'importSupabaseBackup']);
});

// ─── All routes below require installation ──────────────────────
Route::middleware(['installed'])->group(function () {

    // ─── PUBLIC: No auth required ───────────────────────────────
    Route::prefix('public')->group(function () {
        Route::post('/auth/login', [LoginController::class, 'login']);
        Route::post('/auth/register', [RegisterController::class, 'register']);
        Route::post('/auth/forgot-password', [PasswordResetController::class, 'forgotPassword']);
        Route::post('/auth/reset-password', [PasswordResetController::class, 'resetPassword']);
        Route::post('/auth/verify-email/{id}/{hash}', [RegisterController::class, 'verifyEmail']);

        Route::get('/news', [NewsController::class, 'index']);
        Route::get('/news/{slug}', [NewsController::class, 'show']);
        Route::get('/products', [ProductController::class, 'index']);
        Route::get('/products/{slug}', [ProductController::class, 'show']);
        Route::get('/activities', [ActivityController::class, 'index']);
        Route::get('/activities/{slug}', [ActivityController::class, 'show']);
        Route::get('/events', [EventController::class, 'index']);
        Route::get('/events/{slug}', [EventController::class, 'show']);
        Route::get('/media', [MediaController::class, 'index']);

        Route::get('/directory', [PublicDirectoryController::class, 'index']);
        Route::get('/directory/{slug}', [PublicDirectoryController::class, 'show']);

        Route::get('/trade-opportunities', [TradeOpportunitiesController::class, 'index']);

        Route::get('/home-page', [HomePageController::class, 'index']);
        Route::get('/countdown', [CountdownController::class, 'index']);
        Route::get('/stats', [StatsController::class, 'index']);

        Route::post('/chatbot', [ChatbotController::class, 'chat']);
        Route::post('/chatbot/feedback', [ChatbotController::class, 'feedback']);

        Route::post('/subscribers', [PublicSubscriberController::class, 'subscribe']);
        Route::delete('/subscribers', [PublicSubscriberController::class, 'unsubscribe']);

        // ─── Login Security Gate (anonymous, pre-auth) ──────────────
        Route::get('/login-security/gate', [LoginGateController::class, 'gate']);
        Route::post('/login-security/check-email', [LoginGateController::class, 'checkEmail']);
        Route::post('/login-security/record-outcome', [LoginGateController::class, 'recordOutcome']);
        Route::post('/login-security/request-reset', [LoginGateController::class, 'requestReset']);
    });

    // ─── AUTHENTICATED ROUTES ───────────────────────────────────
    Route::middleware('auth:sanctum')->group(function () {

        Route::post('/auth/logout', [LoginController::class, 'logout']);
        Route::post('/auth/mfa/send-code', [MfaController::class, 'sendCode']);
        Route::post('/auth/mfa/verify', [MfaController::class, 'verify']);
        Route::get('/auth/me', [LoginController::class, 'me']);
        Route::put('/auth/profile', [ProfileController::class, 'updateProfile']);
        Route::put('/auth/password', [ProfileController::class, 'updatePassword']);
        Route::delete('/auth/account', [ProfileController::class, 'deleteAccount']);

        // ─── MFA (email 2FA) ────────────────────────────────────
        Route::get('/auth/mfa/status', [MfaController::class, 'status']);
        Route::post('/auth/mfa/enable', [MfaController::class, 'enable']);
        Route::post('/auth/mfa/disable', [MfaController::class, 'disable']);

        // ─── Member Dashboard ───────────────────────────────────
        Route::prefix('member')->group(function () {
            Route::get('/dashboard', [MemberDashboardController::class, 'index']);
            Route::get('/profile', [ProfileController::class, 'show']);
            Route::put('/profile', [ProfileController::class, 'update']);
            Route::post('/profile/avatar', [ProfileController::class, 'uploadAvatar']);

            Route::get('/directory', [DirectoryController::class, 'myListing']);
            Route::post('/directory', [DirectoryController::class, 'createListing']);
            Route::put('/directory', [DirectoryController::class, 'updateListing']);

            Route::get('/payments', [MemberPaymentController::class, 'index']);
            Route::post('/payments/initialize', [MemberPaymentController::class, 'initialize']);
            Route::get('/payments/{id}', [MemberPaymentController::class, 'show']);
            Route::post('/payments/verify', [MemberPaymentController::class, 'verify']);
            Route::post('/payments/manual', [MemberPaymentController::class, 'storeManual']);
            Route::get('/payments/{id}/receipt', [MemberPaymentController::class, 'receipt']);
            Route::get('/payments/{id}/invoice-pdf', [MemberPaymentController::class, 'invoicePdf']);
            Route::get('/payments/{id}/invoice', [MemberPaymentController::class, 'invoice']);

            Route::get('/applications', [ApplicationController::class, 'index']);
            Route::post('/applications', [ApplicationController::class, 'store']);
            Route::get('/applications/{id}', [ApplicationController::class, 'show']);

            Route::get('/certificates', [MemberCertificateController::class, 'index']);
            Route::get('/certificates/{id}/download', [MemberCertificateController::class, 'download']);

            Route::get('/resources', [ResourceController::class, 'index']);

            Route::get('/trade-opportunities', [TradeController::class, 'index']);
            Route::get('/trade-opportunities/{id}', [TradeController::class, 'show']);
            Route::post('/trade-opportunities/{id}/interest', [TradeController::class, 'interest']);

            Route::get('/support-tickets', [SupportTicketController::class, 'index']);
            Route::post('/support-tickets', [SupportTicketController::class, 'store']);
            Route::get('/support-tickets/{id}', [SupportTicketController::class, 'show']);
            Route::post('/support-tickets/{id}/messages', [SupportTicketController::class, 'addMessage']);

            // Documents
            Route::get('/documents', [DocumentController::class, 'index']);
            Route::post('/documents', [DocumentController::class, 'store']);
            Route::get('/documents/{id}/download', [DocumentController::class, 'download']);
            Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);

            Route::get('/email-preferences', [EmailPreferencesController::class, 'show']);
            Route::put('/email-preferences', [EmailPreferencesController::class, 'update']);

            // Chat escalation
            Route::post('/chatbot/escalate', [ChatbotController::class, 'escalate']);

            // Session management
            Route::get('/sessions', [SessionController::class, 'index']);
            Route::post('/sessions/register', [SessionController::class, 'register']);
            Route::post('/sessions/heartbeat', [SessionController::class, 'heartbeat']);
            Route::post('/sessions/revoke-others', [SessionController::class, 'revokeOthers']);
            Route::post('/sessions/{id}/revoke', [SessionController::class, 'revoke']);

            // Activity Log (member-scoped)
            Route::post('/activity-log', [AdminActivityLogController::class, 'mineStore']);
            Route::get('/activity-log', [AdminActivityLogController::class, 'mineIndex']);

            // Notifications
            Route::get('/notifications', [MemberNotificationController::class, 'index']);
            Route::get('/notifications/unread-count', [MemberNotificationController::class, 'unreadCount']);
            Route::put('/notifications/{id}/read', [MemberNotificationController::class, 'markRead']);
            Route::put('/notifications/read-all', [MemberNotificationController::class, 'markAllRead']);
            Route::delete('/notifications/{id}', [MemberNotificationController::class, 'destroy']);
        });

        // ─── Admin Routes ───────────────────────────────────────
        Route::middleware('role:admin,superadmin,developer')->prefix('admin')->group(function () {

            Route::get('/dashboard', [AdminDashboardController::class, 'index']);
            Route::get('/stats', [AdminDashboardController::class, 'stats']);

            Route::apiResource('users', AdminController::class);
            Route::put('/users/{id}/role', [AdminController::class, 'updateRole']);
            Route::put('/users/{id}/status', [AdminController::class, 'updateStatus']);

            Route::get('/members', [MemberManagementController::class, 'index']);
            Route::get('/members/{id}', [MemberManagementController::class, 'show']);
            Route::put('/members/{id}', [MemberManagementController::class, 'update']);
            Route::delete('/members/{id}', [MemberManagementController::class, 'destroy']);

            Route::get('/directory/pending', [DirectoryApprovalController::class, 'pending']);
            Route::put('/directory/{id}/approve', [DirectoryApprovalController::class, 'approve']);
            Route::put('/directory/{id}/reject', [DirectoryApprovalController::class, 'reject']);

            Route::get('/payments', [AdminPaymentController::class, 'index']);
            Route::get('/payments/{id}', [AdminPaymentController::class, 'show']);
            Route::put('/payments/{id}/status', [AdminPaymentController::class, 'updateStatus']);
            Route::get('/payments/stats', [AdminPaymentController::class, 'stats']);

            // Content management
            Route::get('/news', [ContentController::class, 'indexNews']);
            Route::post('/news', [ContentController::class, 'storeNews']);
            Route::put('/news/{id}', [ContentController::class, 'updateNews']);
            Route::delete('/news/{id}', [ContentController::class, 'destroyNews']);

            Route::get('/products', [ContentController::class, 'indexProducts']);
            Route::post('/products', [ContentController::class, 'storeProduct']);
            Route::put('/products/{id}', [ContentController::class, 'updateProduct']);
            Route::delete('/products/{id}', [ContentController::class, 'destroyProduct']);

            Route::get('/activities', [ContentController::class, 'indexActivities']);
            Route::post('/activities', [ContentController::class, 'storeActivity']);
            Route::put('/activities/{id}', [ContentController::class, 'updateActivity']);
            Route::delete('/activities/{id}', [ContentController::class, 'destroyActivity']);

            Route::get('/events', [ContentController::class, 'indexEvents']);
            Route::post('/events', [ContentController::class, 'storeEvent']);
            Route::put('/events/{id}', [ContentController::class, 'updateEvent']);
            Route::delete('/events/{id}', [ContentController::class, 'destroyEvent']);

            Route::get('/media', [ContentController::class, 'indexMedia']);
            Route::post('/media', [ContentController::class, 'storeMedia']);
            Route::delete('/media/{id}', [ContentController::class, 'destroyMedia']);

            Route::get('/home-page', [ContentController::class, 'getHomePage']);
            Route::put('/home-page', [ContentController::class, 'updateHomePage']);

            Route::get('/countdown', [ContentController::class, 'getCountdown']);
            Route::put('/countdown', [ContentController::class, 'updateCountdown']);

            Route::apiResource('trade-opportunities', AdminTradeController::class);
            Route::post('/trade-opportunities/{id}/match', [TradeMatchController::class, 'match']);

            Route::get('/certificates', [CertificateController::class, 'index']);
            Route::post('/certificates', [CertificateController::class, 'store']);
            Route::put('/certificates/{id}', [CertificateController::class, 'update']);
            Route::delete('/certificates/{id}', [CertificateController::class, 'destroy']);
            Route::get('/certificates/{id}/verify', [CertificateController::class, 'verify']);

            Route::get('/support-tickets', [AdminSupportTicketController::class, 'index']);
            Route::get('/support-tickets/{id}', [AdminSupportTicketController::class, 'show']);
            Route::put('/support-tickets/{id}', [AdminSupportTicketController::class, 'update']);
            Route::post('/support-tickets/{id}/messages', [AdminSupportTicketController::class, 'addMessage']);
            Route::put('/support-tickets/{id}/assign', [AdminSupportTicketController::class, 'assign']);
            Route::put('/support-tickets/{id}/status', [AdminSupportTicketController::class, 'updateStatus']);

            Route::get('/applications', [ApplicationController::class, 'adminIndex']);
            Route::get('/applications/{id}', [ApplicationController::class, 'adminShow']);
            Route::put('/applications/{id}/status', [ApplicationController::class, 'updateStatus']);

            Route::get('/subscribers', [SubscriberController::class, 'index']);
            Route::delete('/subscribers/{id}', [SubscriberController::class, 'destroy']);

            Route::get('/chatbot-config', [ChatbotConfigController::class, 'show']);
            Route::put('/chatbot-config', [ChatbotConfigController::class, 'update']);

            Route::get('/email-settings', [EmailSettingsController::class, 'show']);
            Route::put('/email-settings', [EmailSettingsController::class, 'update']);

            Route::get('/email-templates', [EmailTemplatesController::class, 'index']);
            Route::get('/email-templates/{id}', [EmailTemplatesController::class, 'show']);
            Route::put('/email-templates/{id}', [EmailTemplatesController::class, 'update']);
            Route::post('/email-templates/{id}/test', [EmailTemplatesController::class, 'test']);

            // Directory custom fields
            Route::get('/directory-custom-fields', [DirectoryCustomFieldController::class, 'index']);
            Route::post('/directory-custom-fields', [DirectoryCustomFieldController::class, 'store']);
            Route::put('/directory-custom-fields/{id}', [DirectoryCustomFieldController::class, 'update']);
            Route::delete('/directory-custom-fields/{id}', [DirectoryCustomFieldController::class, 'destroy']);

            // Trade RSS feed management
            Route::get('/trade-rss-feeds', function () {
                $settings = DB::table('app_settings')->where('setting_key', 'trade_rss_feeds')->first();
                return response()->json(['feeds' => $settings ? json_decode($settings->setting_value, true) : []]);
            });
            Route::post('/trade-rss-feeds', function (\Illuminate\Http\Request $r) {
                $v = $r->validate(['feeds' => 'required|array', 'feeds.*.url' => 'required|url', 'feeds.*.source' => 'nullable|string']);
                $existing = DB::table('app_settings')->where('setting_key', 'trade_rss_feeds')->first();
                $data = json_encode($v['feeds']);
                if ($existing) {
                    DB::table('app_settings')->where('setting_key', 'trade_rss_feeds')->update(['setting_value' => $data, 'updated_at' => now()]);
                } else {
                    DB::table('app_settings')->insert(['id' => Str::uuid()->toString(), 'setting_key' => 'trade_rss_feeds', 'setting_value' => $data, 'created_at' => now(), 'updated_at' => now()]);
                }
                return response()->json(['message' => 'Feeds updated']);
            });
            Route::post('/trade-rss-feeds/fetch', function () {
                \Illuminate\Support\Facades\Artisan::call('trade:fetch-rss');
                return response()->json(['message' => Artisan::output()]);
            });

            Route::get('/email-logs', [EmailLogsController::class, 'index']);
            Route::post('/email-logs/send', [EmailLogsController::class, 'send']);

            // ─── Login Security (admin management) ──────────────
            Route::get('/login-security/ip-bans', [LoginSecurityController::class, 'ipBans']);
            Route::get('/login-security/login-attempts', [LoginSecurityController::class, 'loginAttempts']);
            Route::post('/login-security/ban', [LoginSecurityController::class, 'ban']);
            Route::post('/login-security/unban', [LoginSecurityController::class, 'unban']);
            Route::post('/login-security/record-attempt', [LoginSecurityController::class, 'recordAttempt']);
            Route::get('/login-security/check-email', [LoginSecurityController::class, 'checkEmail']);
            Route::post('/login-security/request-reset', [LoginSecurityController::class, 'requestReset']);

            // ─── Activity Log (admin) ────────────────────────────
            Route::get('/activity-log', [AdminActivityLogController::class, 'index']);
            Route::post('/payments/{id}/confirm', [PaymentGatewayController::class, 'confirmManual']);
            Route::post('/activity-log', [AdminActivityLogController::class, 'store']);

            // ─── Payment Gateways ────────────────────────────────
            Route::get('/payment-gateways', [PaymentGatewayController::class, 'index']);
            Route::put('/payment-gateways/{provider}', [PaymentGatewayController::class, 'update']);
            Route::post('/payment-gateways/{provider}/test', [PaymentGatewayController::class, 'test']);

            // ─── Bulk Invite ─────────────────────────────────────
            Route::post('/members/bulk-invite', [MemberManagementController::class, 'bulkInvite']);

            Route::get('/roles', [RoleHelpController::class, 'index']);
            Route::put('/roles/{role}', [RoleHelpController::class, 'update']);

            Route::get('/security-settings', [SecuritySettingsController::class, 'show']);
            Route::put('/security-settings', [SecuritySettingsController::class, 'update']);

            Route::get('/settings', [SettingsController::class, 'show']);
            Route::put('/settings', [SettingsController::class, 'update']);

            Route::get('/backups', [BackupController::class, 'index']);
            Route::post('/backups/create', [BackupController::class, 'create']);
            Route::get('/backups/{id}/download', [BackupController::class, 'download']);
            Route::post('/backups/{id}/restore', [BackupController::class, 'restore']);
            Route::post('/backups/test-destination', [BackupController::class, 'testDestination']);
            Route::get('/backups/{id}/upload-results', [BackupController::class, 'uploadResults']);
            Route::delete('/backups/{id}', [BackupController::class, 'destroy']);
            Route::get('/backups/config', [ScheduledBackupController::class, 'showConfig']);
            Route::put('/backups/config', [ScheduledBackupController::class, 'updateConfig']);

            Route::post('/import-supabase-backup', [ImportController::class, 'import']);
        });
    });

    // ─── Payment Webhooks (no auth, signature verification) ─────
    Route::prefix('webhooks')->group(function () {
        Route::post('/paystack', [PaystackWebhookController::class, 'handle']);
        Route::post('/flutterwave', [FlutterwaveWebhookController::class, 'handle']);
        Route::post('/hubtel', [HubtelWebhookController::class, 'handle']);
        Route::post('/retry', function () {
            $pending = DB::table('webhook_logs')
                ->where('status', 'failed')
                ->where('next_retry_at', '<=', now())
                ->where('retry_count', '<', 3)
                ->limit(10)
                ->get();
            $retried = 0;
            foreach ($pending as $log) {
                DB::table('webhook_logs')->where('id', $log->id)->update([
                    'retry_count' => $log->retry_count + 1,
                    'next_retry_at' => now()->addMinutes(pow(2, $log->retry_count + 1) * 5),
                    'updated_at' => now(),
                ]);
                $retried++;
            }
            return response()->json(['retried' => $retried]);
        });
    });

    // ─── Public payment initialization (no auth) ────────────────
    Route::post('/payments/paystack/initialize', [MemberPaymentController::class, 'initializePublic']);
    Route::post('/payments/flutterwave/initialize', [MemberPaymentController::class, 'initializePublicFw']);
    Route::post('/payments/hubtel/initialize', [MemberPaymentController::class, 'initializePublicHt']);

    // ─── Generic CRUD (Supabase QueryBuilder compat — catch-all) ──
    // SELECT: GET /api/public/{table}
    Route::get('/public/{table}', [GenericTableController::class, 'index'])
        ->where('table', '[a-z_][a-z0-9_]*');

    // WRITE: /api/data/{table}
    Route::post('/data/{table}', [GenericTableController::class, 'store'])
        ->where('table', '[a-z_][a-z0-9_]*');
    Route::post('/data/{table}/upsert', [GenericTableController::class, 'upsert'])
        ->where('table', '[a-z_][a-z0-9_]*');
    Route::put('/data/{table}', [GenericTableController::class, 'update'])
        ->where('table', '[a-z_][a-z0-9_]*');
    Route::delete('/data/{table}', [GenericTableController::class, 'destroy'])
        ->where('table', '[a-z_][a-z0-9_]*');

    // RPC: POST /api/rpc/{function}
    Route::post('/rpc/{function}', [RpcController::class, 'invoke'])
        ->where('function', '[a-z_-]+');

    // Storage
    Route::post('/storage/upload', [StorageController::class, 'upload']);
    Route::delete('/storage/remove', [StorageController::class, 'remove']);
    Route::post('/storage/{bucket}/list', [StorageController::class, 'list'])
        ->where('bucket', '[a-z0-9_-]+');
    Route::get('/storage/{bucket}/{path}', [StorageController::class, 'serve'])
        ->where('bucket', '[a-z0-9_-]+')->where('path', '.*');
});
