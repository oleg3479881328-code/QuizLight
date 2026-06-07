import { useMemo } from 'react'
import type { Card, LearningProject, Material, WorkspaceState } from '../types'

type DashboardHomeProps = {
  cards: Card[]
  projects: LearningProject[]
  materials: Material[]
  workspace: WorkspaceState
  onOpenQuickCardFlow: () => void
  onOpenProject: (projectId: string, materialId?: string, setId?: string) => void
  onOpenLibrary: (tab: 'projects' | 'folders' | 'sets' | 'cards') => void
  onOpenWorkspace: () => void
  onAddVideo: () => void
  onOpenCard: (cardId: string) => void
  onOpenMaterial: (projectId: string, materialId: string) => void
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'сегодня'
  if (diffDays === 1) return 'вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function DashboardHome({
  cards,
  projects,
  materials,
  workspace,
  onOpenQuickCardFlow,
  onOpenProject,
  onOpenLibrary,
  onOpenWorkspace,
  onAddVideo,
  onOpenCard,
  onOpenMaterial,
}: DashboardHomeProps) {
  // ── Derived data ──────────────────────────────────────────────────────────

  const totalCards = cards.length
  const youtubeCards = cards.filter((c) => c.sourceType === 'youtube' || c.youtubeUrl).length
  const recentCards = useMemo(
    () =>
      [...cards]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6),
    [cards],
  )

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime())
        .slice(0, 4),
    [projects],
  )

  const continueProject = useMemo(
    () =>
      projects.find((p) => p.id === workspace.continueState?.projectId) ?? recentProjects[0] ?? null,
    [projects, recentProjects, workspace.continueState?.projectId],
  )

  // Derive recent materials from source-linked cards grouped by YouTube source
  const recentMaterials = useMemo(() => {
    const sourceMap = new Map<string, { title: string; cardCount: number; lastUsed: string; youtubeUrl?: string }>()

    for (const card of cards) {
      if (card.sourceTitle) {
        const key = card.sourceTitle
        const existing = sourceMap.get(key)
        if (!existing || new Date(card.updatedAt) > new Date(existing.lastUsed)) {
          sourceMap.set(key, {
            title: key,
            cardCount: (existing?.cardCount ?? 0) + 1,
            lastUsed: card.updatedAt,
            youtubeUrl: card.youtubeUrl,
          })
        } else {
          sourceMap.set(key, {
            ...existing,
            cardCount: existing.cardCount + 1,
          })
        }
      }
    }

    return [...sourceMap.entries()]
      .map(([_, value]) => value)
      .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
      .slice(0, 5)
  }, [cards])

  // ── Continue-learning block ───────────────────────────────────────────────

  const continueBlock = (() => {
    if (continueProject) {
      const projectCards = cards.filter((c) => c.projectId === continueProject.id)
      return (
        <article className="dashboard-continue-card">
          <div className="dashboard-continue-card-body">
            <p className="dashboard-kicker">Продолжить обучение</p>
            <h2 className="dashboard-continue-title">{continueProject.name}</h2>
            <p className="dashboard-continue-desc">
              {projectCards.length > 0
                ? `${projectCards.length} карточек · ${materials.filter((m) => m.projectId === continueProject.id).length} материалов`
                : 'Добавьте первую карточку в проект'}
            </p>
          </div>
          <button
            type="button"
            className="dashboard-primary-button dashboard-continue-cta"
            onClick={() => onOpenProject(continueProject.id)}
          >
            Продолжить
          </button>
        </article>
      )
    }

    if (cards.length > 0) {
      return (
        <article className="dashboard-continue-card">
          <div className="dashboard-continue-card-body">
            <p className="dashboard-kicker">Продолжить обучение</p>
            <h2 className="dashboard-continue-title">У вас есть карточки</h2>
            <p className="dashboard-continue-desc">
              {totalCards} карточек сохранено. Откройте рабочее пространство, чтобы продолжить.
            </p>
          </div>
          <button
            type="button"
            className="dashboard-primary-button dashboard-continue-cta"
            onClick={onOpenWorkspace}
          >
            Открыть карточки
          </button>
        </article>
      )
    }

    return (
      <article className="dashboard-continue-card dashboard-continue-card--empty">
        <div className="dashboard-continue-card-body">
          <p className="dashboard-kicker">Добро пожаловать в QuizLight</p>
          <h2 className="dashboard-continue-title">Начните с первой карточки</h2>
          <p className="dashboard-continue-desc">
            Создайте двуязычную карточку вручную или добавьте YouTube-видео,
            чтобы превратить фразы в карточки с контекстом.
          </p>
        </div>
        <div className="dashboard-continue-actions">
          <button
            type="button"
            className="dashboard-primary-button"
            onClick={onOpenQuickCardFlow}
          >
            Создать карточку
          </button>
          <button
            type="button"
            className="dashboard-ghost-button"
            onClick={onAddVideo}
          >
            Добавить видео
          </button>
        </div>
      </article>
    )
  })()

  // ── Quick actions ─────────────────────────────────────────────────────────

  const quickActions = (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Быстрые действия</h2>
      <div className="dashboard-quick-actions">
        <button
          type="button"
          className="dashboard-action-card"
          onClick={onOpenQuickCardFlow}
        >
          <span className="dashboard-action-icon">✏️</span>
          <span className="dashboard-action-label">Создать карточку</span>
          <span className="dashboard-action-desc">Ручное создание двуязычной карточки</span>
        </button>
        <button
          type="button"
          className="dashboard-action-card"
          onClick={onAddVideo}
        >
          <span className="dashboard-action-icon">🎬</span>
          <span className="dashboard-action-label">Добавить видео</span>
          <span className="dashboard-action-desc">Загрузить транскрипт YouTube и создать карточки</span>
        </button>
        <button
          type="button"
          className="dashboard-action-card"
          onClick={() => onOpenLibrary('projects')}
        >
          <span className="dashboard-action-icon">📂</span>
          <span className="dashboard-action-label">Моя библиотека</span>
          <span className="dashboard-action-desc">Проекты, наборы и все карточки</span>
        </button>
      </div>
    </section>
  )

  // ── Statistics ────────────────────────────────────────────────────────────

  const statistics = (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Статистика</h2>
      <div className="dashboard-stats-grid">
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-label">Всего карточек</span>
          <strong className="dashboard-stat-value">{totalCards}</strong>
        </article>
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-label">С видео-контекстом</span>
          <strong className="dashboard-stat-value">{youtubeCards}</strong>
        </article>
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-label">Проектов</span>
          <strong className="dashboard-stat-value">{projects.length}</strong>
        </article>
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-label">Материалов</span>
          <strong className="dashboard-stat-value">{materials.length}</strong>
        </article>
      </div>
    </section>
  )

  // ── Recent cards ──────────────────────────────────────────────────────────

  const recentCardsSection = (
    <section className="dashboard-section">
      <div className="dashboard-section-head">
        <h2 className="dashboard-section-title">Недавние карточки</h2>
        {cards.length > 6 && (
          <button
            type="button"
            className="dashboard-text-button"
            onClick={() => onOpenLibrary('cards')}
          >
            Все карточки
          </button>
        )}
      </div>
      {recentCards.length > 0 ? (
        <div className="dashboard-recent-cards">
          {recentCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className="dashboard-recent-card"
              onClick={() => onOpenCard(card.id)}
            >
              <div className="dashboard-recent-card-langs">
                <span className="dashboard-recent-card-ru">{card.russian}</span>
                <span className="dashboard-recent-card-en">{card.english}</span>
              </div>
              <div className="dashboard-recent-card-meta">
                {card.sourceTitle && (
                  <span className="dashboard-recent-card-source" title={card.sourceTitle}>
                    {card.sourceTitle.length > 24
                      ? card.sourceTitle.slice(0, 24) + '…'
                      : card.sourceTitle}
                  </span>
                )}
                <span className="dashboard-recent-card-time">{formatTime(card.updatedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="dashboard-empty-state">
          <p>Карточек пока нет. Создайте первую карточку, чтобы она появилась здесь.</p>
        </div>
      )}
    </section>
  )

  // ── Recent materials ──────────────────────────────────────────────────────

  const recentMaterialsSection = (
    <section className="dashboard-section">
      <div className="dashboard-section-head">
        <h2 className="dashboard-section-title">Недавние материалы</h2>
      </div>
      {recentMaterials.length > 0 ? (
        <div className="dashboard-recent-materials">
          {recentMaterials.map((material) => {
            // Find the real material record to get projectId
            const realMaterial = materials.find(
              (m) => m.title === material.title || m.youtubeUrl === material.youtubeUrl
            )
            return (
              <button
                key={material.title}
                type="button"
                className="dashboard-recent-material"
                onClick={() => {
                  if (realMaterial) {
                    onOpenMaterial(realMaterial.projectId, realMaterial.id)
                  }
                }}
                disabled={!realMaterial}
              >
                <div className="dashboard-recent-material-info">
                  <strong className="dashboard-recent-material-title">{material.title}</strong>
                  <span className="dashboard-recent-material-count">
                    {material.cardCount} карточек
                  </span>
                </div>
                <div className="dashboard-recent-material-actions">
                  {material.youtubeUrl && (
                    <span className="dashboard-source-badge">YouTube</span>
                  )}
                  {realMaterial && (
                    <span className="dashboard-text-button">Открыть →</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="dashboard-empty-state">
          <p>
            Материалов пока нет. Добавьте YouTube-видео и создайте карточки из транскрипта,
            чтобы они появились здесь.
          </p>
        </div>
      )}
    </section>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-home">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Главная</h1>
          <p className="dashboard-subtitle">
            Быстрые карточки, контекст из видео и лёгкое повторение — всё в одном рабочем пространстве.
          </p>
        </div>
        <button
          type="button"
          className="dashboard-primary-button"
          onClick={onOpenQuickCardFlow}
        >
          ✏️ Новая карточка
        </button>
      </header>

      {continueBlock}

      {quickActions}

      {statistics}

      {recentCardsSection}

      {recentMaterialsSection}
    </div>
  )
}
