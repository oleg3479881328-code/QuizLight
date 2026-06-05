# QuizLight v0 Design Architecture

- Date: `2026-06-05`
- Task source: GitHub issue `#4` and PR `#5` required changes
- Scope type: design architecture only
- Build target: React + TypeScript web implementation
- Current product baseline: manual bilingual cards plus YouTube transcript-driven context cards

## Product Design Objective

Design a frontend-ready `QuizLight v0` surface that feels faster, calmer, and easier to use than feature-heavy study tools while matching the actual implemented product surface.

The design must optimize for two tightly connected outcomes:

`manual card creation/editing`

and

`YouTube transcript -> phrase selection -> context-card creation`

The page should help a user feel that:

- adding a simple Russian-English card is immediate;
- transcript-assisted context capture is available without turning the app into a complex editor;
- the current card is always visible and understandable;
- saved cards, context scenes, and preview behavior all belong to one coherent workspace;
- DeepSeek-backed translation and sense-block help remain supportive, not dominant.

## Primary User Scenarios

Primary user:

- a self-directed learner capturing Russian-English vocabulary, phrases, and short contextual scenes;
- working alone;
- often using a laptop first, but still needing the layout to make sense on mobile.

Scenario A: manual card flow

1. the user opens the app;
2. the user types a Russian phrase and its English equivalent;
3. the user optionally uses a helper translation or dictionary lookup;
4. the user saves the card;
5. the user sees it immediately in focused preview and collection context;
6. the user later edits the same card without losing orientation.

Scenario B: YouTube context-card flow

1. the user pastes a YouTube URL;
2. the user loads the transcript;
3. the user clicks a transcript phrase or searches for a phrase match;
4. the app fills the English side, proposes Russian translation, generates context lines, scene timestamps, and a sense block;
5. the user reviews or adjusts scene/context fields;
6. the user saves a card that later replays the scene and shows transcript context from the selected card view.

## Page / Screen Structure

Single-screen app shell for `v0`.

Top-to-bottom structure:

1. Hero / orientation band
   - product name
   - one-sentence explanation of current MVP
   - compact status tiles such as mode and storage
2. Main workspace
   - left: card editor with manual and context-card inputs
   - right: focused card preview for the current draft or selected card
3. Card collection section
   - saved cards grid/list
   - selection state
   - edit and delete actions
4. Secondary utilities inside the single screen
   - transcript/context scene section inside the editor
   - dictionary lookup section below the main workspace
   - selected-card context scene display inside the preview area when the card contains scene metadata

Structural rule:

- the app remains one screen with no route changes for `v0`;
- manual card creation stays the default and clearest path;
- YouTube transcript tooling is integrated as an expandable advanced block inside the same editor, not as a separate product mode;
- focused preview and collection remain visible anchors even when the user is creating a context card.

## Product Surface Map

The current design surface must clearly account for:

1. manual bilingual card form
2. dynamic translation provider indicator
3. focused two-sided preview with speech
4. saved card collection
5. transcript loading from YouTube URL
6. clickable transcript phrase list with timestamps
7. phrase matching flow for manual English text against transcript
8. context editor for scene timestamps, previous/target/next lines, and sense block
9. selected-card scene playback with context transcript display
10. dictionary lookup with POS-tagged translation alternatives

## Low-Fidelity Wireframe Description

Desktop wireframe:

```text
+----------------------------------------------------------------------------+
| Hero / Orientation                                                         |
| QuizLight      "Fast bilingual cards and lightweight context capture"      |
| [Cards count] [Web MVP] [Local storage]                                    |
+----------------------------------------------------------------------------+

+--------------------------------------+-------------------------------------+
| Card Editor                          | Focused Preview                     |
| New / Edit Card                      | Current Card                        |
| Russian field                        | [Two-sided card, click to flip]     |
| English field                        | [Speech for active side]            |
| Provider / fallback note             |                                     |
| Manual save / cancel                 | If selected card has scene:         |
|                                      | [YouTube scene player]              |
| [details] Context Scene              | [context transcript]                |
| YouTube URL + load transcript        | [sense block summary]               |
| Clickable transcript list            |                                     |
| Match candidates if needed           |                                     |
| Context editor: scene timestamps     |                                     |
| previous / target / next lines       |                                     |
| sense block fields                   |                                     |
+--------------------------------------+-------------------------------------+

+----------------------------------------------------------------------------+
| Collection                                                                 |
| [card item] [card item] [card item] ...                                    |
| each item shows RU + EN summary, scene/context hint, edit, delete          |
+----------------------------------------------------------------------------+

+----------------------------------------------------------------------------+
| Dictionary Lookup                                                          |
| input + lookup action + structured alternatives                            |
+----------------------------------------------------------------------------+
```

