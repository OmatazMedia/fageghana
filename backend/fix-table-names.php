<?php
/**
 * Fix table name mismatches between controllers and actual database schema.
 */

// Table name mapping: old => new
$tableMap = [
    "members" => "member_profiles",
    "news_articles" => "news",
    "directory_listings" => "directory_entries",
    "payments" => "payment_submissions",
    "support_ticket_messages" => "ticket_messages",
    "email_logs" => "email_log",
    "email_preferences" => "member_email_preferences",
    "home_pages" => "site_hero_slides",
    "chatbot_configs" => "chatbot_knowledge",
];

$dirs = [
    __DIR__ . '/app/Http/Controllers/Api/Admin',
    __DIR__ . '/app/Http/Controllers/Api/Member',
    __DIR__ . '/app/Http/Controllers/Api/Public',
    __DIR__ . '/app/Http/Controllers/Api/Webhook',
    __DIR__ . '/app/Http/Controllers/Api',
];

$changed = 0;
foreach ($dirs as $dir) {
    if (!is_dir($dir)) continue;
    foreach (glob($dir . '/*.php') as $file) {
        $content = file_get_contents($file);
        $original = $content;

        foreach ($tableMap as $old => $new) {
            $content = str_replace("'$old'", "'$new'", $content);
        }

        if ($content !== $original) {
            file_put_contents($file, $content);
            echo "Fixed: " . basename($file) . "\n";
            $changed++;
        }
    }
}

echo "\n=== Fixed $changed files ===\n";
