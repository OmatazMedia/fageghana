<?php

use Illuminate\Http\Request;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

function doTest($kernel, $method, $uri, $data = null, $token = null) {
    $r = Request::create($uri, $method);
    $r->headers->set('Accept', 'application/json');
    if ($data) $r->request->replace($data);
    if ($token) $r->headers->set('Authorization', 'Bearer ' . $token);
    $resp = $kernel->handle($r);
    return $resp->getStatusCode();
}

// Login
$loginResp = $kernel->handle(Request::create('/api/public/auth/login', 'POST', [
    'email' => 'admin@fageghana.org', 'password' => 'password123'
]));
$login = json_decode($loginResp->getContent(), true);
$token = $login['token'] ?? null;
echo "Login: " . ($token ? "OK" : "FAIL") . "\n\n";

$endpoints = [
    ['Health',          'GET',  '/api/health',                      null],
    ['SetupStatus',     'GET',  '/api/setup/status',                null],
    ['PublicNews',      'GET',  '/api/public/news',                 null],
    ['PublicStats',     'GET',  '/api/public/stats',                null],
    ['AuthMe',          'GET',  '/api/auth/me',                     $token],
    ['AdminDashboard',  'GET',  '/api/admin/dashboard',             $token],
    ['MemberProfile',   'GET',  '/api/member/profile',              $token],
    ['PublicDirectory', 'GET',  '/api/public/directory',            null],
    ['AdminNews',       'GET',  '/api/admin/news',                  $token],
    ['AdminPartners',   'GET',  '/api/admin/partner-logos',         $token],
    ['AdminPlans',      'GET',  '/api/admin/subscription-plans',    $token],
    ['AdminGateways',   'GET',  '/api/admin/payment-gateways',      $token],
    ['AdminReadiness',  'GET',  '/api/admin/readiness-checklist',   $token],
    ['AdminActivity',   'GET',  '/api/admin/activity-log',          $token],
    ['AdminContacts',   'GET',  '/api/admin/contact-messages',      $token],
    ['AdminReports',    'GET',  '/api/admin/reports/membership-growth', $token],
    ['AdminBackup',     'POST', '/api/admin/backups/create',        $token],
    ['PublicPlans',     'GET',  '/api/public/subscription-plans',   null],
    ['PublicPartners',  'GET',  '/api/public/partner-logos',        null],
    ['PublicHomePage',  'GET',  '/api/public/home-page',            null],
    ['PublicTrade',     'GET',  '/api/public/trade-opportunities',  null],
    ['PublicChatbot',   'POST', '/api/public/chatbot',              null],
    ['Logout',          'POST', '/api/auth/logout',                 $token],
];

$pass = 0;
$total = count($endpoints);

foreach ($endpoints as [$name, $method, $uri, $tok]) {
    $body = ($method === 'POST' && strpos($uri, 'chatbot') !== false) ? ['message' => 'hello'] : null;
    $s = doTest($kernel, $method, $uri, $body, $tok);
    $ok = $s >= 200 && $s < 300;
    if ($ok) $pass++;
    echo ($ok ? '  OK' : 'FAIL') . " {$s} {$name}\n";
}

echo "\n========================================\n";
echo "RESULT: {$pass}/{$total} passed\n";
echo "========================================\n";
