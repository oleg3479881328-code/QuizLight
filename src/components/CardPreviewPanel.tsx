import type { MouseEvent } from 'react'
import type { DictionaryLookupResult } from '../lib/translation/types'
import type { Card } from '../types'
import YouTubeScenePlayer from './YouTubeScenePlayer'

type CardPreviewPanelProps = {
  autoPlayAudio: boolean
  dictionaryError: string | null
  dictionaryResult: DictionaryLookupResult | null
  dictionaryWord: string
  hasContextScene: boolean
  isDictionaryLoading: boolean
  isFlipped: boolean
  onAutoPlayChange: (enabled: boolean) => void
  onDictionaryLookup: () => Promise<void>
  onDictionaryWordChange: (value: string) => void
  onSpeakText: (
    event: MouseEvent<HTMLButtonElement> | undefined,
    text: string,
    lang: string,
    side: 'russian' | 'english',
  ) => void
  onToggleCardSide: () => void
  selectedCard: Card | null
  speakingKey: string | null
  updateDraft: (field: 'russian', value: string) => void
}

export default function CardPreviewPanel({
  autoPlayAudio,
  dictionaryError,
  dictionaryResult,
  dictionaryWord,
  hasContextScene,
  isDictionaryLoading,
  isFlipped,
  onAutoPlayChange,
  onDictionaryLookup,
  onDictionaryWordChange,
  onSpeakText,
  onToggleCardSide,
  selectedCard,
  speakingKey,
  updateDraft,
}: CardPreviewPanelProps) {
  return (
    <section className="preview-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Просмотр</p>
          <h2>Текущая карточка</h2>
          <p className="panel-description">
            Карточка остаётся главным фокусом. Если у неё есть сцена, контекст и
            воспроизведение отображаются ниже как второй слой.
          </p>
        </div>
      </div>

      <div className="preview-stage">
        <label className="preview-setting-row">
          <input
            type="checkbox"
            checked={autoPlayAudio}
            onChange={(event) => onAutoPlayChange(event.target.checked)}
          />
          <span>Автопроигрывание звука при клике на карточку</span>
        </label>

        {selectedCard ? (
          <article
            className={`focus-card${isFlipped ? ' is-flipped' : ''}`}
            onClick={onToggleCardSide}
          >
            <div className="focus-card-face focus-card-front">
              <div className="focus-card-head">
                <span>Русский</span>
                <button
                  type="button"
                  className={`audio-button${speakingKey === `${selectedCard.id}:russian` ? ' is-speaking' : ''}`}
                  onClick={(event) => onSpeakText(event, selectedCard.russian, 'ru-RU', 'russian')}
                  aria-label="Озвучить русский вариант"
                >
                  🔊
                </button>
              </div>
              <p>{selectedCard.russian}</p>
              {selectedCard.imageUrl ? (
                <img
                  className="focus-card-image"
                  src={selectedCard.imageUrl}
                  alt=""
                />
              ) : null}
            </div>
            <div className="focus-card-face focus-card-back">
              <div className="focus-card-head">
                <span>English</span>
                <button
                  type="button"
                  className={`audio-button${speakingKey === `${selectedCard.id}:english` ? ' is-speaking' : ''}`}
                  onClick={(event) => onSpeakText(event, selectedCard.english, 'en-US', 'english')}
                  aria-label="Read the English side aloud"
                >
                  🔊
                </button>
              </div>
              <p>{selectedCard.english}</p>
              {selectedCard.imageUrl ? (
                <img
                  className="focus-card-image"
                  src={selectedCard.imageUrl}
                  alt=""
                />
              ) : null}
            </div>
          </article>
        ) : (
          <div className="empty-state">
            <p>Добавьте первую карточку, и она появится здесь.</p>
          </div>
        )}
      </div>

      <div className="preview-support-stack">
        {hasContextScene && selectedCard ? (
          <div className="context-scene-display">
            <div className="context-scene-display-header">
              <div>
                <h3 className="context-scene-display-title">🎬 Контекстная сцена</h3>
                <p className="context-scene-display-copy">
                  Повтор сцены, реплики вокруг выбранной фразы и смысловой блок.
                </p>
              </div>
              <span className="context-chip">Scene</span>
            </div>

            <YouTubeScenePlayer
              youtubeUrl={selectedCard.youtubeUrl!}
              sceneStartSeconds={selectedCard.sceneStartSeconds!}
              sceneEndSeconds={selectedCard.sceneEndSeconds!}
              phraseStartSeconds={selectedCard.phraseStartSeconds!}
              phraseEndSeconds={selectedCard.phraseEndSeconds!}
            />

            <div className="context-transcript">
              {selectedCard.previousLines ? (
                <div className="context-transcript-line previous">
                  {selectedCard.previousLines.split('\n').map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </div>
              ) : null}
              {selectedCard.targetLine ? (
                <div className="context-transcript-line target">
                  <strong>→ {selectedCard.targetLine}</strong>
                </div>
              ) : null}
              {selectedCard.nextLines ? (
                <div className="context-transcript-line next">
                  {selectedCard.nextLines.split('\n').map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="context-sense-block">
              {selectedCard.situation ? (
                <div className="sense-row">
                  <span className="sense-label">Situation</span>
                  <span>{selectedCard.situation}</span>
                </div>
              ) : null}
              {selectedCard.intent ? (
                <div className="sense-row">
                  <span className="sense-label">Intent</span>
                  <span>{selectedCard.intent}</span>
                </div>
              ) : null}
              {selectedCard.tone ? (
                <div className="sense-row">
                  <span className="sense-label">Tone</span>
                  <span>{selectedCard.tone}</span>
                </div>
              ) : null}
              {selectedCard.sense ? (
                <div className="sense-row">
                  <span className="sense-label">Sense</span>
                  <span>{selectedCard.sense}</span>
                </div>
              ) : null}
              {selectedCard.usageNote ? (
                <div className="sense-row">
                  <span className="sense-label">Usage</span>
                  <span>{selectedCard.usageNote}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <details className="dictionary-section">
          <summary className="dictionary-summary">
            📖 Словарь (Dictionary Lookup)
          </summary>
          <div className="dictionary-input-row">
            <input
              type="text"
              className="field-input"
              value={dictionaryWord}
              onChange={(e) => onDictionaryWordChange(e.target.value)}
              placeholder="Введите английское слово..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void onDictionaryLookup()
                }
              }}
            />
            <button
              type="button"
              className="primary-button"
              onClick={() => void onDictionaryLookup()}
              disabled={!dictionaryWord.trim() || isDictionaryLoading}
            >
              {isDictionaryLoading ? '⏳ Поиск...' : '🔍 Найти'}
            </button>
          </div>

          {dictionaryError ? (
            <div className="dictionary-error">
              ⚠️ {dictionaryError}
            </div>
          ) : null}

          {dictionaryResult ? (
            <div className="dictionary-results">
              <div className="dictionary-word">
                <strong>{dictionaryResult.displaySource}</strong>
                <span className="dictionary-normalized">
                  ({dictionaryResult.normalizedSource})
                </span>
                <span className="provider-label">
                  {dictionaryResult.provider === 'deepseek' ? 'DeepSeek' : 'Локальная подсказка'}
                </span>
              </div>
              <div className="dictionary-translations">
                {dictionaryResult.translations.map((t, i) => (
                  <div key={i} className="dictionary-translation-row">
                    <span className="dictionary-pos-tag">{t.posTag}</span>
                    <button
                      type="button"
                      className="dictionary-target-word-button"
                      onClick={() => onDictionaryWordChange(t.displayTarget)}
                      title="Нажмите, чтобы искать это слово"
                    >
                      {t.displayTarget}
                    </button>
                    <button
                      type="button"
                      className="dictionary-apply-button"
                      onClick={() => updateDraft('russian', t.displayTarget)}
                      title="Использовать этот перевод в карточке"
                    >
                      📝
                    </button>
                    <span className="dictionary-confidence">
                      {Math.round(t.confidence * 100)}%
                    </span>
                    {t.backTranslations && t.backTranslations.length > 0 ? (
                      <div className="dictionary-back-translations">
                        {t.backTranslations.slice(0, 3).map((bt, j) => (
                          <button
                            key={j}
                            type="button"
                            className="dictionary-back-translation-button"
                            onClick={() => onDictionaryWordChange(bt.displayText)}
                            title="Нажмите, чтобы искать это слово"
                          >
                            {bt.displayText}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </details>
      </div>
    </section>
  )
}
