import type { Card } from '../types'

const STORAGE_KEY = 'quizlight.cards.v1'

export const starterCards: Card[] = [
  {
    id: 'card-privet',
    russian: 'Привет',
    english: 'Hello',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'card-spasibo',
    russian: 'Спасибо',
    english: 'Thank you',
    updatedAt: new Date().toISOString(),
  },
]

export function loadCards(): Card[] {
  if (typeof window === 'undefined') {
    return starterCards
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return starterCards
  }

  try {
    const parsed = JSON.parse(raw) as Card[]

    if (!Array.isArray(parsed)) {
      return starterCards
    }

    return parsed.filter(
      (card) =>
        typeof card.id === 'string' &&
        typeof card.russian === 'string' &&
        typeof card.english === 'string' &&
        typeof card.updatedAt === 'string',
    )
  } catch {
    return starterCards
  }
}

export function saveCards(cards: Card[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}