Mobile wireframe:

```text
+--------------------------------------+
| Hero / Orientation                   |
+--------------------------------------+
| Card Editor                          |
| Russian field                        |
| English field                        |
| provider note                        |
| save / cancel                        |
| [details] Context Scene              |
| YouTube URL                          |
| Load transcript                      |
| transcript list                      |
| candidate chips                      |
| context editor                       |
+--------------------------------------+
| Focused Preview                      |
| flip + speech                        |
| selected-card scene block if present |
+--------------------------------------+
| Collection                           |
| stacked cards                        |
+--------------------------------------+
| Dictionary Lookup                    |
+--------------------------------------+
```

Wireframe rules:

- transcript/context tooling must visually read as an expansion of card creation, not as a separate app;
- manual fields stay above transcript/context controls;
- focused preview should remain readable even when scene-related content exists;
- dictionary lookup stays secondary and collapsible-feeling, not a dominant column;
- mobile order should preserve the real task flow: enter/edit card first, then preview, then browse saved cards.

## UI System Direction

Design character:

- light, open, minimal productivity surface;
- more like a calm study notebook than a gamified learning suite;
- confident enough to handle video context, but still intentionally narrow.

Visual direction:

- bright background with soft atmospheric gradients;
- white or near-white working surfaces;
- one strong blue accent for action, selection, and active transcript state;
- dark neutral text for reading confidence;
- transcript, scene, and dictionary utilities should use quieter sub-panel styling than the main editor shell.

Typography direction:

- expressive display serif or serif-like heading for product personality;
- practical sans-serif for controls, transcript entries, and card content;
- context metadata should use a smaller supporting scale, never compete with the main bilingual content.

Interaction direction:

- manual card creation should feel stable and fast;
- transcript phrase clicks should feel direct and deterministic;
- the focused card should feel tangible through flip behavior;
- transcript selection, candidate choice, and scene playback should feel like assistive precision tools;
- DeepSeek-backed labels or fallback notes should be informative but visually subordinate.

## Component Inventory

Required components for the actual `v0` surface:

1. App hero band
   - title
   - short product explanation
   - compact stat tiles
2. Card editor panel
   - mode heading: new vs edit
   - Russian textarea
   - English textarea
   - provider indicator / fallback note
   - primary submit button
   - cancel action in edit mode
3. Manual helper layer
   - local suggestion chips when applicable
   - translation action buttons
4. Context scene section
   - expandable details/summary shell
   - YouTube URL input
   - transcript load action
   - transcript error state
   - clickable transcript list
   - match candidate chips
   - context editor fields
5. Focused card preview
   - front side
   - back side
   - flip interaction
   - per-side speech trigger
6. YouTube scene player
   - embedded player area
   - replay/recovery controls
   - scene/phrase timeline
7. Context transcript display
   - previous lines
   - target line
   - next lines
   - sense block summary
8. Card collection
   - saved card grid/list
   - selected state
   - edit and delete actions
   - optional context marker for cards with scene data
9. Dictionary lookup section
   - input row
   - loading / error states
   - structured translation rows
   - apply buttons for translation choices
10. Empty states
   - empty preview
   - empty collection
   - transcript not loaded state

Component rules:

- transcript/context components should be grouped visually under the editor, not scattered;
- focused preview should prioritize the bilingual card first and the context scene second;
- scene/context display should appear only when the selected card has that data;
- provider/fallback-note UI must remain coupled to the accepted translation state;
- dictionary lookup should support word refinement without hijacking the main flow.

## Responsive Behavior Rules

Desktop:

- main workspace uses two columns;
- editor should be slightly dominant because it now contains both manual and context-card tooling;
- focused preview column should stack card preview and selected-card context scene comfortably;
- collection may use a responsive multi-column grid.

Tablet:

- workspace may remain two columns if width allows;
- if transcript or preview becomes cramped, collapse to one column with editor first;
- transcript list and context editor should remain within the editor block, not break into floating layouts.

Mobile:

- stack hero, editor, preview, collection, then dictionary;
- keep context scene tools nested under the editor as an expandable section;
- transcript entries should remain large enough to tap accurately;
- collection items should stack vertically;
- preview card and replay controls must remain comfortably tappable.

Responsive constraints:

