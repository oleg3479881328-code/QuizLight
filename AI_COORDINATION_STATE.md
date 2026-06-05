# AI Coordination State

## Project

QuizLight

## Purpose

This file is the compact operational state for AI-to-AI coordination.

Use GitHub Issue comments for message transport.
Use this file for the current state, accepted decisions, open review items, and one next step.
Use `AI_COORDINATION_LOG.md` for append-only chronological history of meaningful coordination events.

Do not copy the full discussion history into this file.

## Active Channel

GitHub Issue #3:
https://github.com/oleg3479881328-code/QuizLight/issues/3

## Previous Channels

- GitHub Issue #1 — archived for new messages because the thread became too long for reliable connector reading.
- GitHub Issue #2 — Azure Translator review channel; retained as completed technical history for the deferred Azure layer.
- GitHub Issue #3 — active channel for DeepSeek API integration, executor reports, blockers, questions, and reviewer replies.

## Active Participants

- Owner: Oleg Povalyukhin
- Reviewer and Architect: ChatGPT
- Executor Agent: Cline (Codex Agent)

The executor role is model-neutral. A future executor may be Codex, DeepSeek, Claude, another connected AI agent, automation, or a human developer.

## Current Task

Replace Azure Translator with DeepSeek as the active AI provider for the personal testing phase.

## Current Repository State

Latest commit:

`4dfb99d` — fix: apply all 7 ChatGPT review items for DeepSeek bounded revision

Current coordination status:

`BOUNDED_REVISION_APPLIED — awaiting reviewer confirmation in GitHub Issue #3`


## Accepted Decisions (Issue #3)

- DeepSeek is the single active AI provider for this phase.
- Azure code is preserved but not configured or called by default.
- Server-side secret: `DEEPSEEK_API_KEY` (not exposed via `VITE_`).
- Model: `deepseek-v4-flash` (thinking disabled, temperature 0.3).
- Provider policy: DeepSeek API → local fallback.
- Bounded Issue #3 scope only — no auth, deployment, billing UI, database, or unrelated features.

## Active DeepSeek Scope

- manual RU → EN translation
- manual EN → RU translation
- dictionary lookup
- YouTube transcript phrase translation
- AI-generated sense block
- runtime token logging (via DeepSeek API response)
- runtime cache-hit/cache-miss logging (via DeepSeek API response)

## Implementation Summary

### Files Changed (8 files, +395/-142 lines)

1. **vite.config.ts** — Added DeepSeek dev-server middleware for `/api/translate` and `/api/dictionary-lookup`. Azure code preserved as commented-out deferred compatibility block.
2. **translationService.ts** — Calls DeepSeek via middleware, falls back to local suggestions. All Azure references replaced.
3. **types.ts** — Removed `'azure'` from `TranslationResult.provider` and `DictionaryLookupResult.provider` union types.
4. **App.tsx** — All 6 Azure references replaced with DeepSeek. Provider labels show `'DeepSeek'` or `'Локальная подсказка'`.
5. **.env.example** — `DEEPSEEK_API_KEY` primary, Azure deferred.
6. **AI_COORDINATION_STATE.md** — Updated for DeepSeek transition.
7. **AI_COORDINATION_LOG.md** — Updated for DeepSeek transition.
8. **src/App.css** — Minor styling adjustments.

### Validation

- `npm run build` — 0 errors ✅
- `npm run lint` — 0 new errors (2 pre-existing warnings only) ✅

## Open Review Items

All items from the Azure Translator integration (Issue #1, Issue #2) have been applied and accepted:

1. ✅ Route local Russian suggestion selection through `updateDraft('russian', value)`
2. ✅ Add `invalidateTranscriptTranslation()` helper
3. ✅ Invalidate pending transcript translation when English field is changed, English suggestion applied, or form reset
4. ✅ Route local English suggestion selection through `updateDraft('english', value)`
5. ✅ In `resetForm()`: invalidate pending translation, clear provider label, clear fallback note
6. ✅ `handleTranslateRuToEn` routes through `updateDraft('english', result.data.text)`
7. ✅ `handleTranslateEnToRu` routes through `updateDraft('russian', result.data.text)`

## API Model Runtime Check

```text
Provider: DeepSeek
Model: deepseek-v4-flash (thinking disabled, temperature 0.3)
API-based AI model: Yes
Prompt caching supported: Yes (via DeepSeek API)
Usage fields available: prompt_tokens, completion_tokens, total_tokens
Cache-hit fields available: prompt_cache_hit_tokens
Cache-miss fields available: prompt_cache_miss_tokens
Stable prefix ordering preserved: N/A — not implemented in current middleware
Runtime logging implemented: Yes — all 3 endpoints (translate, dictionary, sense-block) ✅
```

## Required Validation

```text
npm run build
npm run lint
```

Manual checks with DeepSeek configured:

```text
1. Manual EN -> RU translation uses DeepSeek label.
2. Manual RU -> EN translation uses DeepSeek label.
3. Dictionary lookup returns structured alternatives.
4. Transcript phrase click fills translation and AI-generated sense block.
5. Phrase A then phrase B quickly -> stale A response ignored.
6. YouTube playback still works.
```

Manual checks without DeepSeek key:

```text
1. Translation falls back locally.
2. UI shows local fallback note.
3. App remains usable.
```

## Communication Protocol

This project follows the Project Execution OS communication-channel protocol:

1. **Entry**: `blocks/communication-channel/BLOCK.md` — `Канал связи`
2. **Channel selection**: `docs/AI_COORDINATION_HUB_STANDARD.md` — GitHub selected as active channel
3. **GitHub protocol**: `docs/integrations/chatgpt/CODEX_GITHUB_PROTOCOL.md` → `docs/CHATGPT_CODEX_GITHUB_PROTOCOL.md`

All durable AI-to-AI messages go through the active GitHub channel (Issue #3).
Executor posts structured Execution Reports as comments in the named reply surface.
ChatGPT reads and reviews through GitHub.
The user is not the normal relay for AI-to-AI coordination.

## Next Step

Reviewer (ChatGPT) to:
1. Review the bounded revision commit `4dfb99d`
2. Confirm all 7 review items are correctly applied
3. Approve or request changes in Issue #3


## Update Rule

Update this file only after a meaningful state transition:

- communication-channel migration;
- meaningful implementation commit;
- accepted review;
- new blocker;
- scope change;
- completed task.

Append the corresponding meaningful event to `AI_COORDINATION_LOG.md` first.

Do not update this file for every short coordination message.

## Reading Rule

Before resuming AI-to-AI coordination:

```text
read AI_COORDINATION_STATE.md
-> open Active Channel
-> read latest relevant comments
-> inspect latest repository commit
-> read AI_COORDINATION_LOG.md only when historical context is required
-> continue from Next Step
```
