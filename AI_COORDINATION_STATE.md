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

GitHub Issue #8:
https://github.com/oleg3479881328-code/QuizLight/issues/8

## Previous Channels

- GitHub Issue #1 — archived for new messages because the thread became too long for reliable connector reading.
- GitHub Issue #2 — Azure Translator review channel; retained as completed technical history for the deferred Azure layer.
- GitHub Issue #3 — completed channel for DeepSeek API integration and bounded reviewer coordination.
- GitHub Issue #8 — active channel for the text-learning projects, folders, sets, and library MVP workstream.

## Active Participants

- Owner: Oleg Povalyukhin
- Reviewer and Architect: ChatGPT
- Executor Agent: Cline (Codex Agent)

The executor role is model-neutral. A future executor may be Codex, DeepSeek, Claude, another connected AI agent, automation, or a human developer.

## Current Task

Implement the bounded text-learning projects, folders, sets, and library MVP from Issue #8.

## Current Repository State

Accepted implementation baseline for the active workstream:

`f96bcbb4d223da8bc6f95317205c62e3f34dad29` — accepted post-PR #7 base named by ChatGPT in Issue #8 activation

Current executor branch:

`codex/issue-8-text-learning-library-mvp`

Working tree status:

`IN_PROGRESS` — Issue #8 activated; coordination files updated and implementation branch opened

Current coordination status:

`ACTIVE_IMPLEMENTATION — Issue #8 is the active bounded execution channel`


## Accepted Decisions Carried Forward

- DeepSeek is the single active AI provider for this phase.
- Azure code is preserved but not configured or called by default.
- Server-side secret: `DEEPSEEK_API_KEY` (not exposed via `VITE_`).
- Model: `deepseek-v4-flash` (thinking disabled, temperature 0.3).
- Provider policy: DeepSeek API → local fallback.
- Existing YouTube transcript, scene playback, speech, dictionary lookup, and quiz behavior must be preserved while expanding the local-first workspace model.
- Bounded execution remains in force — no auth, cloud sync, billing, marketplace, classroom features, or unrelated product expansion.

## Active Scope (Issue #8)

- migration-safe local-first workspace model with folders, learning projects, materials, sets, Inbox, and source-linked cards
- home screen prioritizing continue-work and quick entry points
- library surface with tabs for projects, folders, sets, and all cards
- project creation from YouTube, pasted text, and TXT upload
- text material reading and selection flow into reviewed draft cards
- required desktop drag-and-drop convenience paths
- backward-compatible loading of existing stored cards
- preservation of DeepSeek / local fallback translation and sense-block behavior

## Implementation Summary

Current Issue #8 implementation has been activated but not yet committed. The immediate required bookkeeping steps are complete:

1. active AI-to-AI channel moved to Issue #8
2. accepted base commit recorded from the ChatGPT activation notice
3. executor branch created for the new workstream
4. next implementation focus set to the migration-safe workspace model

### Validation

- activation / coordination checks only so far
- implementation validation pending after the first bounded code pass

## Open Review Items

- no blocking review items on the completed DeepSeek task
- active review will occur through Issue #8 for the new workstream

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
npm run lint
npm run build
```

Manual checks for Issue #8 include at minimum:

```text
1. legacy card data loads
2. quick card -> Inbox
3. YouTube project creation -> default set -> transcript card save
4. text project creation from paste -> selection -> reviewed save
5. TXT upload -> material open -> selection -> reviewed save
6. nested folder creation and breadcrumbs
7. card -> set multi-membership without duplicate card records
8. YouTube transcript, DeepSeek fallback, dictionary, speech, and quiz regression checks
```

## Communication Protocol

This project follows the Project Execution OS communication-channel protocol:

1. **Entry**: `blocks/communication-channel/BLOCK.md` — `Канал связи`
2. **Channel selection**: `docs/AI_COORDINATION_HUB_STANDARD.md` — GitHub selected as active channel
3. **GitHub protocol**: `docs/integrations/chatgpt/CODEX_GITHUB_PROTOCOL.md` → `docs/CHATGPT_CODEX_GITHUB_PROTOCOL.md`

All durable AI-to-AI messages go through the active GitHub channel (Issue #8).
Executor posts structured Execution Reports as comments in the named reply surface.
ChatGPT reads and reviews through GitHub.
The user is not the normal relay for AI-to-AI coordination.

## Next Step

Post the signed acknowledgement in Issue #8, then implement the migration-safe local workspace model and first text-learning/library slice without regressing the current YouTube and DeepSeek flows.


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
