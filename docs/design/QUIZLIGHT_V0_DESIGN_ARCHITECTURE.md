# QuizLight v0 Design Architecture

- Date: `2026-06-05`
- Task source: GitHub issue `#4`
- Scope type: design architecture only
- Build target: React + TypeScript web implementation

## Product Design Objective

Design a frontend-ready `QuizLight v0` surface that feels faster, calmer, and easier to use than feature-heavy study tools while staying inside the current MVP boundary.

The design must optimize for one narrow outcome:

`create card -> view saved card -> edit card`

The page should help a user feel that:

- adding a bilingual card is immediate;
- the current card is always visible and understandable;
- editing does not feel like mode-switching into a more complex app;
- the interface stays clean even when the card list grows.

## Primary User Scenario

Primary user:

- a self-directed learner capturing Russian-English vocabulary or short phrases;
- working alone;
- often using a laptop first, but the layout must still make sense on mobile.

Primary scenario:

1. the user opens the app;
2. the user types a Russian phrase and its English equivalent;
3. the user saves the card;
4. the user immediately sees the saved card in focused preview and collection context;
5. the user later selects the card and edits one side without losing confidence in where they are.

Secondary scenario:

1. the user selects an existing card from the collection;
2. the user flips it to inspect the reverse side;
3. the user optionally uses speech playback to hear pronunciation;
4. the user edits the card from the collection flow.

## Page / Screen Structure

Single-screen app shell for `v0`.

Top-to-bottom structure:

1. Hero / orientation band
   - product name
   - one-sentence explanation of the current MVP
   - compact status stats such as mode and storage
2. Main workspace
   - left: card editor
   - right: focused card preview
3. Card collection section
   - list or grid of saved cards
   - selection state
   - edit and delete actions

Structural rule:

- the core workflow must remain visible without routing;
- the editor and focused preview should feel like the primary surface;
- the collection should support the workflow, not dominate it.

## Low-Fidelity Wireframe Description

Desktop wireframe:

```text
+---------------------------------------------------------------+
| Hero / Orientation                                            |
| QuizLight        "Fast bilingual cards for simple study"      |
| [Cards count] [Web MVP] [Local storage]                       |
+---------------------------------------------------------------+

+-------------------------------+-------------------------------+
| Editor                        | Focused Card Preview          |
| New / Edit Card               | Current Card                  |
|                               |                               |
| Russian field                 | [Front side: Russian]         |
| Suggestions block (dynamic)   | click to flip                |
| English field                 | [Back side: English]         |
| Save button                   | speech button for active side |
+-------------------------------+-------------------------------+

+---------------------------------------------------------------+
| Collection                                                    |
| [Card item] [Card item] [Card item] ...                       |
| each item shows RU + EN summary, select, edit, delete         |
+---------------------------------------------------------------+
```

Mobile wireframe:

```text
+-----------------------------+
| Hero / Orientation          |
+-----------------------------+
| Editor                      |
| Russian field               |
| Dynamic suggestions block   |
| English field               |
| Save button                 |
+-----------------------------+
| Focused Card Preview        |
| flip + speech               |
+-----------------------------+
| Collection                  |
| stacked cards               |
+-----------------------------+
```

Wireframe rules:

- only one dynamic suggestions block should appear between the two text fields;
- the preview card should not contain extra meta clutter by default;
- actions inside the collection should stay obvious and compact;
- the mobile stack should preserve the same order as the main user path.

## UI System Direction

Design character:

- light, open, minimal productivity surface;
- friendly but not playful;
- more like a focused note tool than a gamified learning product.

Visual direction:

- bright background with soft atmospheric gradients;
- white or near-white working surfaces;
- one strong blue accent for action and active state;
- dark neutral text for reading confidence;
- restrained borders and soft shadow depth.

Typography direction:

- expressive display serif or serif-like heading for product personality;
- practical sans-serif for controls, labels, and content;
- headings should create identity, but form UI should stay extremely legible.

Interaction direction:

- the editor should feel stable and quiet;
- the focused card should feel tangible through flip behavior;
- motion should be limited to meaningful transitions only;
- audible actions should feel secondary and supportive, not ornamental.

## Component Inventory

Required components for `v0`:

1. App hero band
   - title
   - short product explanation
   - compact stat tiles
2. Card editor panel
   - mode heading: new vs edit
   - Russian textarea
   - dynamic suggestions block
   - English textarea
   - primary submit button
   - cancel action in edit mode
