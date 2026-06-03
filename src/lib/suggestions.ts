type SuggestionEntry = {
  russian: string
  english: string[]
}

const suggestionBank: SuggestionEntry[] = [
  {
    russian: 'Спасибо',
    english: ['Thank you', 'Thanks'],
  },
  {
    russian: 'Привет',
    english: ['Hello', 'Hi'],
  },
  {
    russian: 'Доброе утро',
    english: ['Good morning'],
  },
  {
    russian: 'Добрый вечер',
    english: ['Good evening'],
  },
  {
    russian: 'Как пройти в магазин?',
    english: ['How do I get to the store?', 'How can I get to the shop?'],
  },
  {
    russian: 'Где находится метро?',
    english: ['Where is the metro?', 'Where is the subway?'],
  },
  {
    russian: 'Сколько это стоит?',
    english: ['How much does it cost?', 'How much is it?'],
  },
  {
    russian: 'Мне нужна помощь',
    english: ['I need help'],
  },
  {
    russian: 'Я не понимаю',
    english: ["I don't understand"],
  },
]

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string) {
  return normalizeText(value).split(' ').filter(Boolean)
}

function scoreMatch(input: string, candidate: string) {
  const normalizedInput = normalizeText(input)
  const normalizedCandidate = normalizeText(candidate)

  if (!normalizedInput || !normalizedCandidate) {
    return 0
  }

  if (
    normalizedInput === normalizedCandidate ||
    normalizedCandidate.includes(normalizedInput) ||
    normalizedInput.includes(normalizedCandidate)
  ) {
    return 100
  }

  const inputTokens = tokenize(input)
  const candidateTokens = tokenize(candidate)

  if (inputTokens.length === 0 || candidateTokens.length === 0) {
    return 0
  }

  const overlap = inputTokens.filter((token) =>
    candidateTokens.some(
      (candidateToken) =>
        candidateToken.includes(token) || token.includes(candidateToken),
    ),
  ).length

  return overlap
}

export function getEnglishSuggestions(russianText: string) {
  const normalized = normalizeText(russianText)

  if (!normalized) {
    return []
  }

  const ranked = suggestionBank
    .map((entry) => ({
      entry,
      score: scoreMatch(russianText, entry.russian),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)

  return ranked[0]?.entry.english ?? []
}

export function getRussianSuggestions(englishText: string) {
  const normalized = normalizeText(englishText)

  if (!normalized) {
    return []
  }

  const ranked = suggestionBank
    .map((entry) => ({
      russian: entry.russian,
      score: Math.max(
        ...entry.english.map((variant) => scoreMatch(englishText, variant)),
      ),
    }))
    .filter((item) => item.score >= 2)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.russian)

  return Array.from(new Set(ranked))
}
