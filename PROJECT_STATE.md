# Project State

- Project: `QuizLight`
- State date: `2026-06-03`
- Last update: `2026-06-03` (добавлен project-specific backlog внешних идей для будущего развития)
- State type: transfer-ready
- Lifecycle position:
  - bootstrap completed
  - initial product framing completed
  - initial MVP framing completed
  - initial stack decision completed
  - repository scaffold completed
  - first functional MVP implemented

# What Is Confirmed

- `QuizLight` is a lightweight learning product centered on flashcards, quizzes, and review.
- The current MVP direction is single-user and web-first.
- The initial technical stack is `Vite + React + TypeScript` with local-first browser persistence.
- The current first feature is a Russian-English card web interface with create, view, edit, and delete behavior.
- The focused card preview is two-sided and flips between Russian and English.
- The focused card preview includes browser-based speech playback for both language sides.
- The form includes local suggestion helpers in both directions, but their UX and quality are still unsettled.
- A GitHub donor check was completed; donor patterns are informative, but direct reuse is not justified for the current MVP scope.
- The MVP should stay intentionally simpler than broader study suites.
- **YouTube transcript integration is complete:**
  - Click "Загрузить транскрипт" → fetches transcript via `youtube-transcript` npm package (browser) with fallback to Vite dev proxy (`/api/youtube-transcript`)
  - Transcript appears as a clickable list with timestamps
  - Click any phrase → fills English field, auto-suggests Russian translation from local bank, generates context window + sense block, sets scene timestamps
  - Saved cards with YouTube data show YouTube Scene Player (IFrame API) with trimmed scene, timeline visualization, and context transcript + sense block display
  - Vite dev proxy in `vite.config.ts` handles server-side transcript fetching for CORS bypass
- **YouTube Scene Player:**
  - Uses YouTube IFrame API with `cueVideoById()` + `seekTo()` + `playVideo()` for scene playback
  - On error (Error 5 — HTML5 player error), player is destroyed and recreated via `playerKey` state
  - Error 5 is a known YouTube IFrame API issue — occurs on some videos/browsers when calling `loadVideoById()` or `cueVideoById()` repeatedly
  - Current strategy: recreate the entire player instance on error or on replay attempt
  - Retry button shown on error to manually trigger player recreation
  - Timeline shows Scene and Phrase segments based on video duration

# Future Ideas Backlog

- Project-specific reference ideas are stored in:
  - `docs/REFERENCE_IDEAS_IMPLEMENTATION_BACKLOG.md`
- These ideas are preserved for later prioritization.
- They are not automatically part of the active MVP scope.
- The most relevant lightweight rules to apply now are:
  - Video Learning Context Card
  - Human Approval Gate
  - Source-Linked Card Standard
  - State Bridge Reasoning Pattern
  - Codex Bounded Execution Workflow

# What Is Not Yet Decided

- authentication model
- later study flows beyond card CRUD
- future backend need beyond `v0`
- future card organization beyond a flat collection
- whether translation suggestions should remain local, be removed, or be replaced with a real translation service
- whether to expand the local translation suggestion bank or connect to a translation API

# Current Safe Next Action

- Expand the local translation suggestion bank in `src/lib/suggestions.ts` for better auto-translate coverage
- Improve YouTube Scene Player UX (loading states, error handling, mobile responsiveness)
- Add ability to edit scene timestamps directly in the context editor
- Consider adding a "search transcript" feature to find phrases by text
- **Investigate YouTube Error 5 fix:**
  - Try using `mute()` before `seekTo()` to avoid HTML5 player error
  - Try using a native `<video>` element with YouTube proxy/DASH stream
  - Try destroying and recreating the player on every play (current approach)
  - Consider using YouTube URL with `?start=X&end=Y&autoplay=1` parameters in an iframe directly
  - Consider using `youtube-dl` or similar to get direct video URLs

# Active Files

- [PROJECT.md](C:/Users/oleg3/Documents/QuizLight/PROJECT.md)
- [AGENTS.md](C:/Users/oleg3/Documents/QuizLight/AGENTS.md)
- [PROJECT_STATE.md](C:/Users/oleg3/Documents/QuizLight/PROJECT_STATE.md)
- [logs/latest.md](C:/Users/oleg3/Documents/QuizLight/logs/latest.md)
- `docs/REFERENCE_IDEAS_IMPLEMENTATION_BACKLOG.md`

# Do Not Break

- Keep Project Execution OS as the governing workflow.
- Keep Existing Solution First mandatory before architecture or implementation choices.
- Do not expand scope into collaboration, marketplace, heavy AI, or complex gamification for MVP.
- Do not assume technical decisions that have not been explicitly recorded.
- Keep `v0` local-first unless a concrete blocker justifies adding backend complexity.
- **YouTube transcript integration:** do not remove the Vite dev proxy (`/api/youtube-transcript`) — it's required for CORS-free transcript fetching. Do not remove `parsedTranscript` state or `handleTranscriptLineClick` — they power the clickable transcript UX.
- **YouTube Scene Player:** do not remove `playerKey` state — it enables player recreation on error. Keep the `cueVideoById` + `seekTo` + `playVideo` approach as primary, with `loadVideoById` as fallback.
- Do not treat `docs/REFERENCE_IDEAS_IMPLEMENTATION_BACKLOG.md` as automatic permission to broaden MVP scope.

# Known Issues

1. **YouTube Error 5 (HTML5 player error):** Occurs on some videos/browsers when replaying scenes. Current workaround: destroy and recreate the player instance. This is a known YouTube IFrame API limitation. See "Current Safe Next Action" for investigation directions.
2. **Translation suggestions:** The local bank in `src/lib/suggestions.ts` is small. Auto-fill may produce irrelevant translations for complex phrases.
3. **Transcript loading:** The `youtube-transcript` npm package may fail on some videos (age-restricted, private, or with disabled captions). The Vite dev proxy fallback handles most cases.

# Handoff Packet

`CODEX PACKET LITE`

- Objective:
  - deliver the first usable `QuizLight v0` web surface
  - keep the MVP limited to Russian-English cards and editing
  - YouTube transcript integration is now part of the core card creation flow
- Files Allowed To Change:
  - [PROJECT.md](C:/Users/oleg3/Documents/QuizLight/PROJECT.md)
  - [PROJECT_STATE.md](C:/Users/oleg3/Documents/QuizLight/PROJECT_STATE.md)
  - [logs/latest.md](C:/Users/oleg3/Documents/QuizLight/logs/latest.md)
  - implementation files under [src](C:/Users/oleg3/Documents/QuizLight/src)
- Forbidden Changes:
  - do not broaden MVP scope
  - do not invent collaboration or marketplace features
  - do not rewrite project intent away from simplicity and speed
  - do not remove the Vite dev proxy or the clickable transcript list
  - do not remove `playerKey` state from YouTubeScenePlayer
- Existing Solution Search Required:
  - Yes
- Acceptance Criteria:
  - the running app shows Russian-English cards
  - cards can be created, edited, deleted, and persisted locally
  - the focused card can flip and speak both sides
  - YouTube transcript can be loaded and used to create context scene cards
  - transfer-ready state remains intact after changes
- Validation:
  - project entry files clearly reflect the new decision
  - next executor can continue without chat-only context
- Return:
  - updated entry files plus a concise execution summary