3. Suggestion chips block
   - single block between the two fields
   - label changes by direction
   - chip tap/click fills opposite field
4. Focused card preview
   - front side
   - back side
   - flip interaction
   - per-side speech trigger
5. Card collection item
   - RU summary
   - EN summary
   - selected state
   - edit button
   - delete button
6. Empty states
   - empty preview
   - empty collection

Component rules:

- no nested heavy cards inside already-carded panels unless functionally necessary;
- use shared action styles across primary, neutral, and destructive actions;
- keep speech controls visually subordinate to the card text;
- suggestion chips must not overtake the form visually.

## Responsive Behavior Rules

Desktop:

- main workspace uses two columns;
- editor and focused preview should feel balanced, with editor slightly dominant;
- collection may use a responsive multi-column grid.

Tablet:

- workspace may remain two columns if width allows;
- if the card preview becomes cramped, collapse to one column;
- keep collection readable with two columns where possible.

Mobile:

- stack hero, editor, preview, then collection;
- maintain suggestions block between fields;
- buttons may expand full width when helpful;
- collection items should stack vertically;
- preview card must remain large enough to feel tappable as a flip surface.

Responsive constraints:

- no horizontal scrolling for editor or collection;
- no suggestion chips overflowing off-screen;
- preview interaction must remain obvious without hover;
- action density must reduce on small screens before text size does.

## Accessibility-Sensitive Notes

- all buttons need clear text or `aria-label`, especially speech controls;
- flip interaction should not rely on animation alone to communicate state;
- focus states must remain visible on fields, chips, and action buttons;
- color must not be the only indicator of selected or active state;
- textarea labels should remain persistent and not be replaced by placeholder-only meaning;
- speech controls should fail gracefully if browser speech synthesis is unavailable;
- motion for flip transitions should remain short and should respect reduced-motion adaptation if added in implementation.

## Frontend Handoff Notes For React / TypeScript

Page architecture:

- keep the screen as a single routed surface for `v0`;
- split by feature responsibility, not by arbitrary visual regions;
- `App` should compose feature blocks rather than carry every interaction forever.

Suggested component boundaries:

- `HeroSummary`
- `CardEditor`
- `SuggestionChips`
- `FocusedCardPreview`
- `CardCollection`
- `CardCollectionItem`

Suggested state boundaries:

- card data and selected/editing state may stay local initially;
- speech state should stay close to focused preview, not globalized unnecessarily;
- suggestion logic should be isolated from view layout so it can later be removed or replaced with a real translation service.

Implementation constraints:

- keep current local-first storage behavior;
- do not introduce routing, auth, backend, or quiz logic in this pass;
- if translation suggestions remain, keep them visually subordinate and easy to remove;
- preserve buildability with ordinary React state and CSS, not exotic UI abstractions.

## Design Review Checklist Result

Review basis:

- product goal from issue `#4`
- current MVP scope in `PROJECT.md`
- current implemented prototype behavior observed in repository state

### Goal Fit

- Pass with revision note
- The current structure matches the main user task well.
- Revision needed: translation suggestions should not distract from simple card entry.

### User Path

- Pass with revision note
- The intended order `create -> view -> edit` is structurally clear.
- Revision needed: editor guidance should not create ambiguity about which side is driving the suggestion system.

### Structure And Wireframe

- Pass
- Single-screen structure is appropriate for `v0`.
- Editor, preview, and collection are enough for the scope.

### UI System

- Pass with revision note
- The system direction is coherent and buildable.
- Revision needed: keep support controls like speech and suggestions visually secondary to core card content.

### Responsive Behavior

- Pass with revision note
- The stacked mobile order is correct.
- Revision needed: chip density and editor height should be watched closely on narrow screens.

### Buildability

- Pass
- Everything in this package is implementable with standard React + TypeScript and ordinary CSS.

Overall recommendation:

- `pass with targeted revisions`

Meaning:

- the architecture is valid for implementation;
- the only meaningful caution area is suggestion UX density and clarity.

## Open Questions

None currently block implementation of this design architecture.

Non-blocking question to resolve later:

- should the suggestion system remain a lightweight helper, be removed entirely, or be replaced by a real translation service after MVP validation?

## Final Architecture Summary

`QuizLight v0` should behave like a focused bilingual card workspace, not like a mini learning suite.

The architecture therefore prioritizes:

- one screen;
- one primary job;
- one visible editor;
- one tangible focused card;
- one supporting collection;
- one restrained design system that frontend can build without interpretation drift.
