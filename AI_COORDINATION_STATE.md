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

Integrate DeepSeek API as the temporary MVP AI provider for broad QuizLight feature testing while preserving the existing Azure Translator code as deferred compatibility and preserving local fallbacks.

## Current Repository State

Latest accepted source-code review baseline:

`54fbaa4` — fix: route manual translation buttons through updateDraft()

Current coordination status:

`HANDOFF_ISSUED — awaiting executor confirmation in GitHub Issue #3`

## Accepted Existing Changes

- Existing Azure secrets remain server-side.
- Existing `.env.local` values are loaded through Vite `loadEnv()`.
- Existing browser translation calls use local middleware routes.
- Existing local fallback remains available when remote providers are unavailable.
- EN -> RU and RU -> EN manual translation handlers exist.
- YouTube transcript click starts asynchronous EN -> RU translation.
- Context window appears immediately before translation completes.
- Dictionary lookup exists.
- Dictionary target translation can be applied to the Russian card field.
- Existing provider metadata supports `azure` or `local-fallback`.
- Existing UI provider labels support `Azure Translator` or `Локальная подсказка`.
- Fallback note exists.
- Dedicated transcript-click `AbortController` exists.
- Request-id stale-response guard exists.
- Russian manual-edit version guard exists.
- `invalidateTranscriptTranslation()` aborts pending request and increments request id.
- Local English and Russian suggestions route through `updateDraft()`.
- Reset invalidates pending transcript translation and clears provider UI state.
- Manual translation buttons route through `updateDraft()` instead of direct `setDraft()`.
- Root-level append-only coordination journal exists: `AI_COORDINATION_LOG.md`.

## New DeepSeek Handoff Scope

Use GitHub Issue #3 as the authoritative bounded handoff packet.

Required DeepSeek MVP layer:

1. Preserve existing Azure code but defer Azure configuration.
2. Add server-side DeepSeek secret configuration only.
3. Add bounded DeepSeek translation endpoint.
4. Add bounded DeepSeek dictionary endpoint.
5. Add bounded DeepSeek sense-block endpoint.
6. Preserve existing local translation and rule-based sense-block fallbacks.
7. Add UI provider label: `DeepSeek`.
8. Add mandatory server-side runtime token and cache-hit/cache-miss logging.
9. Do not expand scope into authentication, deployment, billing UI, database storage, or unrelated features.

## API Model Runtime Check

```text
Provider: DeepSeek
Model: deepseek-v4-flash
API-based AI model: Yes
Prompt caching supported: Yes
Usage fields available: prompt_tokens, completion_tokens, total_tokens
Cache-hit fields available: prompt_cache_hit_tokens
Cache-miss fields available: prompt_cache_miss_tokens
Stable prefix ordering preserved: executor must report Yes / No
Runtime logging implemented: executor must report Yes / No
If not implemented, blocker or reason: executor must report explicitly
```

## Next Step

Executor reads GitHub Issue #3, posts a signed channel-confirmation reply, implements only the bounded DeepSeek MVP layer, runs build and lint, appends one meaningful event at the bottom of `AI_COORDINATION_LOG.md`, updates this snapshot if the current state changes, and posts a signed Patch Execution Report in GitHub Issue #3.

Owner creates or retrieves a DeepSeek Platform API key and stores it locally only when the executor requests runtime verification.

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
6. Runtime log records token usage and cache hit/miss fields.
7. Repeat similar requests -> provider-reported cache-hit values are recorded when returned.
8. YouTube playback still works.
```

Manual checks without DeepSeek key:

```text
1. Translation falls back locally.
2. Sense block falls back to current rule-based generator.
3. UI shows local fallback note.
4. App remains usable.
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
