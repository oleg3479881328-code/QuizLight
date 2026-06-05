type HeroSummaryProps = {
  cardsCount: number
  onToggleTheme: () => void
  theme: 'light' | 'dark'
}

export default function HeroSummary({
  cardsCount,
  onToggleTheme,
  theme,
}: HeroSummaryProps) {
  return (
    <section className="hero-panel">
      <div className="hero-copy">
        <div className="hero-top">
          <p className="eyebrow">QuizLight</p>
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'}
            title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        <h1>Быстрого словаря</h1>
        <p className="hero-text">
          Веб-MVP для двуязычных карточек и контекстных сцен: вручную добавляйте
          русский и английский вариант или превращайте фразы из YouTube-транскрипта
          в понятные карточки с контекстом.
        </p>
      </div>

      <div className="hero-stats" aria-label="Сводка по карточкам">
        <article>
          <span>Карточек</span>
          <strong>{cardsCount}</strong>
        </article>
        <article>
          <span>Режим</span>
          <strong>Веб MVP</strong>
        </article>
        <article>
          <span>Хранение</span>
          <strong>Локально</strong>
        </article>
      </div>
    </section>
  )
}
