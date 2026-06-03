# Project

- Project name: `QuizLight`
- Short description:
  - English: lightweight learning platform starting with bilingual vocabulary cards in a fast web interface.
  - Russian: легкая учебная платформа, которая стартует с двуязычных словарных карточек в быстром веб-интерфейсе.
- Project type: product application, not yet technically classified
- Slogan:
  - English: `Learn faster. Remember longer.`
  - Russian: `Учись быстрее. Запоминай надолго.`

# Purpose

- Why it exists:
  - English: help people learn faster and retain knowledge longer with a low-friction study experience.
  - Russian: помочь людям учиться быстрее и запоминать знания надольше через обучение с минимальным трением.
- Who it is for:
  - English: learners who want a fast, simple way to create and edit bilingual study cards.
  - Russian: учащиеся, которым нужен быстрый и простой способ создавать и редактировать двуязычные учебные карточки.
- Success at the current stage:
  - English: define the initial product direction and convert the idea into a concrete first execution path.
  - Russian: определить начальное направление продукта и превратить идею в конкретный первый путь исполнения.

# Source Of Truth

- This repository folder is the current durable project workspace.
- `PROJECT.md` is the project front door for re-entry.
- Project work must follow Project Execution OS via:
  - `https://github.com/oleg3479881328-code/Project-Execution-OS/blob/main/START_HERE.md`

# Current Status

- Current mode: new project bootstrap completed
- Current phase: repository scaffold completed, ready for first functional slice
- Current health: clear concept, initial MVP direction, and initial stack are confirmed

# Done So Far

- Created the project repository folder with local Git already present.
- Confirmed the project name, bilingual description, and bilingual slogan.
- Initialized the project front door artifacts: `AGENTS.md` and `PROJECT.md`.
- Completed an initial Existing Solution First pass for adjacent products.
- Added transfer-ready continuity artifacts: `PROJECT_STATE.md` and `logs/latest.md`.
- Scaffolded the repository with `Vite + React + TypeScript`.
- Installed dependencies and verified baseline `build` and `lint`.

# Current Focus

- Preserve the core product intent without inventing architecture too early.
- Keep the first version intentionally smaller than broad study suites.

# Existing Solution First Snapshot

- Date: `2026-06-02`
- Confirmed adjacent solution patterns checked:
  - `Quizlet`: flashcards, practice tests, and study activities around interactive learning.
  - `Anki`: active recall plus spaced repetition with a stronger power-user learning curve.
  - `RemNote`: flashcards plus notes, AI generation, and richer knowledge workflows.
  - `Brainscape`: spaced repetition, progress statistics, and habit-building around flashcards.
- Reusable donor patterns worth keeping in mind:
  - fast card creation
  - mixed review modes
  - adaptive repetition
  - lightweight progress feedback
- Gaps worth targeting for `QuizLight`:
  - lower friction than power-user systems
  - more focused and lighter than all-in-one study suites
  - a cleaner first-run experience centered on quick study loops

# GitHub Donor Check

- Date: `2026-06-02`
- Repositories checked:
  - `tnm/hsk`
  - `kebin20/english-flashcards-app`
  - `openmultiplechoice/openmultiplechoice`
  - `cardflash/cardflash-monorepo`
- Best-fit donor pattern:
  - English: `tnm/hsk` is the closest reference for a minimal, responsive vocabulary flashcard web experience.
  - Russian: `tnm/hsk` — самый близкий референс для минимального и адаптивного веб-опыта со словарными карточками.
- Reuse conclusion:
  - English: borrow UX and structural ideas only, not repository architecture.
  - Russian: брать стоит только UX-паттерны и структурные идеи, но не архитектуру репозиториев целиком.
- Why not reuse directly:
  - English: the checked projects are broader, heavier, or tied to extra features such as Firebase, MCQ systems, PDFs, or study flows beyond the current MVP boundary.
  - Russian: проверенные проекты шире, тяжелее или завязаны на дополнительные функции вроде Firebase, MCQ-систем, PDF-потоков или учебных сценариев за пределами текущей границы MVP.

# Initial MVP Direction

- Product position:
  - English: a lightweight study tool for individuals who want to create and manage Russian-English cards without complexity overload.
  - Russian: легкий учебный инструмент для одного пользователя, который хочет создавать и вести русско-английские карточки без перегруза сложностью.
- Primary user:
  - English: self-directed learner preparing for exams, vocabulary, or concept retention.
  - Russian: самостоятельный учащийся, который готовится к экзаменам, учит лексику или закрепляет понятия.
- MVP promise:
  - English: add a card in seconds, see both language sides clearly, and edit the card when needed.
  - Russian: добавить карточку за секунды, ясно видеть обе языковые стороны и редактировать карточку при необходимости.
- MVP in scope:
  - web application only
  - manual card creation
  - card list and focused card preview
  - editing an existing card
  - deleting a card
  - local persistence
- Explicitly out of scope for MVP:
  - quiz mode
  - spaced repetition logic
  - classroom collaboration
  - social or marketplace deck discovery
  - advanced note-taking knowledge graph behavior
  - heavy AI generation workflows
  - complex gamification
  - broad content platform features

# First Execution Target

