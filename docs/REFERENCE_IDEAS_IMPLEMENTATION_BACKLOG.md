# QuizLight — Reference Ideas Implementation Backlog

## Purpose

Этот документ хранит идеи из внешних референсов и нашей исследовательской беседы, которые потенциально могут усилить `QuizLight` после текущего MVP.

Это не утвержденный scope текущей версии.

Текущий MVP остается узким: карточки, YouTube transcript integration, context scene cards, local-first persistence, быстрый интерфейс.

## Rule

Новые идеи проходят путь:

`IDEA -> RESEARCH -> CONCLUSION -> DISCUSS -> DECIDE -> RECORD -> PRIORITIZE -> IMPLEMENT`

Нельзя автоматически расширять MVP только потому, что идея выглядит сильной.

## Ideas worth preserving for QuizLight

### 1. Graph Memory Control Layer

#### Idea

Связать карточки, фразы, видео, сцены, контексты, изучаемые слова, ошибки пользователя и повторения в граф.

#### Potential QuizLight use

Граф может показывать:

- какие слова встречаются в разных видео;
- какие фразы связаны по смыслу;
- какие слова пользователь уже видел, но продолжает ошибаться;
- какие карточки являются сиротами без контекста;
- какие темы уже хорошо покрыты;
- какие пробелы требуют новых карточек.

#### MVP status

Not for current MVP.

#### Future trigger

Рассматривать только когда накопится достаточно карточек, видео и пользовательских ошибок, чтобы плоская модель начала мешать.

---

### 2. Opportunity Graph Engine

#### Idea

Граф не просто хранит связи, а предлагает следующую полезную работу.

#### Potential QuizLight use

Система может предлагать:

- создать карточку для часто встречающейся незнакомой фразы;
- повторить слово, которое пользователь несколько раз забыл;
- добавить контекст к карточке без видео-сцены;
- объединить дублирующиеся карточки;
- выделить новый мини-набор слов по одной теме;
- создать упражнение из группы связанных карточек.

#### MVP status

Not for current MVP.

#### Future trigger

Рассматривать после появления реальной пользовательской истории и достаточного объема данных.

---

### 3. Video Learning Context Card

#### Idea

Карточка создается не из изолированной фразы, а из конкретного видео-контекста.

#### Potential QuizLight use

Для каждой карточки хранить:

- исходное видео;
- timestamp начала и конца сцены;
- выбранную фразу;
- предыдущую и следующую реплики;
- перевод;
- sense block — объяснение смысла;
- изображение или preview сцены;
- кнопку воспроизведения нужного фрагмента.

#### Current status

Partially implemented.

YouTube transcript integration и scene playback уже существуют в текущем MVP.

#### Next improvements

- редактирование timestamp;
- поиск по transcript;
- улучшение mobile UX;
- более надежный scene playback;
- более точный sense block;
- мультимедийный preview карточки.

---

### 4. State Bridge Reasoning Pattern

#### Idea

Не генерировать результат из пустоты. Строить контролируемый мост от текущего состояния к целевому.

#### Potential QuizLight use

Для изучения языка:

`current knowledge state -> selected phrase -> context -> explanation -> practice -> review -> stronger memory`

Для создания карточки:

`raw video phrase -> transcript context -> translation -> sense block -> scene boundaries -> saved multimedia card`

Для разработки:

`current bug -> diagnosis -> bounded patch -> validation -> reviewed result`

#### MVP status

Use as design principle now. No heavy implementation required.

---

### 5. Agent Artifact Workspace

#### Idea

ИИ должен выдавать проверяемый артефакт, а не только текст.

#### Potential QuizLight use

При создании карточки ИИ должен формировать inspectable artifact:

- phrase;
- translation;
- context block;
- sense block;
- scene timestamps;
- optional image;
- source link;
- confidence;
- editable fields.

Пользователь должен видеть и редактировать результат до сохранения.

#### MVP status

Useful product direction. Keep implementation lightweight.

---

### 6. Human Approval Gate

#### Idea

