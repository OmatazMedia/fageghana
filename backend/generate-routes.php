<?php
// This script generates the routes/api.php file

$content = '<?php

use App\\Http\\Controllers\\Api\\Auth\\LoginController;
use App\\Http\\Controllers\\Api\\Auth\\RegisterController;
use App\\Http\\Controllers\\Api\\Auth\\PasswordResetController;
use App\\Http\\Controllers\\Api\\Auth\\MfaController;
use App\\Http\\Controllers\\Api\\Admin\\AdminController;
use App\\Http\\Controllers\\Api\\Admin\\DashboardController as AdminDashboardController;
use App\\Http\\Controllers\\Api\\Admin\\MemberManagementController;
use App\\Http\\Controllers\\Api\\Admin\\DirectoryApprovalController;
use App\\Http\\Controllers\\Api\\Admin\\PaymentController as AdminPaymentController;
use App\\Http\\Controllers\\Api\\Admin\\ContentController;
use App\\Http\\Controllers\\Api\\Admin\\BackupController;
use App\\Http\\Controllers\\Api\\Admin\\RoleHelpController;
use App\\Http\\Controllers\\Api\\Admin\\EmailSettingsController;
use App\\Http\\Controllers\\Api\\Admin\\EmailTemplatesController;
use App\\Http\\Controllers\\Api\\Admin\\EmailLogsController;
use App\\Http\\Controllers\\Api\\Admin\\SettingsController;
use App\\Http\\Controllers\\Api\\Admin\\SecuritySettingsController;
use App\\Http\\Controllers\\Api\\Admin\\SubscriberController;
use App\\Http\\Controllers\\Api\\Admin\\ChatbotConfigController;
use App\\Http\\Controllers\\Api\\Admin\\TradeOpportunityController as AdminTradeController;
use App\\Http\\Controllers\\Api\\Admin\\TradeMatchController;
use App\\Http\\Controllers\\Api\\Admin\\CertificateController;
use App\\Http\\Controllers\\Api\\Admin\\SupportTicketController;
use App\\Http\\Controllers\\Api\\Admin\\ScheduledBackupController;
use App\\Http\\Controllers\\Api\\Admin\\ImportController;
use App\\Http\\Controllers\\Api\\Member\\DashboardController as MemberDashboardController;
use App\\Http\\Controllers\\Api\\Member\\DirectoryController;
use App\\Http\\Controllers\\Api\\Member\\ProfileController;
use App\\Http\\Controllers\\Api\\Member\\PaymentController as MemberPaymentController;
use App\\Http\\Controllers\\Api\\Member\\EmailPreferencesController;
use App\\Http\\Controllers\\Api\\Member\\ResourceController;
use App\\Http\\Controllers\\Api\\Member\\ApplicationController;
use App\\Http\\Controllers\\Api\\Member\\CertificateController as MemberCertificateController;
use App\\Http\\Controllers\\Api\\Member\\TradeController;
use App\\Http\\Controllers\\Api\\Member\\SupportTicketController;
use App\\Http\\Controllers\\Api\\Public\\NewsController;
use App\\Http\\Controllers\\Api\\Public\\ProductController;
use App\\Http\\Controllers\\Api\\Public\\ActivityController;
use App\\Http\\Controllers\\Api\\Public\\MediaController;
use App\\Http\\Controllers\\Api\\Public\\EventController;
use App\\Http\\Controllers\\Api\\Public\\DirectoryController as PublicDirectoryController;
use App\\Http\\Controllers\\Api\\Public\\TradeOpportunitiesController;
use App\\Http\\Controllers\\Api\\Public\\ChatbotController;
use App\\Http\\Controllers\\Api\\Public\\CountdownController;
use App\\Http\\Controllers\\Api\\Public\\HomePageController;
use App\\Http\\Controllers\\Api\\Public\\StatsController;
use App\\Http\\Controllers\\Api\\Public\\SubscriberController as PublicSubscriberController;
use App\\Http\\Controllers\\Api\\Webhook\\PaystackWebhookController;
use App\\Http\\Controllers\\Api\\Webhook\\FlutterwaveWebhookController;
use App\\Http\\Controllers\\Api\\Webhook\\HubtelWebhookController;
use Illuminate\\Support\\Facades\\Route;

/*
|--------------------------------------------------------------------------
| API Routes - FAGE Ghana
|--------------------------------------------------------------------------
*/

