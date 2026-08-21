<?php
namespace App\Console\Commands;

use App\Services\TradeRssService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FetchTradeFeeds extends Command
{
    protected $signature = 'trade:fetch-rss';
    protected $description = 'Fetch trade opportunities from configured RSS feeds';

    public function handle(TradeRssService $rssService): int
    {
        // Get configured feeds from app_settings
        $settings = DB::table('app_settings')->where('key', 'trade_rss_feeds')->first();
        $feeds = $settings ? json_decode($settings->value, true) : [];

        // Default feeds if none configured
        if (empty($feeds)) {
            $feeds = [
                ['url' => 'https://www.trademap.org/RSS.aspx', 'source' => 'ITC Trade Map'],
            ];
        }

        $totalImported = 0;

        foreach ($feeds as $feed) {
            $url = $feed['url'] ?? '';
            $source = $feed['source'] ?? 'RSS Feed';

            if (empty($url)) continue;

            $this->info("Fetching: {$source} ({$url})");
            $count = $rssService->fetchAndImport($url, $source);
            $totalImported += $count;
            $this->info("  Imported {$count} new opportunities");
        }

        $this->info("Total: {$totalImported} new trade opportunities imported");
        return self::SUCCESS;
    }
}
