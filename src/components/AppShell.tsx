import { useState } from 'react'

type NavItem = 'home' | 'library' | 'cards' | 'sets' | 'materials'

type AppShellProps = {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  activeNav: NavItem
  onNavigate: (item: NavItem) => void
  children: React.ReactNode
}

const navItems: { id: NavItem; label: string; icon: string }[] = [
  { id: 'home', label: 'Главная', icon: '🏠' },
  { id: 'library', label: 'Библиотека', icon: '📚' },
  { id: 'cards', label: 'Все карточки', icon: '🗂️' },
  { id: 'sets', label: 'Наборы', icon: '📁' },
  { id: 'materials', label: 'Материалы', icon: '📹' },
]

export default function AppShell({
  theme,
  onToggleTheme,
  activeNav,
  onNavigate,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleNav(item: NavItem) {
    onNavigate(item)
    setMobileMenuOpen(false)
  }

  return (
    <div className="app-shell-root">
      {/* Sidebar — desktop persistent, mobile overlay */}
      <aside
        className={`app-sidebar${mobileMenuOpen ? ' app-sidebar--open' : ''}`}
        aria-label="Основная навигация"
      >
        <div className="app-sidebar-brand">
          <span className="app-sidebar-logo">⚡</span>
          <span className="app-sidebar-name">QuizLight</span>
        </div>

        <nav className="app-sidebar-nav" aria-label="Разделы">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`app-sidebar-nav-item${activeNav === item.id ? ' is-active' : ''}`}
              onClick={() => handleNav(item.id)}
              aria-current={activeNav === item.id ? 'page' : undefined}
            >
              <span className="app-sidebar-nav-icon">{item.icon}</span>
              <span className="app-sidebar-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <button
            type="button"
            className="app-sidebar-theme-toggle"
            onClick={onToggleTheme}
            aria-label={
              theme === 'light'
                ? 'Включить тёмную тему'
                : 'Включить светлую тему'
            }
            title={
              theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'
            }
          >
            <span className="app-sidebar-theme-icon" aria-hidden="true">
              {theme === 'light' ? '🌙' : '☀️'}
            </span>
            <span className="app-sidebar-theme-label">
              {theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay backdrop */}
      {mobileMenuOpen && (
        <div
          className="app-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content area */}
      <div className="app-main">
        {/* Mobile top bar */}
        <header className="app-mobile-header">
          <button
            type="button"
            className="app-mobile-menu-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={mobileMenuOpen}
          >
            <span className="app-mobile-menu-icon">
              {mobileMenuOpen ? '✕' : '☰'}
            </span>
          </button>
          <span className="app-mobile-title">QuizLight</span>
          <button
            type="button"
            className="app-mobile-theme-button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'light'
                ? 'Включить тёмную тему'
                : 'Включить светлую тему'
            }
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </header>

        <main className="app-main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