Route::get(\'/health\', fn () => response()->json([\'status\' => \'ok\', \'version\' => \'1.0.0\']));

// Setup / Installation Wizard
Route::prefix(\'setup\')->group(function () {
    Route::get(\'/status\', [\\App\\Http\\Controllers\\Api\\SetupController::class, \'status\']);
    Route::get(\'/requirements\', [\\App\\Http\\Controllers\\Api\\SetupController::class, \'checkRequirements\']);
    Route::post(\'/test-database\', [\\App\\Http\\Controllers\\Api\\SetupController::class, \'testDatabase\']);
    Route::post(\'/test-email\', [\\App\\Http\\Controllers\\Api\\SetupController::class, \'testEmail\']);
    Route::post(\'/install\', [\\App\\Http\\Controllers\\Api\\SetupController::class, \'install\']);
    Route::post(\'/import-backup\', [\\App\\Http\\Controllers\\Api\\SetupController::class, \'importSupabaseBackup\']);
});

// All routes below require installation
Route::middleware([\'installed\'])->group(function () {

    // PUBLIC: No auth required
    Route::prefix(\'public\')->group(function () {
        Route::post(\'/auth/login\', [LoginController::class, \'login\']);
        Route::post(\'/auth/register\', [RegisterController::class, \'register\']);
        Route::post(\'/auth/forgot-password\', [PasswordResetController::class, \'forgotPassword\']);
        Route::post(\'/auth/reset-password\', [PasswordResetController::class, \'resetPassword\']);
        Route::post(\'/auth/verify-email/{id}/{hash}\', [RegisterController::class, \'verifyEmail\']);

        Route::get(\'/news\', [NewsController::class, \'index\']);
        Route::get(\'/news/{slug}\', [NewsController::class, \'show\']);
        Route::get(\'/products\', [ProductController::class, \'index\']);
        Route::get(\'/products/{slug}\', [ProductController::class, \'show\']);
        Route::get(\'/activities\', [ActivityController::class, \'index\']);
        Route::get(\'/activities/{slug}\', [ActivityController::class, \'show\']);
        Route::get(\'/events\', [EventController::class, \'index\']);
        Route::get(\'/events/{slug}\', [EventController::class, \'show\']);
        Route::get(\'/media\', [MediaController::class, \'index\']);

        Route::get(\'/directory\', [PublicDirectoryController::class, \'index\']);
        Route::get(\'/directory/{slug}\', [PublicDirectoryController::class, \'show\']);

        Route::get(\'/trade-opportunities\', [TradeOpportunitiesController::class, \'index\']);

        Route::get(\'/home-page\', [HomePageController::class, \'index\']);
        Route::get(\'/countdown\', [CountdownController::class, \'index\']);
        Route::get(\'/stats\', [StatsController::class, \'index\']);

        Route::post(\'/chatbot\', [ChatbotController::class, \'chat\']);

        Route::post(\'/subscribers\', [PublicSubscriberController::class, \'subscribe\']);
        Route::delete(\'/subscribers\', [PublicSubscriberController::class, \'unsubscribe\']);
    });

    // AUTHENTICATED ROUTES
    Route::middleware(\'auth:sanctum\')->group(function () {

        Route::post(\'/auth/logout\', [LoginController::class, \'logout\']);
        Route::post(\'/auth/mfa/send-code\', [MfaController::class, \'sendCode\']);
        Route::post(\'/auth/mfa/verify\', [MfaController::class, \'verify\']);
        Route::get(\'/auth/me\', [LoginController::class, \'me\']);
        Route::put(\'/auth/profile\', [ProfileController::class, \'updateProfile\']);
        Route::put(\'/auth/password\', [ProfileController::class, \'updatePassword\']);
        Route::delete(\'/auth/account\', [ProfileController::class, \'deleteAccount\']);

        // Member Dashboard
        Route::prefix(\'member\')->group(function () {
            Route::get(\'/dashboard\', [MemberDashboardController::class, \'index\']);
            Route::get(\'/profile\', [ProfileController::class, \'show\']);
            Route::put(\'/profile\', [ProfileController::class, \'update\']);
            Route::post(\'/profile/avatar\', [ProfileController::class, \'uploadAvatar\']);

            Route::get(\'/directory\', [DirectoryController::class, \'myListing\']);
            Route::post(\'/directory\', [DirectoryController::class, \'createListing\']);
            Route::put(\'/directory\', [DirectoryController::class, \'updateListing\']);

            Route::get(\'/payments\', [MemberPaymentController::class, \'index\']);
            Route::post(\'/payments/initialize\', [MemberPaymentController::class, \'initialize\']);
            Route::get(\'/payments/{id}\', [MemberPaymentController::class, \'show\']);

            Route::get(\'/applications\', [ApplicationController::class, \'index\']);
            Route::post(\'/applications\', [ApplicationController::class, \'store\']);
            Route::get(\'/applications/{id}\', [ApplicationController::class, \'show\']);

            Route::get(\'/certificates\', [MemberCertificateController::class, \'index\']);
            Route::get(\'/certificates/{id}/download\', [MemberCertificateController::class, \'download\']);

            Route::get(\'/resources\', [ResourceController::class, \'index\']);

            Route::get(\'/trade-opportunities\', [TradeController::class, \'index\']);
            Route::get(\'/trade-opportunities/{id}\', [TradeController::class, \'show\']);

            Route::get(\'/support-tickets\', [SupportTicketController::class, \'index\']);
            Route::post(\'/support-tickets\', [SupportTicketController::class, \'store\']);
            Route::get(\'/support-tickets/{id}\', [SupportTicketController::class, \'show\']);
            Route::post(\'/support-tickets/{id}/messages\', [SupportTicketController::class, \'addMessage\']);

            Route::get(\'/email-preferences\', [EmailPreferencesController::class, \'show\']);
            Route::put(\'/email-preferences\', [EmailPreferencesController::class, \'update\']);
        });

        // Admin Routes
        Route::middleware(\'role:admin,superadmin,developer\')->prefix(\'admin\')->group(function () {

            Route::get(\'/dashboard\', [AdminDashboardController::class, \'index\']);
            Route::get(\'/stats\', [AdminDashboardController::class, \'stats\']);

            Route::apiResource(\'users\', AdminController::class);
            Route::put(\'/users/{id}/role\', [AdminController::class, \'updateRole\']);
            Route::put(\'/users/{id}/status\', [AdminController::class, \'updateStatus\']);

            Route::get(\'/members\', [MemberManagementController::class, \'index\']);
            Route::get(\'/members/{id}\', [MemberManagementController::class, \'show\']);
            Route::put(\'/members/{id}\', [MemberManagementController::class, \'update\']);
            Route::delete(\'/members/{id}\', [MemberManagementController::class, \'destroy\']);

            Route::get(\'/directory/pending\', [DirectoryApprovalController::class, \'pending\']);
            Route::put(\'/directory/{id}/approve\', [DirectoryApprovalController::class, \'approve\']);
            Route::put(\'/directory/{id}/reject\', [DirectoryApprovalController::class, \'reject\']);

            Route::get(\'/payments\', [AdminPaymentController::class, \'index\']);
            Route::get(\'/payments/{id}\', [AdminPaymentController::class, \'show\']);
            Route::put(\'/payments/{id}/status\', [AdminPaymentController::class, \'updateStatus\']);
            Route::get(\'/payments/stats\', [AdminPaymentController::class, \'stats\']);

            // Content management
            Route::get(\'/news\', [ContentController::class, \'indexNews\']);
            Route::post(\'/news\', [ContentController::class, \'storeNews\']);
            Route::put(\'/news/{id}\', [ContentController::class, \'updateNews\']);
            Route::delete(\'/news/{id}\', [ContentController::class, \'destroyNews\']);

            Route::get(\'/products\', [ContentController::class, \'indexProducts\']);
            Route::post(\'/products\', [ContentController::class, \'storeProduct\']);
            Route::put(\'/products/{id}\', [ContentController::class, \'updateProduct\']);
            Route::delete(\'/products/{id}\', [ContentController::class, \'destroyProduct\']);

            Route::get(\'/activities\', [ContentController::class, \'indexActivities\']);
            Route::post(\'/activities\', [ContentController::class, \'storeActivity\']);
            Route::put(\'/activities/{id}\', [ContentController::class, \'updateActivity\']);
            Route::delete(\'/activities/{id}\', [ContentController::class, \'destroyActivity\']);

            Route::get(\'/events\', [ContentController::class, \'indexEvents\']);
            Route::post(\'/events\', [ContentController::class, \'storeEvent\']);
            Route::put(\'/events/{id}\', [ContentController::class, \'updateEvent\']);
            Route::delete(\'/events/{id}\', [ContentController::class, \'destroyEvent\']);

            Route::get(\'/media\', [ContentController::class, \'indexMedia\']);
            Route::post(\'/media\', [ContentController::class, \'storeMedia\']);
            Route::delete(\'/media/{id}\', [ContentController::class, \'destroyMedia\']);

            Route::get(\'/home-page\', [ContentController::class, \'getHomePage\']);
            Route::put(\'/home-page\', [ContentController::class, \'updateHomePage\']);
            Route::get(\'/countdown\', [ContentController::class, \'getCountdown\']);
            Route::put(\'/countdown\', [ContentController::class, \'updateCountdown\']);

            Route::apiResource(\'trade-opportunities\', AdminTradeController::class);
            Route::post(\'/trade-opportunities/{id}/match\', [TradeMatchController::class, \'match\']);

            Route::get(\'/certificates\', [CertificateController::class, \'index\']);
            Route::post(\'/certificates\', [CertificateController::class, \'store\']);
            Route::put(\'/certificates/{id}\', [CertificateController::class, \'update\']);
            Route::delete(\'/certificates/{id}\', [CertificateController::class, \'destroy\']);
            Route::get(\'/certificates/{id}/verify\', [CertificateController::class, \'verify\']);

            Route::get(\'/support-tickets\', [SupportTicketController::class, \'index\']);
            Route::get(\'/support-tickets/{id}\', [SupportTicketController::class, \'show\']);
            Route::put(\'/support-tickets/{id}\', [SupportTicketController::class, \'update\']);
            Route::post(\'/support-tickets/{id}/messages\', [SupportTicketController::class, \'addMessage\']);
            Route::put(\'/support-tickets/{id}/assign\', [SupportTicketController::class, \'assign\']);
            Route::put(\'/support-tickets/{id}/status\', [SupportTicketController::class, \'updateStatus\']);

            Route::get(\'/applications\', [ApplicationController::class, \'adminIndex\']);
            Route::get(\'/applications/{id}\', [ApplicationController::class, \'adminShow\']);
            Route::put(\'/applications/{id}/status\', [ApplicationController::class, \'updateStatus\']);

            Route::get(\'/subscribers\', [SubscriberController::class, \'index\']);
            Route::delete(\'/subscribers/{id}\', [SubscriberController::class, \'destroy\']);
            Route::get(\'/chatbot-config\', [ChatbotConfigController::class, \'show\']);
            Route::put(\'/chatbot-config\', [ChatbotConfigController::class, \'update\']);

            Route::get(\'/email-settings\', [EmailSettingsController::class, \'show\']);
            Route::put(\'/email-settings\', [EmailSettingsController::class, \'update\']);
            Route::get(\'/email-templates\', [EmailTemplatesController::class, \'index\']);
            Route::get(\'/email-templates/{id}\', [EmailTemplatesController::class, \'show\']);
            Route::put(\'/email-templates/{id}\', [EmailTemplatesController::class, \'update\']);
            Route::post(\'/email-templates/{id}/test\', [EmailTemplatesController::class, \'test\']);
            Route::get(\'/email-logs\', [EmailLogsController::class, \'index\']);

            Route::get(\'/roles\', [RoleHelpController::class, \'index\']);
            Route::put(\'/roles/{role}\', [RoleHelpController::class, \'update\']);
            Route::get(\'/security-settings\', [SecuritySettingsController::class, \'show\']);
            Route::put(\'/security-settings\', [SecuritySettingsController::class, \'update\']);
            Route::get(\'/settings\', [SettingsController::class, \'show\']);
            Route::put(\'/settings\', [SettingsController::class, \'update\']);

            Route::get(\'/backups\', [BackupController::class, \'index\']);
            Route::post(\'/backups/create\', [BackupController::class, \'create\']);
            Route::get(\'/backups/{id}/download\', [BackupController::class, \'download\']);
            Route::post(\'/backups/{id}/restore\', [BackupController::class, \'restore\']);
            Route::delete(\'/backups/{id}\', [BackupController::class, \'destroy\']);
            Route::get(\'/backups/config\', [ScheduledBackupController::class, \'showConfig\']);
            Route::put(\'/backups/config\', [ScheduledBackupController::class, \'updateConfig\']);

            Route::post(\'/import-supabase-backup\', [ImportController::class, \'import\']);
        });
    });

    // Payment Webhooks (no auth, signature verification)
    Route::prefix(\'webhooks\')->group(function () {
        Route::post(\'/paystack\', [PaystackWebhookController::class, \'handle\']);
        Route::post(\'/flutterwave\', [FlutterwaveWebhookController::class, \'handle\']);
        Route::post(\'/hubtel\', [HubtelWebhookController::class, \'handle\']);
    });

    Route::post(\'/payments/paystack/initialize\', [MemberPaymentController::class, \'initializePublic\']);
    Route::post(\'/payments/flutterwave/initialize\', [MemberPaymentController::class, \'initializePublicFw\']);
    Route::post(\'/payments/hubtel/initialize\', [MemberPaymentController::class, \'initializePublicHt\']);
});
';

file_put_contents(__DIR__ . '/routes/api.php', $content);
echo "Written " . strlen($content) . " bytes to routes/api.php\n";