Автоматическая генерация не должна сразу становиться принятой карточкой.

#### Potential QuizLight use

Правильная модель:

`AI draft -> user review -> edit if needed -> save card`

Особенно важно для:

- перевода;
- sense block;
- выбора границ сцены;
- изображения;
- автоматических тегов;
- объединения дублей.

#### MVP status

Recommended product rule.

---

### 7. Source-Linked Card Standard

#### Idea

Ссылки и происхождение данных нельзя терять.

#### Potential QuizLight use

Каждая мультимедийная карточка должна хранить:

- source type;
- video URL;
- timestamp;
- transcript excerpt;
- original phrase;
- generated translation;
- generated explanation;
- user edits;
- creation date.

#### MVP status

Recommended. Add fields gradually when they become necessary.

---

### 8. External API Skill Gateway

#### Idea

Внешние API должны подключаться через контролируемый gateway, а не напрямую и хаотично.

#### Potential QuizLight use

Применимо позже для:

- translation API;
- YouTube transcript services;
- image generation;
- TTS;
- cloud sync;
- export to Quizlet or other platforms.

Gateway should support:

- auth check;
- allowed actions;
- preview;
- rate/cost awareness;
- logs;
- readable errors;
- fallback behavior.

#### MVP status

Architecture rule for future integrations. Do not overbuild now.

---

### 9. Codex Bounded Execution Workflow

#### Idea

Codex должен получать узкую задачу и проверяемый результат.

#### Potential QuizLight use

Для каждого технического изменения:

- один bounded objective;
- allowed files;
- forbidden files;
- acceptance criteria;
- test command;
- diff review;
- rollback notes;
- updated project state when necessary.

#### MVP status

Use now for implementation handoffs.

---

### 10. Kanban Agent Orchestration Standard

#### Idea

В будущем задачи могут проходить pipeline:

`backlog -> specification -> approval -> development -> review -> testing -> rollout -> done`

#### Potential QuizLight use

Полезно позже, когда разработка станет параллельной и появятся несколько агентов или исполнителей.

#### MVP status

Not needed now. Preserve only as future workflow option.

---

### 11. Agentic Visual Canvas Workflow

#### Idea

ИИ работает одновременно с визуальным интерфейсом, кодом, layout, состояниями и анимациями.

#### Potential QuizLight use

Особенно полезно для:

- card creation screen;
- transcript picker;
- video scene editor;
- context card preview;
- mobile layout;
- timeline editing;
- visual review of learning cards.

#### MVP status

Useful for UI iteration. Do not build a custom visual-canvas platform.

---

### 12. arXiv as a Research Source

#### Idea

Использовать `arxiv.org` как источник научных кандидатов для будущего research.

#### Potential QuizLight use

Искать исследования по:

- spaced repetition;
- memory retention;
- vocabulary acquisition;
- multimodal learning;
- contextual learning;
- video-assisted language learning;
- adaptive review;
- retrieval practice.

#### MVP status

Remember as research source. Do not automate monitoring now.

## Priority map

### Use now as lightweight rules

1. Video Learning Context Card.
2. Human Approval Gate.
3. Source-Linked Card Standard.
4. State Bridge Reasoning Pattern.
5. Codex Bounded Execution Workflow.

### Keep for near-future design

1. Agent Artifact Workspace.
2. External API Skill Gateway.
3. Agentic Visual Canvas Workflow.

### Preserve for later, do not implement yet

1. Graph Memory Control Layer.
2. Opportunity Graph Engine.
3. Kanban Agent Orchestration Standard.
4. Automated arXiv research pipeline.

## Hard boundary

Do not broaden the current MVP merely because these ideas are saved.

The current execution focus remains:

- improve YouTube Scene Player reliability;
- improve transcript and context editing UX;
- improve translation suggestion quality;
- preserve local-first simplicity.

## Related central knowledge

- https://github.com/oleg3479881328-code/Project-Execution-OS/blob/main/knowledge-library/patterns/reference-idea-library-implementation-summary.md
