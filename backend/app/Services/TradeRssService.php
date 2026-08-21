<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TradeRssService
{
    /**
     * Parse an RSS feed URL and import new trade opportunities.
     * Returns count of new opportunities imported.
     */
    public function fetchAndImport(string $feedUrl, string $source = 'ITC Trade Map'): int
    {
        $xml = $this->fetchFeed($feedUrl);
        if (!$xml) return 0;

        $imported = 0;
        $items = $xml->channel->item ?? [];

        foreach ($items as $item) {
            $title = trim((string) ($item->title ?? ''));
            $description = trim((string) ($item->description ?? ''));
            $link = trim((string) ($item->link ?? ''));
            $pubDate = trim((string) ($item->pubDate ?? ''));
            $category = trim((string) ($item->category ?? ''));

            if (empty($title)) continue;

            // Check for duplicate by source_url
            if ($link) {
                $exists = DB::table('trade_opportunities')
                    ->where('source_url', $link)
                    ->exists();
                if ($exists) continue;
            }

            // Parse category
            $categories = ['general'];
            if ($category) {
                $cats = array_map('trim', explode(',', $category));
                $categories = array_filter($cats) ?: $categories;
            }

            // Parse country from title or description (common patterns)
            $country = $this->extractCountry($title . ' ' . $description);

            // Parse deadline from pubDate or description
            $deadline = $this->extractDeadline($description);

            DB::table('trade_opportunities')->insert([
                'id' => Str::uuid()->toString(),
                'title' => $title,
                'description' => $description,
                'source' => $source,
                'source_url' => $link ?: null,
                'category' => $categories[0] ?? 'general',
                'country' => $country,
                'deadline' => $deadline,
                'is_active' => true,
                'posted_at' => $pubDate ? $this->parseDate($pubDate) : now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $imported++;
        }

        return $imported;
    }

    /**
     * Fetch and parse an RSS feed.
     */
    private function fetchFeed(string $url): ?\SimpleXMLElement
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT => 'FAGE-Ghana-TradeFeed/1.0',
            CURLOPT_HTTPHEADER => ['Accept: application/rss+xml, application/xml, text/xml'],
        ]);
        $xmlString = curl_exec($ch);
        curl_close($ch);

        if (!$xmlString) return null;

        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($xmlString);
        if ($xml === false) {
            logger("[TradeRss] Failed to parse XML from {$url}: " . implode(', ', libxml_get_errors()));
            return null;
        }

        return $xml;
    }

    /**
     * Extract country name from text using common patterns.
     */
    private function extractCountry(string $text): ?string
    {
        $text = strtolower($text);

        $countries = [
            'ghana', 'nigeria', 'kenya', 'south africa', 'ethiopia', 'tanzania',
            'egypt', 'morocco', 'tunisia', 'senegal', 'cameroon', 'ivory coast',
            'côte d\'ivoire', 'uganda', 'mozambique', 'zambia', 'zimbabwe',
            'united states', 'usa', 'united kingdom', 'uk', 'germany', 'france',
            'china', 'india', 'japan', 'brazil', 'mexico', 'canada', 'australia',
            'european union', 'eu', 'african union', 'au',
        ];

        foreach ($countries as $country) {
            if (str_contains($text, $country)) {
                return ucfirst($country);
            }
        }

        return null;
    }

    /**
     * Extract a deadline date from text.
     */
    private function extractDeadline(string $text): ?string
    {
        // Look for "deadline: ..." or "closing date: ..." or "expires: ..."
        $patterns = [
            '/deadline[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
            '/closing\s+date[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
            '/expires?[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
            '/deadline[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i',
            '/deadline[:\s]+(\d{4}-\d{2}-\d{2})/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                return $matches[1];
            }
        }

        return null;
    }

    /**
     * Parse a date string into a timestamp.
     */
    private function parseDate(string $dateStr): string
    {
        $timestamp = strtotime($dateStr);
        return $timestamp ? date('Y-m-d H:i:s', $timestamp) : now()->toDateTimeString();
    }
}
