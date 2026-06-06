import type { DragEvent } from 'react'
import type { Card } from '../types'

type CardCollectionPanelProps = {
  canStartQuiz: boolean
  cards: Card[]
  mode?: 'cards' | 'list'
  onCardDragStart?: (cardId: string, event: DragEvent<HTMLElement>) => void
  onEdit: (card: Card) => void
  onRemove: (cardId: string) => void
  onSelect: (cardId: string) => void
  onStartQuiz: () => void
  onViewModeChange?: (mode: 'cards' | 'list') => void
  selectedCardId: string | null
}

export default function CardCollectionPanel({
  canStartQuiz,
  cards,
  mode = 'cards',
  onCardDragStart,
  onEdit,
  onRemove,
  onSelect,
  onStartQuiz,
  onViewModeChange,
  selectedCardId,
}: CardCollectionPanelProps) {
  return (
    <section className="collection-panel">
      <div className="panel-heading panel-heading--collection">
        <div>
          <p className="panel-kicker">Коллекция</p>
          <h2>Все карточки</h2>
          <p className="panel-description">
            Коллекция поддерживает текущую работу: выбор активной карточки, быстрый
            возврат к редактированию и заметный маркер контекстных сцен.
          </p>
        </div>
        <button
          type="button"
          className="primary-button quiz-start-button"
          onClick={onStartQuiz}
          disabled={!canStartQuiz}
          title={!canStartQuiz ? 'Нужно минимум 2 карточки для теста' : 'Начать тест'}
        >
          🧠 Начать тест
        </button>
      </div>

      {onViewModeChange ? (
        <div className="collection-view-toggle">
          <button
            type="button"
            className={`ghost-button${mode === 'cards' ? ' is-active' : ''}`}
            onClick={() => onViewModeChange('cards')}
          >
            Карточки
          </button>
          <button
            type="button"
            className={`ghost-button${mode === 'list' ? ' is-active' : ''}`}
            onClick={() => onViewModeChange('list')}
          >
            Список
          </button>
        </div>
      ) : null}

      {cards.length > 0 ? (
        <div className={mode === 'list' ? 'collection-list' : 'cards-grid'}>
          {cards.map((card) => {
            const isSelected = card.id === selectedCardId

            return (
              <article
                key={card.id}
                className={`mini-card${isSelected ? ' is-selected' : ''}${mode === 'list' ? ' mini-card--list' : ''}`}
                onClick={() => onSelect(card.id)}
                draggable={Boolean(onCardDragStart)}
                onDragStart={(event) => onCardDragStart?.(card.id, event)}
              >
                <div className="mini-card-copy">
                  {card.imageUrl ? (
                    <img
                      className="mini-card-image"
                      src={card.imageUrl}
                      alt=""
                    />
                  ) : null}
                  <div className="mini-card-copy-head">
                    <h3>{card.russian}</h3>
                    {card.youtubeUrl ? (
                      <span className="mini-card-context-badge">🎬 Сцена</span>
                    ) : (
                      <span className="mini-card-context-badge mini-card-context-badge--plain">Обычная</span>
                    )}
                  </div>
                  <p>{card.english}</p>
                </div>
                <div className="mini-card-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onEdit(card)
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemove(card.id)
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-state collection-empty">
          <p>Карточек пока нет. Создайте первую!</p>
        </div>
      )}
    </section>
  )
}
