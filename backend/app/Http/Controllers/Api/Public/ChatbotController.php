<?php
namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ChatbotController extends Controller
{
    /**
     * Chat endpoint — tries AI provider first, falls back to knowledge base.
     */
    public function chat(Request $r)
    {
        $v = $r->validate([
            'message' => 'required|string|max:2000',
            'session_id' => 'nullable|string',
            'history' => 'nullable|array',
        ]);

        $message = $v['message'];
        $sessionId = $v['session_id'] ?? Str::uuid()->toString();

        // Get chatbot config
        $config = DB::table('chatbot_configs')->first();
        $provider = $config->provider ?? 'knowledge_base';
        $apiKey = $config->api_key ?? '';
        $model = $config->model ?? 'gpt-3.5-turbo';
        $systemPrompt = $config->system_prompt ?? 'You are a helpful assistant for FAGE Ghana (Federation of Association of Ghana Exporters). Help members with export questions, membership, and trade opportunities.';
        $maxTokens = $config->max_tokens ?? 500;

        // Try AI provider
        $response = null;
        if ($provider !== 'knowledge_base' && $apiKey) {
            $response = $this->callAI($provider, $apiKey, $model, $systemPrompt, $message, $v['history'] ?? [], $maxTokens);
        }

        // Fall back to knowledge base
        if (!$response) {
            $response = $this->queryKnowledgeBase($message);
        }

        // Save to chatbot_feedback table for training
        try {
            DB::table('chatbot_feedback')->insert([
                'id' => Str::uuid()->toString(),
                'session_id' => $sessionId,
                'user_message' => $message,
                'bot_response' => $response,
                'user_id' => $r->user()?->id,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Non-critical
        }

        return response()->json([
            'response' => $response,
            'session_id' => $sessionId,
            'provider' => $provider,
        ]);
    }

    /**
     * Submit feedback on a chatbot response.
     */
    public function feedback(Request $r)
    {
        $v = $r->validate([
            'session_id' => 'required|string',
            'rating' => 'required|in:positive,negative',
            'comment' => 'nullable|string|max:1000',
        ]);

        DB::table('chatbot_feedback')->where('session_id', $v['session_id'])->update([
            'rating' => $v['rating'],
            'comment' => $v['comment'] ?? null,
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Feedback recorded']);
    }

    /**
     * Escalate chat to a support ticket.
     */
    public function escalate(Request $r)
    {
        $v = $r->validate([
            'session_id' => 'required|string',
            'message' => 'nullable|string',
        ]);

        // Get recent chat messages for this session
        $messages = DB::table('chatbot_feedback')
            ->where('session_id', $v['session_id'])
            ->orderBy('created_at')
            ->get();

        $chatLog = $messages->map(fn($m) => "User: {$m->user_message}\nBot: {$m->bot_response}")->implode("\n\n");
        $userId = $r->user()?->id;

        // Create support ticket
        $ticketId = Str::uuid()->toString();
        DB::table('support_tickets')->insert([
            'id' => $ticketId,
            'user_id' => $userId,
            'subject' => 'Chat Escalation — Session ' . substr($v['session_id'], 0, 8),
            'message' => ($v['message'] ?? "Chatbot escalation") . "\n\n--- Chat History ---\n" . $chatLog,
            'status' => 'open',
            'priority' => 'medium',
            'category' => 'general',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Support ticket created',
            'ticket_id' => $ticketId,
        ]);
    }

    /**
     * Call an AI provider (OpenAI or Gemini).
     */
    private function callAI(string $provider, string $apiKey, string $model, string $systemPrompt, string $userMessage, array $history, int $maxTokens): ?string
    {
        try {
            if ($provider === 'openai') {
                return $this->callOpenAI($apiKey, $model, $systemPrompt, $userMessage, $history, $maxTokens);
            } elseif ($provider === 'gemini') {
                return $this->callGemini($apiKey, $model, $systemPrompt, $userMessage, $maxTokens);
            }
        } catch (\Throwable $e) {
            logger()->warning("AI provider {$provider} failed: " . $e->getMessage());
        }
        return null;
    }

    private function callOpenAI(string $apiKey, string $model, string $systemPrompt, string $userMessage, array $history, int $maxTokens): ?string
    {
        $messages = [['role' => 'system', 'content' => $systemPrompt]];
        foreach (array_slice($history, -10) as $h) {
            $messages[] = ['role' => $h['role'] ?? 'user', 'content' => $h['content'] ?? ''];
        }
        $messages[] = ['role' => 'user', 'content' => $userMessage];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'model' => $model,
                'messages' => $messages,
                'max_tokens' => $maxTokens,
            ]),
        ]);
        $response = json_decode(curl_exec($ch), true);
        curl_close($ch);

        return $response['choices'][0]['message']['content'] ?? null;
    }

    private function callGemini(string $apiKey, string $model, string $systemPrompt, string $userMessage, int $maxTokens): ?string
    {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
        $contents = [['role' => 'user', 'parts' => [['text' => $systemPrompt . "\n\n" . $userMessage]]]];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode([
                'contents' => $contents,
                'generationConfig' => ['maxOutputTokens' => $maxTokens],
            ]),
        ]);
        $response = json_decode(curl_exec($ch), true);
        curl_close($ch);

        return $response['candidates'][0]['content']['parts'][0]['text'] ?? null;
    }

    /**
     * Simple knowledge base search using chatbot_knowledge table.
     */
    private function queryKnowledgeBase(string $message): string
    {
        $keywords = array_filter(explode(' ', strtolower($message)), fn($w) => strlen($w) > 2);
        if (empty($keywords)) {
            return "I'm here to help with FAGE Ghana questions. Could you rephrase that?";
        }

        $knowledge = DB::table('chatbot_knowledge')->where('is_active', true)->get();
        $bestMatch = null;
        $bestScore = 0;

        foreach ($knowledge as $entry) {
            $text = strtolower(($entry->question ?? '') . ' ' . ($entry->content ?? ''));
            $score = 0;
            foreach ($keywords as $kw) {
                if (str_contains($text, $kw)) $score++;
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestMatch = $entry;
            }
        }

        if ($bestMatch && $bestScore > 0) {
            return $bestMatch->answer ?? $bestMatch->content ?? "I found a related topic but couldn't provide details.";
        }

        return "I'm not sure about that. For specific inquiries, please contact membership@fageghana.org or create a support ticket.";
    }
}