- no horizontal scrolling for transcript, editor, or collection;
- timestamp and transcript text must wrap safely on narrow screens;
- context editor should collapse by vertical stacking, not by shrinking labels to ambiguity;
- preview interaction must remain obvious without hover;
- utility sections should compress before core card content does.

## Accessibility-Sensitive Notes

- all buttons need clear text or `aria-label`, especially speech, transcript selection, and replay controls;
- transcript entry state must be communicated by more than color alone;
- flip interaction should not rely on animation alone to communicate side change;
- focus states must remain visible on fields, transcript rows, chips, and action buttons;
- textarea labels should remain persistent and not be replaced by placeholder-only meaning;
- scene playback controls should fail gracefully when YouTube playback errors occur;
- motion for flip transitions and timeline activity should remain short and should respect reduced-motion adaptation if added later.

## Frontend Handoff Notes For React / TypeScript

Page architecture:

- keep the screen as a single routed surface for `v0`;
- treat the editor as one feature area with layered capability: manual card first, transcript/context second;
- `App` should remain a composition root, but transcript/context and preview-related sections should be good candidates for extraction as the implementation stabilizes.

Suggested component boundaries against the current app:

- `HeroSummary`
- `CardEditor`
- `TranslationActions`
- `ContextSceneSection`
- `TranscriptClickableList`
- `MatchCandidateChips`
- `ContextMetadataEditor`
- `FocusedCardPreview`
- `SelectedCardContextScene`
- `CardCollection`
- `DictionaryLookupPanel`
- `YouTubeScenePlayer`

Suggested state boundaries:

- card data, selected card, and editing state may remain local initially;
- transcript loading and matching state should stay near the context scene section;
- provider/fallback-note state must remain coupled to accepted translation results;
- scene playback state should stay close to `YouTubeScenePlayer`;
- dictionary lookup state should remain independent from card CRUD so it can stay optional.

Implementation constraints:

- keep current local-first storage behavior;
- do not introduce routing, auth, backend CRUD, classroom features, or quiz flows in this pass;
- preserve the existing YouTube transcript / scene context flow;
- preserve DeepSeek-backed translation and sense-block behavior as assistive layers, not primary product modes;
- keep this handoff compatible with standard React state and CSS, not heavy abstractions.

## Design Review Checklist Result

Review basis:

- issue `#4`
- PR `#5` required changes
- `PROJECT.md`
- `PROJECT_STATE.md`
- current implemented repository surface in `src/App.tsx`, `src/components/YouTubeScenePlayer.tsx`, and translation/context helpers

### Goal Fit

- Pass
- The architecture now matches both real `v0` jobs: simple card handling and transcript-assisted context-card creation.

### User Path

- Pass
- Manual and context-card flows coexist in one clear path, with manual creation staying primary and transcript tools remaining nested support.

### Structure And Wireframe

- Pass
- Desktop and mobile wireframes now represent manual cards, focused preview, collection, transcript, scene selection, context-card creation, and dictionary support together.

### UI System

- Pass with caution note
- The system direction is coherent and buildable.
- Caution: transcript and dictionary helpers must remain visually secondary so the interface does not drift into tool clutter.

### Component Coverage

- Pass
- The component inventory now reflects transcript/context/scene-related components and the current selected-card playback surface.

### React / TypeScript Handoff

- Pass
- The handoff notes now align with the actual current React + TypeScript feature surface without widening MVP scope.

### Scope Discipline

- Pass
- No new product mode is introduced; the design only catches up to implemented YouTube/DeepSeek-assisted behavior already present in the app.

Overall recommendation:

- `pass`

Meaning:

- the design handoff now reflects the actual current QuizLight surface closely enough for frontend continuation;
- the main caution is visual hierarchy, not missing architecture.

## Open Questions

No blocking design questions remain for this handoff.

Non-blocking follow-up questions for later:

- should dictionary lookup remain in the main surface long-term or eventually move into a lighter utility pattern;
- should transcript search become first-class if context-card usage becomes a dominant behavior;
- should manual translation helpers remain chip-based, action-based, or become more explicitly separated from true provider-backed results.

## Final Architecture Summary

`QuizLight v0` is no longer just a manual bilingual card form.

It is now a focused bilingual card workspace with a built-in, bounded context-card path:

- one screen;
- one local-first editor;
- one focused two-sided preview;
- one supporting collection;
- one expandable transcript/context creation flow;
- one selected-card scene playback surface;
- one restrained set of DeepSeek-backed and local assistance tools.

The frontend handoff should preserve that exact balance: richer than plain card CRUD, but still far simpler than a full study suite.
