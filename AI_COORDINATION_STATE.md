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

GitHub Issue #2:
https://github.com/oleg3479881328-code/QuizLight/issues/2

## Previous Channels

- GitHub Issue #1 — archived for new messages because the thread became too long for reliable connector reading.
- GitHub Issue #2 — active channel for all new executor reports, blockers, questions, and reviewer replies.

## Active Participants

- Owner: Oleg Povalyukhin
- Reviewer: ChatGPT
- Executor Agent: Cline (Codex Agent)

The executor agent role is model-neutral. A future executor may be Codex, DeepSeek, Claude, another connected AI agent, automation, or a human developer.

## Current Task

Integrate Azure Translator as the MVP translation and compact dictionary layer while preserving local suggestions as fallback.

## Current Repository State

Latest reviewed commit:

`54fbaa4` — fix: route manual translation buttons through updateDraft()

Current review status:

`PATCH_APPLIED — awaiting reviewer confirmation`

## Accepted Changes

- Azure secrets remain server-side.
- `.env.local` values are loaded through Vite `loadEnv()`.
- Browser calls local `/api/translate` and `/api/dictionary-lookup` routes.
- Local fallback remains available when Azure is unavailable.
- EN -> RU and RU -> EN manual translation handlers exist.
- YouTube transcript click starts asynchronous EN -> RU translation.
- Context window appears immediately before translation completes.
- Dictionary lookup exists.
- Dictionary target translation can be applied to the Russian card field.
- Provider metadata exists: `azure` or `local-fallback`.
- UI provider labels exist: `Azure Translator` or `Локальная подсказка`.
- Fallback note exists.
- Dedicated transcript-click `AbortController` exists.
- Request-id stale-response guard exists.
- Russian manual-edit version guard exists.
- Root-level append-only coordination journal exists: `AI_COORDINATION_LOG.md`.
- `invalidateTranscriptTranslation()` helper — aborts pending request + increments requestId.
- `updateDraft('english', ...)` triggers `invalidateTranscriptTranslation()`.
- `applyEnglishSuggestion` routes through `updateDraft('english', value)`.
- `applyRussianSuggestion` routes through `updateDraft('russian', value)`.
- `resetForm()` calls `invalidateTranscriptTranslation()` + clears provider state.
- Manual translation buttons (RU→EN, EN→RU) route through `updateDraft()` instead of direct `setDraft()`.

## Open Review Items

All items from the fifth review (Patch 5) have been applied and pushed:

1. ✅ Route local Russian suggestion selection through `updateDraft('russian', value)`
2. ✅ Add `invalidateTranscriptTranslation()` helper
3. ✅ Invalidate pending transcript translation when English field is changed, English suggestion applied, or form reset
4. ✅ Route local English suggestion selection through `updateDraft('english', value)`
5. ✅ In `resetForm()`: invalidate pending translation, clear provider label, clear fallback note

All items from the sixth review (Patch 6) have been applied and pushed:

1. ✅ `handleTranslateRuToEn` routes through `updateDraft('english', result.data.text)`
2. ✅ `handleTranslateEnToRu` routes through `updateDraft('russian', result.data.text)`

## Next Step

Reviewer (ChatGPT) to confirm the patch and either approve or request further changes.

## Required Validation

```text
npm run build
npm run lint
```

Manual checks:

```text
1. Transcript phrase -> while pending click local Russian suggestion -> late Azure response must not overwrite it.
2. Transcript phrase -> while pending manually edit English -> late response must not update provider label or fallback note.
3. Transcript phrase -> while pending reset form -> late response must not update provider label or fallback note.
4. Phrase A then phrase B quickly -> late A response ignored.
5. Clear Russian while pending -> late response ignored.
6. Azure absent -> manual Thank you translation -> Спасибо + local fallback label + note.
7. Azure success after fallback -> fallback note clears.
8. Dictionary apply still updates Russian field.
9. YouTube playback still works.
```

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
