## Goal

When a user asks a free-text question, first try to answer it by keyword-matching against the `chatbot_knowledge` sections. Only fall back to `/api/chat` (or the "leave a message" flow with the flying-email animation) when no section matches. This keeps most answers instant, on-topic, and removes the transferring animation for common questions.

## Behaviour

1. User types a question in `ask` mode (or first message after opening).
2. Widget picks the best-scoring `chatbot_knowledge` section:
  - Score = weighted keyword overlap of the question against each row's `section` title (×3) and `content` (×1), after lowercasing, stripping punctuation, and removing stopwords (`the, a, of, is, and, to, for, in, on, what, how, who, where, when, do, does…`).
  - Also match common synonyms/aliases per topic (e.g. "join / register / sign up" → Membership; "cost / price / fee" → Tiers; "call / phone / email / office" → Contact; "training / academy / course" → FAGE Academy).
  - Require a minimum score threshold (e.g. ≥ 2 matched non-stopword tokens, or ≥ 1 that also appears in the section title) to count as a hit.
3. Match found → bot replies with that section's `content` (trimmed to a reasonable length, markdown-safe), attaches the 👍/👎 feedback controls, and stays in `ask` mode.
4. Multiple close matches → pick the top score; if a second section is within ~15 % of the top, append a "Related: [Section B], [Section C]" line as quick-reply chips.
5. No match → fall through to the existing `/api/chat` call (AI) — no automatic escalation, no email/transferring animation.
6. Escalation (the flying-email flow) only runs when the user explicitly chooses **Leave a message** from the menu or types a clear "talk to human" phrase.

## Data & caching

- On widget open (or on first `ask`), fetch `chatbot_knowledge` rows where `enabled = true`, ordered by `display_order`, via the existing supabase client. Cache the array in a `useRef` for the session so repeat questions are instant.
- Rows already contain `section` and `content` — no schema change needed.
- Admin's edits in `/admin/chatbot` take effect on the next widget open (or after a manual "Refresh" — not needed for MVP).

## Feedback loop stays intact

- Local-match replies still render the 👍/👎 controls, storing the matched section as `question` context in `chatbot_feedback` so admin can see which topic missed.
- 👎 with a comment on a local match is a strong signal that the section wording needs updating — surfaced in the existing `/admin/chatbot-feedback` page.

## Files touched

- `src/components/site/ChatWidget.tsx`
  - Add `kbRef` (useRef holding cached knowledge rows) and a `loadKb()` helper.
  - Add `matchKnowledge(question)` utility with tokenize/stopword/score logic and synonym map.
  - In `onSend` / `askAI`, call `matchKnowledge` first; if it returns a hit, render locally and skip the `/api/chat` fetch and the `transferring` mode.
  - Keep `/api/chat` as the fallback for no-match questions.

No database or admin-UI changes. Existing `chatbot_knowledge` content is the source of truth; better/more sections = better matches automatically.

## Out of scope

- Full semantic/embedding search — deliberately using lightweight keyword matching so it stays client-side and instant. Can be upgraded later if match quality is poor.
- Add a caveat somewhere in the chat that bot can make mistakes too