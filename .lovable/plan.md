
## Goals

1. Make `menu` and `exit` behave as reliable in-chat commands with confirmation UX.
2. Collect end-of-chat feedback (thumbs up/down + optional star rating + comment).
3. Give admins a way to review feedback so they can spot gaps in the knowledge base / acknowledgement page.

---

## 1. Command handling (`src/components/site/ChatWidget.tsx`)

Rework the input handler in `onSend()` so commands are detected against the whole trimmed message, not just as substrings.

- **`exit` as a single word** (case-insensitive, with or without punctuation) at any point → immediately run `handleExit()` (existing flow), regardless of `mode` (including mid-`leave-msg` and mid-`ask`). Confirm to user: "Ending our chat — thanks for stopping by 👋" then close + reset.
- **`menu` as a single word** at any point →
  - If `mode === "menu"` and last state was idle: just re-show `QUICK_MENU`.
  - Otherwise (mid-conversation, mid-ask, mid-leave-msg): pause the current flow and ask: *"You've asked to return to the main menu. Do you want to end this conversation and go back to the menu?"* with Yes / No quick replies.
    - **Yes** → clear pending flow state (leave form, ask mode), show `QUICK_MENU`, set `mode="menu"`.
    - **No** → repeat the last bot message verbatim (look up the last `from: "bot"` entry in `msgs`) and restore the prior `mode` (stored before the confirmation).
- Keep the existing loose `isExitIntent` behavior for polite goodbyes ("thanks", "bye"), but the strict single-word `exit` always terminates.
- Menu/exit words that appear as part of a longer sentence (e.g. "My name is Menu Adjei") are ignored — checked via `text.trim().toLowerCase() === "menu" | "exit"`.

State additions:
- `pendingMenuConfirm: { prevMode: Mode; lastBotText: string } | null` to drive the confirmation branch.

## 2. End-of-chat feedback

Trigger points:
- After `handleExit()` (before closing), inject a feedback step instead of closing immediately.
- Also offer a "Was this helpful?" prompt after each `askAI` reply (thumbs up/down inline under the bot bubble — small, non-intrusive).

Feedback UI:
- Thumbs up 👍 / thumbs down 👎 quick actions.
- If 👎 → prompt "Sorry about that. What were you looking for?" — capture free-text comment.
- On chat close, a compact 1–5 star rating + optional comment.

Persist to a new table `chatbot_feedback`:

```text
chatbot_feedback
  id uuid pk
  kind text check in ('reply','session')   -- inline reply feedback vs end-of-session
  helpful boolean null                     -- for kind='reply'
  rating int null check between 1 and 5    -- for kind='session'
  comment text null
  question text null                       -- the user question that prompted a 'reply' feedback
  bot_reply text null                      -- the bot answer being rated
  transcript jsonb null                    -- full msgs array for 'session' feedback
  session_id text not null                 -- random per-widget-session id in sessionStorage
  user_id uuid null                        -- if logged in
  page_url text
  created_at timestamptz default now()
```

RLS + grants:
- Anon + authenticated: `INSERT` allowed (widget is public).
- Only admin / superadmin / staff / developer: `SELECT`.
- `GRANT INSERT ON public.chatbot_feedback TO anon, authenticated;`
- `GRANT SELECT ON public.chatbot_feedback TO authenticated;` (RLS gates by role).
- `GRANT ALL ON public.chatbot_feedback TO service_role;`

Widget inserts directly via the anon supabase client.

## 3. Knowledge base coverage (Acknowledgement content)

The chatbot already composes its system prompt from `chatbot_knowledge` (see `/api/chat`). To make it answer acknowledgement-page questions:
- Add one or more seeded rows to `chatbot_knowledge` (`section = "Acknowledgement"`, content = the acknowledgement page copy — I'll pull the visible text from the current acknowledgement route as the seed).
- No code change needed beyond the seed; admins can then edit at `/admin/chatbot`.

## 4. Admin: Feedback dashboard

New route: `src/routes/admin.chatbot-feedback.tsx`

- Sidebar link under "Content" (or next to "Chatbot Knowledge"), gated to admin / superadmin / developer / staff.
- Tabs / filters:
  - **Unhelpful replies** — rows where `kind='reply' AND helpful=false`, showing question, bot reply, optional comment, date. Sortable, paginated. Highlights knowledge-base gaps.
  - **Session ratings** — rows where `kind='session'`, showing stars, comment, transcript preview (expandable).
  - **All feedback** — combined.
- Simple stats header: total responses, % helpful, avg star rating (last 30 days).
- Optional: "Add to knowledge base" quick action on an unhelpful row → opens `/admin/chatbot` with a prefilled draft (nice-to-have; skip if scope tight).

## 5. Small touches

- Update the input placeholder to keep the current hint: *"Type a message, 'menu' for options, or 'exit' to close."* — already present, verify.
- After the menu confirmation "No" branch, re-issue the exact prior bot prompt so the user doesn't lose flow.

---

## Answer to your question

> "Would there be need to see the reaction of feedbacks in the dashboard?"

**Yes — strongly recommended.** Two payoffs:
1. **Unhelpful answers become a to-do list**: every 👎 with the user's question tells you exactly which topic to add to the Chatbot Knowledge Base (or to the acknowledgement page). Without this visibility, gaps stay invisible.
2. **Star ratings + comments** give a qualitative pulse — you'll see if the widget is delighting or frustrating people, and can act before users escalate to WhatsApp or email.

Keeping it lightweight (just an admin table + filters) is enough — no need for charts unless you want them later.

## Files touched

- `src/components/site/ChatWidget.tsx` — command handling, feedback UI hooks
- `src/routes/admin.chatbot-feedback.tsx` — new admin page
- `src/routes/admin.tsx` — sidebar entry + gate
- Migration: `chatbot_feedback` table + RLS + grants
- Seed: acknowledgement content into `chatbot_knowledge`

## Out of scope

- Rewriting the acknowledgement page itself.
- Emailing admins when unhelpful feedback lands (can add later via a trigger + edge function if desired).
- Analytics dashboards / charts.
