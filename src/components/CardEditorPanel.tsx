import type { FormEvent, MutableRefObject } from 'react'
import { formatTime } from '../lib/transcript'
import type { CardDraft, MatchCandidate, TranscriptEntry } from '../types'
import YouTubeScenePlayer from './YouTubeScenePlayer'

type ActiveSuggestions = {
  label: string
  items: string[]
  apply: (value: string) => void
  activeValue: string
}

type CardEditorPanelProps = {
  activeSuggestions: ActiveSuggestions | null
  draft: CardDraft
  englishFieldId: string
  imageFieldId: string
  isEditing: boolean
  isLoadingTranscript: boolean
  isTranslating: 'ru-to-en' | 'en-to-ru' | null
  loadTranscriptFromYouTubeUrl: () => Promise<boolean>
  matchCandidates: MatchCandidate[]
  onFindPhrase: () => Promise<void>
  onImageSearch: (query: string) => void
  onPreviewTimeChange: (time: number) => void
  onResetForm: () => void
  onSelectMatchCandidate: (index: number) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  playFromTranscriptSeconds: number | null
  onTranslateEnToRu: () => Promise<void>
  onTranslateRuToEn: () => Promise<void>
  parsedTranscript: TranscriptEntry[] | null
  previewPhraseEndSeconds: number
  previewPhraseStartSeconds: number
  previewSceneEndSeconds: number
  previewSceneStartSeconds: number
  russianFieldId: string
  selectedMatchIndex: number | null
  showContextEditor: boolean
  transcriptEntryRefs: MutableRefObject<(HTMLButtonElement | null)[]>
  transcriptError: string | null
  translationFallbackNote: string | null
  translationProvider: 'deepseek' | 'local-fallback' | null
  updateDraft: (field: keyof CardDraft, value: string | number | undefined) => void
  youtubeFieldId: string
  activeTranscriptIndex: number
  onTranscriptLineClick: (
    entry: TranscriptEntry,
    index: number,
    transcript: TranscriptEntry[],
  ) => Promise<void>
}

function TranslationAssist({
  fallbackNote,
  isBusy,
  onClick,
  provider,
  sourceValue,
  text,
}: {
  fallbackNote: string | null
  isBusy: boolean
  onClick: () => Promise<void>
  provider: 'deepseek' | 'local-fallback' | null
  sourceValue: string
  text: string
}) {
  return (
    <div className="translate-button-row">
      <button
        type="button"
        className="translate-button"
        onClick={onClick}
        disabled={!sourceValue.trim() || isBusy}
      >
        {isBusy ? '⏳ Перевод...' : text}
      </button>
      {provider && !isBusy ? (
        <span className="provider-label">
          {provider === 'deepseek' ? 'DeepSeek' : 'Локальная подсказка'}
        </span>
      ) : null}
      {fallbackNote ? (
        <span className="fallback-note">{fallbackNote}</span>
      ) : null}
    </div>
  )
}

