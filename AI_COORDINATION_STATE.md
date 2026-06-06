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

GitHub Issue #10:
https://github.com/oleg3479881328-code/QuizLight/issues/10

## Previous Channels

- GitHub Issue #1 — archived for new messages because the thread became too long for reliable connector reading.
- GitHub Issue #2 — Azure Translator review channel; retained as completed technical history for the deferred Azure layer.
- GitHub Issue #3 — completed channel for DeepSeek API integration and bounded reviewer coordination.
- GitHub Issue #8 — completed channel for text-learning projects, folders, sets, and library MVP workstream.

## Active Participants

- Owner: Oleg Povalyukhin
- Reviewer and Architect: ChatGPT
- Executor Agent: Cline (Codex Agent)

The executor role is model-neutral. A future executor may be Codex, DeepSeek, Claude, another connected AI agent, automation, or a human developer.

## Current Task

Dashboard v1 implemented — AppShell sidebar navigation, DashboardHome, workspace tab separation. Ready for next agent handoff.

## Current Repository State

Accepted implementation baseline for the active workstream:

`f96bcbb4d223da8bc6f95317205c62e3f34dad29` — accepted post-PR #7 base named by ChatGPT in Issue #8 activation

Current working tree status:

`IN_PROGRESS` — Dashboard v1 implemented (Issue #10), workspace tabs separated, build passes with 0 errors

Current coordination status:

`READY_FOR_HANDOFF — Project ready for next agent. Changes not yet pushed.`


## Accepted Decisions Carried Forward

- DeepSeek is the single active AI provider for this phase.
- Azure code is preserved but not configured or called by default.
- Server-side secret: `DEEPSEEK_API_KEY` (not exposed via `VITE_`).
- Model: `deepseek-v4-flash` (thinking disabled, temperature 0.3).
- Provider policy: DeepSeek API → local fallback.
- Existing YouTube transcript, scene playback, speech, dictionary lookup, and quiz behavior must be preserved while expanding the local-first workspace model.
- Bounded execution remains in force — no auth, cloud sync, billing, marketplace, classroom features, or unrelated product expansion.

## Active Scope (Issue #10 — Dashboard v1)

- AppShell sidebar navigation with 5 nav items (Главная, Библиотека, Все карточки, Наборы, Материалы)
- DashboardHome with header, continue-learning block (3 states), quick actions, statistics, recent cards, recent materials
- Workspace tab separation (editor, preview, collection) — each panel in its own tab
- Theme toggle (light/dark) in sidebar, persisted to localStorage
- Responsive layout: desktop sidebar (240px), tablet collapse at ≤900px, mobile hamburger menu at ≤640px
- All existing workspace functionality preserved (card CRUD, YouTube transcript, scene playback, quiz, dictionary, text reader, project creation)

## Implementation Summary

Dashboard v1 implemented in the current working tree:

1. ✅ AppShell.tsx — persistent left sidebar with navigation and theme toggle
2. ✅ DashboardHome.tsx — home screen with derived data (continue block, stats, recent cards/materials)
3. ✅ Workspace tab separation — editor, preview, collection tabs
4. ✅ Build fixes — unused imports/variables removed, 0 errors

### Validation

- `npm run build` — 0 errors (33 modules) ✅
- `npm run lint` — 0 new errors ✅

## Open Review Items

- No blocking review items. Changes not yet pushed to origin/master.

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

All durable AI-to-AI messages go through the active GitHub channel (Issue #10).
Executor posts structured Execution Reports as comments in the named reply surface.
ChatGPT reads and reviews through GitHub.
The user is not the normal relay for AI-to-AI coordination.

## Next Step

Push the current working tree to origin/master, post a Patch Execution Report in Issue #10, and hand off to the next agent for review or continuation.


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