- Define `QuizLight v0` as:
  - English: a single-user web app for Russian-English cards with creation, viewing, editing, and local saving.
  - Russian: однопользовательское веб-приложение для русско-английских карточек с созданием, просмотром, редактированием и локальным сохранением.
- Success criteria for the first build:
  - a new user can create a card without onboarding friction
  - the Russian and English sides are both clearly visible
  - an existing card can be edited in place
  - data remains after page refresh
  - the product feels faster and simpler than feature-heavy alternatives

# Execution Framing

- Initial platform decision:
  - English: web-first MVP.
  - Russian: MVP сначала как веб-приложение.
- Why this platform first:
  - English: fastest path to validate the study loop, lowest friction for testing, and easiest iteration surface before mobile packaging or deeper platform specialization.
  - Russian: самый быстрый путь проверить учебный цикл, с наименьшим трением для тестирования и с самой простой поверхностью для итераций до мобильной упаковки или более глубокой платформенной специализации.
- Deferred platform decisions:
  - native mobile apps
  - browser extension form
  - offline-first packaging
  - multiplayer or classroom delivery

# Minimal User Flow

- Flow name:
  - English: create -> view -> edit.
  - Russian: создать -> посмотреть -> отредактировать.
- Step 1:
  - English: user creates a card with Russian text and English text.
  - Russian: пользователь создаёт карточку с русским текстом и английским текстом.
- Step 2:
  - English: user sees the saved card in the collection and in the focused preview.
  - Russian: пользователь видит сохранённую карточку в коллекции и в основном просмотре.
- Step 3:
  - English: user edits the card later without losing local data.
  - Russian: пользователь позже редактирует карточку без потери локальных данных.

# MVP Functional Shape

- Core objects:
  - English: card.
  - Russian: карточка.
- Minimum actions:
  - create card
  - edit card
  - delete card
  - view selected card

# Technical Direction Boundary

- Confirmed now:
  - web-first delivery
  - single-user MVP
  - manual content creation first
  - Russian-English card model
- Not confirmed yet:
  - authentication model
  - later study flow beyond card CRUD

# Initial Technical Stack

- Stack decision:
  - English: `Vite + React + TypeScript` frontend with local-first persistence.
  - Russian: фронтенд на `Vite + React + TypeScript` с локальным хранением данных.
- Persistence decision:
  - English: start with browser `localStorage` for decks, cards, and lightweight review state.
  - Russian: начать с браузерного `localStorage` для наборов, карточек и лёгкого состояния повторения.
- Backend decision:
  - English: no backend in `v0` unless the first vertical slice proves that local-only constraints block the MVP.
  - Russian: без backend в `v0`, если только первый вертикальный срез не покажет, что локальные ограничения блокируют MVP.
- Why this stack:
  - English: it is the lightest path to a fast web MVP, keeps setup and iteration cost low, and matches the currently confirmed single-user scope.
  - Russian: это самый лёгкий путь к быстрому веб-MVP, он держит низкой цену настройки и итераций и соответствует уже подтверждённому однопользовательскому сценарию.
- Existing solution alignment:
  - English: React documentation points new projects toward frameworks, and explicitly points build-tool setups to options like Vite when building a React app from scratch.
  - Russian: документация React направляет новые проекты к framework-подходу и отдельно указывает на варианты вроде Vite, когда React-приложение собирается с нуля через build tool.
  - English: Vite officially provides a `react-ts` template and emphasizes fast development startup, HMR, and optimized production builds.
  - Russian: Vite официально предоставляет шаблон `react-ts` и делает акцент на быстром старте разработки, HMR и оптимизированной production-сборке.

# First Buildable Vertical Slice

- Slice name:
  - English: `Card Creation and Editing`.
  - Russian: `Создание и редактирование карточек`.
- Included in the first slice:
  - home screen with card collection
  - create card form
  - add/edit/delete Russian-English cards
  - focused card preview
  - save progress locally
- Excluded from the first slice:
  - quiz mode
  - cross-device sync
  - auth
  - advanced scheduling
  - import/export
- Vertical-slice success:
  - English: a user can open the app, create a card, edit a saved card, refresh the page, and keep local card data.
  - Russian: пользователь может открыть приложение, создать карточку, отредактировать сохранённую карточку, обновить страницу и сохранить локальные данные карточек.

# Next Practical Step

- Move from product framing into execution framing:
  - implement the `Card Creation and Editing` vertical slice
  - verify local persistence and editing flow
  - expose the app through the local web interface

# Key Decisions And Constraints

- This project operates under Project Execution OS.
- `PROJECT.md` is the canonical local entrypoint for this repository project.
- Purpose, MVP direction, initial stack, and first technical slice are defined, but deeper architecture and later storage layers are not yet confirmed.
- No unnecessary project files should be added before real work requires them.
- Existing Solution First is mandatory before custom architecture or implementation:
  - `https://github.com/oleg3479881328-code/Project-Execution-OS/blob/main/docs/EXISTING_SOLUTION_FIRST_STANDARD.md`

# Read Next

- `AGENTS.md`
- `PROJECT_STATE.md`
- `logs/latest.md`
- Project Execution OS entrypoint:
  - `https://github.com/oleg3479881328-code/Project-Execution-OS/blob/main/START_HERE.md`
- The first product feature is the web card interface for creating and editing Russian-English cards.
