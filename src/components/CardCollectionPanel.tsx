import type { Card } from '../types'

type CardCollectionPanelProps = {
  canStartQuiz: boolean
  cards: Card[]
  onEdit: (card: Card) => void
  onRemove: (cardId: string) => void
  onSelect: (cardId: string) => void
  onStartQuiz: () => void
  selectedCardId: string | null
}

export default function CardCollectionPanel({
  canStartQuiz,
  cards,
  onEdit,
  onRemove,
  onSelect,
  onStartQuiz,
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

      {cards.length > 0 ? (
        <div className="cards-grid">
          {cards.map((card) => {
            const isSelected = card.id === selectedCardId

            return (
              <article
                key={card.id}
                className={`mini-card${isSelected ? ' is-selected' : ''}`}
                onClick={() => onSelect(card.id)}
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