export default function CardEditorPanel({
  activeSuggestions,
  activeTranscriptIndex,
  draft,
  englishFieldId,
  imageFieldId,
  isEditing,
  isLoadingTranscript,
  isTranslating,
  loadTranscriptFromYouTubeUrl,
  matchCandidates,
  onFindPhrase,
  onImageSearch,
  onPreviewTimeChange,
  onResetForm,
  onSelectMatchCandidate,
  onSubmit,
  playFromTranscriptSeconds,
  onTranslateEnToRu,
  onTranslateRuToEn,
  onTranscriptLineClick,
  parsedTranscript,
  previewPhraseEndSeconds,
  previewPhraseStartSeconds,
  previewSceneEndSeconds,
  previewSceneStartSeconds,
  russianFieldId,
  selectedMatchIndex,
  showContextEditor,
  transcriptEntryRefs,
  transcriptError,
  translationFallbackNote,
  translationProvider,
  updateDraft,
  youtubeFieldId,
}: CardEditorPanelProps) {
  return (
    <form className="editor-panel" onSubmit={onSubmit}>
      <div className="panel-heading panel-heading--editor">
        <div>
          <p className="panel-kicker">Редактор</p>
          <h2>{isEditing ? 'Редактирование карточки' : 'Новая карточка'}</h2>
          <p className="panel-description">
            Сначала заполните обычную карточку, а инструменты транскрипта и сцены
            используйте как расширенный слой для контекстных примеров.
          </p>
        </div>
        <div className="editor-mode-badge-group">
          <span className="mode-badge">Основной поток</span>
          {isEditing ? (
            <button
              type="button"
              className="ghost-button ghost-button--compact"
              onClick={onResetForm}
            >
              Отменить
            </button>
          ) : null}
        </div>
      </div>

      <div className="editor-primary-fields">
        <label className="field" htmlFor={russianFieldId}>
          <span>Русский вариант</span>
          <textarea
            id={russianFieldId}
            value={draft.russian}
            onChange={(event) => updateDraft('russian', event.target.value)}
            placeholder="Например: Доброе утро"
            rows={3}
          />
          <TranslationAssist
            fallbackNote={translationFallbackNote}
            isBusy={isTranslating === 'ru-to-en'}
            onClick={onTranslateRuToEn}
            provider={translationProvider}
            sourceValue={draft.russian}
            text="🌐 Перевести на английский"
          />
        </label>

        {activeSuggestions ? (
          <div className="suggestions-block">
            <div className="suggestions-header">
              <span className="suggestions-label">{activeSuggestions.label}</span>
              <span className="provider-label">Локальная подсказка</span>
            </div>
            <div className="suggestions-list">
              {activeSuggestions.items.map((suggestion) => {
                const isActive = activeSuggestions.activeValue === suggestion

                return (
                  <button
                    key={suggestion}
                    type="button"
                    className={`suggestion-chip${isActive ? ' is-active' : ''}`}
                    onClick={() => activeSuggestions.apply(suggestion)}
                  >
                    {suggestion}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <label className="field" htmlFor={englishFieldId}>
          <span>Английский вариант</span>
          <textarea
            id={englishFieldId}
            value={draft.english}
            onChange={(event) => updateDraft('english', event.target.value)}
            placeholder="For example: Good morning"
            rows={3}
          />
          <TranslationAssist
            fallbackNote={translationFallbackNote}
            isBusy={isTranslating === 'en-to-ru'}
            onClick={onTranslateEnToRu}
            provider={translationProvider}
            sourceValue={draft.english}
            text="🌐 Перевести на русский"
          />
        </label>
      </div>

      <label className="field field--image" htmlFor={imageFieldId}>
        <span>Изображение (URL)</span>
        <div className="image-search-row">
          <input
            id={imageFieldId}
            type="url"
            className="field-input"
            value={draft.imageUrl ?? ''}
            onChange={(event) => updateDraft('imageUrl', event.target.value)}
            placeholder="https://example.com/image.jpg"
          />
          <div className="image-search-buttons">
            <button
              type="button"
              className="image-search-button"
              onClick={() => onImageSearch(draft.russian)}
              disabled={!draft.russian.trim()}
              title="Искать на Google Картинках (русский)"
            >
              🇷🇺 🔍
            </button>
            <button
              type="button"
              className="image-search-button"
              onClick={() => onImageSearch(draft.english)}
              disabled={!draft.english.trim()}
              title="Search Google Images (English)"
            >
              🇬🇧 🔍
            </button>
          </div>
        </div>
      </label>

      <details className="context-scene-section">
        <summary className="context-scene-summary">
          <span className="context-scene-summary-title">🎬 Контекстная сцена</span>
          <span className="context-scene-summary-copy">
            YouTube, транскрипт, выбор фразы и контекстная карточка
          </span>
        </summary>

        <div className="context-scene-intro">
          <p>
            Этот блок нужен для карточек с видеоконтекстом. Основная карточка
            остаётся наверху, а здесь вы добавляете сцену, транскрипт и смысловой
            контекст.
          </p>
          <button
            type="button"
            className="ghost-button ghost-button--compact"
            onClick={onFindPhrase}
            disabled={!draft.english.trim() || (!draft.transcriptJson?.trim() && !draft.youtubeUrl?.trim())}
          >
            🔍 Найти фразу в транскрипте
          </button>
        </div>

        <label className="field" htmlFor={youtubeFieldId}>
          <span>YouTube URL</span>
          <div className="youtube-url-row">
            <input
              id={youtubeFieldId}
              type="url"
              className="field-input"
              value={draft.youtubeUrl ?? ''}
              onChange={(event) => updateDraft('youtubeUrl', event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <button
              type="button"
              className="ghost-button youtube-load-button"
              onClick={loadTranscriptFromYouTubeUrl}
              disabled={!draft.youtubeUrl?.trim() || isLoadingTranscript}
            >
              {isLoadingTranscript ? 'Загрузка...' : 'Загрузить транскрипт'}
            </button>
          </div>
        </label>

        {draft.youtubeUrl?.trim() ? (
          <div className="context-scene-preview">
            <div className="context-scene-preview-header">
              <span className="context-scene-preview-label">Превью сцены</span>
              <span className="context-scene-preview-tag">YouTube</span>
            </div>
            <YouTubeScenePlayer
              youtubeUrl={draft.youtubeUrl}
              sceneStartSeconds={previewSceneStartSeconds}
              sceneEndSeconds={previewSceneEndSeconds}
              phraseStartSeconds={previewPhraseStartSeconds}
              phraseEndSeconds={previewPhraseEndSeconds}
              onTimeChange={onPreviewTimeChange}
              playFromSeconds={playFromTranscriptSeconds}
            />
          </div>
        ) : null}

        {parsedTranscript && parsedTranscript.length > 0 ? (
          <div className="transcript-clickable-list">
            <div className="transcript-clickable-head">
              <span className="transcript-clickable-label">
                👆 Нажмите на фразу, чтобы вставить в карточку
              </span>
              <span className="context-chip">Транскрипт</span>
            </div>
            <div className="transcript-clickable-entries">
              {parsedTranscript.map((entry, i) => {
                const isSelected = draft.phraseStartSeconds === entry.start
                const isActive = i === activeTranscriptIndex
                return (
                  <button
                    key={i}
                    ref={(node) => {
                      transcriptEntryRefs.current[i] = node
                    }}
                    type="button"
                    className={`transcript-clickable-entry${isSelected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}`}
                    onClick={() => onTranscriptLineClick(entry, i, parsedTranscript)}
                  >
                    <span className="transcript-entry-time">{formatTime(entry.start)}</span>
                    <span className="transcript-entry-text">{entry.text}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {transcriptError ? (
          <div className="transcript-error">
            ⚠️ {transcriptError}
          </div>
        ) : null}

        {matchCandidates.length > 1 ? (
          <div className="match-candidates">
            <div className="match-candidates-header">
              <span className="match-candidates-label">
                Найдено {matchCandidates.length} совпадений. Выберите:
              </span>
              <span className="context-chip">Матчи</span>
            </div>
            <div className="match-candidates-list">
              {matchCandidates.map((candidate, i) => (
                <button
                  key={i}
                  type="button"
                  className={`match-candidate-chip${selectedMatchIndex === i ? ' is-selected' : ''}`}
                  onClick={() => onSelectMatchCandidate(i)}
                >
                  #{i + 1} ({Math.round(candidate.confidence * 100)}%) {candidate.entry.text.slice(0, 40)}
                  {candidate.entry.text.length > 40 ? '...' : ''}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showContextEditor ? (
          <div className="context-editor">
            <div className="context-editor-header">
              <div>
                <span className="context-editor-kicker">Контекст карточки</span>
                <h3>Таймкоды, реплики и смысловой блок</h3>
              </div>
              <span className="context-chip">Advanced</span>
            </div>

            <div className="context-editor-grid">
              <label className="field">
                <span>Scene Start (сек)</span>
                <input
                  type="number"
                  className="field-input"
                  value={draft.sceneStartSeconds ?? ''}
                  onChange={(e) => updateDraft('sceneStartSeconds', Number(e.target.value))}
                  step={0.1}
                />
              </label>
              <label className="field">
                <span>Scene End (сек)</span>
                <input
                  type="number"
                  className="field-input"
                  value={draft.sceneEndSeconds ?? ''}
                  onChange={(e) => updateDraft('sceneEndSeconds', Number(e.target.value))}
                  step={0.1}
                />
              </label>
              <label className="field field--full">
                <span>Previous Lines</span>
                <textarea
                  className="field-textarea-code"
                  value={draft.previousLines ?? ''}
                  onChange={(e) => updateDraft('previousLines', e.target.value)}
                  rows={2}
                />
              </label>
              <label className="field field--full">
                <span>Target Line</span>
                <textarea
                  className="field-textarea-code"
                  value={draft.targetLine ?? ''}
                  onChange={(e) => updateDraft('targetLine', e.target.value)}
                  rows={2}
                />
              </label>
              <label className="field field--full">
                <span>Next Lines</span>
                <textarea
                  className="field-textarea-code"
                  value={draft.nextLines ?? ''}
                  onChange={(e) => updateDraft('nextLines', e.target.value)}
                  rows={2}
                />
              </label>
              <label className="field">
                <span>Situation</span>
                <input
                  type="text"
                  className="field-input"
                  value={draft.situation ?? ''}
                  onChange={(e) => updateDraft('situation', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Intent</span>
                <input
                  type="text"
                  className="field-input"
                  value={draft.intent ?? ''}
                  onChange={(e) => updateDraft('intent', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Tone</span>
                <input
                  type="text"
                  className="field-input"
                  value={draft.tone ?? ''}
                  onChange={(e) => updateDraft('tone', e.target.value)}
                />
              </label>
              <label className="field field--full">
                <span>Sense</span>
                <textarea
                  className="field-textarea-code"
                  value={draft.sense ?? ''}
                  onChange={(e) => updateDraft('sense', e.target.value)}
                  rows={3}
                />
              </label>
              <label className="field field--full">
                <span>Usage Note</span>
                <textarea
                  className="field-textarea-code"
                  value={draft.usageNote ?? ''}
                  onChange={(e) => updateDraft('usageNote', e.target.value)}
                  rows={2}
                />
              </label>
            </div>
          </div>
        ) : null}
      </details>

      <div className="editor-submit-row">
        <button type="submit" className="primary-button">
          {isEditing ? 'Сохранить изменения' : 'Добавить карточку'}
        </button>
      </div>
    </form>
  )
}
