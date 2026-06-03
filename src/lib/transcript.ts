import type {
  TranscriptEntry,
  MatchCandidate,
  ContextWindow,
  SenseBlock,
} from '../types'

/**
 * Parse a JSON string into a TranscriptEntry array.
 * Supports both { text, start, end } and { text, start, duration } formats.
 */
export function parseTranscriptJson(json: string): TranscriptEntry[] {
  try {
    const raw = JSON.parse(json)
    if (!Array.isArray(raw)) throw new Error('Transcript must be an array')

    return raw.map((item: Record<string, unknown>, i: number) => {
      if (typeof item.text !== 'string') {
        throw new Error(`Item ${i}: missing or invalid "text"`)
      }
      const start = Number(item.start)
      if (isNaN(start)) {
        throw new Error(`Item ${i}: missing or invalid "start"`)
      }
      let end: number
      if (typeof item.end === 'number') {
        end = item.end
      } else if (typeof item.duration === 'number') {
        end = start + item.duration
      } else {
        throw new Error(`Item ${i}: missing "end" or "duration"`)
      }

      return {
        text: item.text.trim(),
        start,
        end,
      }
    })
  } catch (err) {
    throw new Error(
      `Failed to parse transcript JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Normalize text for matching: lowercase, remove punctuation, collapse whitespace.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Simple Levenshtein distance for fuzzy matching.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = []

  for (let i = 0; i <= m; i++) {
    dp[i] = [i]
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }

  return dp[m][n]
}

/**
 * Calculate similarity score (0-1) between two strings using Levenshtein.
 */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLen
}

/**
 * Find a phrase in transcript entries with multiple matching strategies.
 * Returns all candidates sorted by confidence (highest first).
 */
export function findPhraseInTranscript(
  phrase: string,
  transcript: TranscriptEntry[],
): MatchCandidate[] {
  const trimmed = phrase.trim()
  if (!trimmed || transcript.length === 0) return []

  const candidates: MatchCandidate[] = []

  transcript.forEach((entry, index) => {
    const entryText = entry.text.trim()

    // 1. Exact match
    if (entryText === trimmed) {
      candidates.push({ entry, index, matchType: 'exact', confidence: 1.0 })
      return
    }

    // 2. Case-insensitive match
    if (entryText.toLowerCase() === trimmed.toLowerCase()) {
      candidates.push({
        entry,
        index,
        matchType: 'case-insensitive',
        confidence: 0.95,
      })
      return
    }

    // 3. Punctuation-normalized match
    if (normalizeText(entryText) === normalizeText(trimmed)) {
      candidates.push({
        entry,
        index,
        matchType: 'normalized',
        confidence: 0.9,
      })
      return
    }

    // 4. Contains (phrase is a substring of entry text)
    if (entryText.toLowerCase().includes(trimmed.toLowerCase())) {
      candidates.push({
        entry,
        index,
        matchType: 'fuzzy',
        confidence: 0.7,
      })
      return
    }

    // 5. Fuzzy match (Levenshtein-based)
    const sim = similarity(normalizeText(entryText), normalizeText(trimmed))
    if (sim >= 0.6) {
      candidates.push({
        entry,
        index,
        matchType: 'fuzzy',
        confidence: Math.round(sim * 100) / 100,
      })
    }
  })

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence)

  return candidates
}

/**
 * Extract context window around a matched transcript entry.
 */
export function extractContextWindow(
  transcript: TranscriptEntry[],
  matchIndex: number,
): ContextWindow {
  const targetEntry = transcript[matchIndex]

  // Previous 1-2 lines
  const previousLines: TranscriptEntry[] = []
  for (let i = matchIndex - 1; i >= Math.max(0, matchIndex - 2); i--) {
    previousLines.unshift(transcript[i])
  }

  // Next 1-2 lines
  const nextLines: TranscriptEntry[] = []
  for (
    let i = matchIndex + 1;
    i <= Math.min(transcript.length - 1, matchIndex + 2);
    i++
  ) {
    nextLines.push(transcript[i])
  }

  // Calculate timestamps
  const phraseStartSeconds = targetEntry.start
  const phraseEndSeconds = targetEntry.end

  let sceneStartSeconds: number
  let sceneEndSeconds: number

  if (previousLines.length > 0) {
    sceneStartSeconds = previousLines[0].start
  } else {
    sceneStartSeconds = Math.max(0, phraseStartSeconds - 5)
  }

  if (nextLines.length > 0) {
    sceneEndSeconds = nextLines[nextLines.length - 1].end
  } else {
    sceneEndSeconds = phraseEndSeconds + 5
  }

  return {
    previousLines,
    targetEntry,
    nextLines,
    sceneStartSeconds,
    phraseStartSeconds,
    phraseEndSeconds,
    sceneEndSeconds,
  }
}

/**
 * Generate a sense block from context window data.
 * This is a rule-based fallback. In production, this would call an AI service.
 */
export function generateSenseBlock(params: {
  previousLines: TranscriptEntry[]
  targetEntry: TranscriptEntry
  nextLines: TranscriptEntry[]
  phrase: string
  translation: string
}): SenseBlock {
  const { previousLines, nextLines, phrase, translation } = params

  const prevText = previousLines.map((l) => l.text).join(' ')
  const nextText = nextLines.map((l) => l.text).join(' ')

  // Simple rule-based generation
  const isQuestion = phrase.includes('?') || phrase.toLowerCase().startsWith('what') || phrase.toLowerCase().startsWith('how') || phrase.toLowerCase().startsWith('can')
  const isGreeting = /^(hi|hello|hey|good morning|good afternoon|good evening)/i.test(phrase)
  const isThanks = /^(thank|thanks)/i.test(phrase)
  const isRequest = /^(i would like|can i have|could i|may i)/i.test(phrase.toLowerCase())
  const isApology = /^(sorry|excuse me|pardon)/i.test(phrase.toLowerCase())

  let situation = 'Разговор между людьми.'
  let intent = 'Спикер передаёт сообщение.'
  let tone = 'нейтральный'
  let sense = `Фраза "${phrase}" в этом контексте означает "${translation}".`
  let usageNote = `Используйте "${phrase}" в похожих разговорных ситуациях.`

  if (isGreeting) {
    situation = 'Люди приветствуют друг друга.'
    intent = 'Спикер начинает вежливое взаимодействие.'
    tone = 'дружелюбный, вежливый'
    sense = `"${phrase}" — это стандартное приветствие при знакомстве или начале разговора.`
    usageNote = `Используйте "${phrase}" при встрече или в начале разговора.`
  } else if (isThanks) {
    situation = 'Кто-то выражает благодарность.'
    intent = 'Спикер благодарит за помощь или услугу.'
    tone = 'благодарный, вежливый'
    sense = `"${phrase}" — это выражение благодарности.`
    usageNote = `Используйте "${phrase}" когда кто-то помог вам или дал что-то.`
  } else if (isRequest) {
    situation = 'Кто-то делает вежливую просьбу или заказ.'
    intent = 'Спикер вежливо просит что-то.'
    tone = 'вежливый, спокойный'
    sense = `"${phrase}" — это вежливый способ попросить что-то, а не просто выразить предпочтение.`
    usageNote = `Используйте "${phrase}" при заказе еды, напитков или вежливой просьбе.`
  } else if (isApology) {
    situation = 'Кто-то извиняется или привлекает внимание.'
    intent = 'Спикер вежливо готовится спросить или извиниться.'
    tone = 'извинительный, вежливый'
    sense = `"${phrase}" используют, чтобы извиниться или вежливо привлечь внимание.`
    usageNote = `Используйте "${phrase}" когда нужно извиниться или мягко прервать собеседника.`
  } else if (isQuestion) {
    situation = 'Кто-то задаёт вопрос.'
    intent = 'Спикер ищет информацию или уточнение.'
    tone = 'любопытный, нейтральный'
    sense = `"${phrase}" — это вопрос, который задают, чтобы получить информацию.`
    usageNote = `Используйте "${phrase}" когда вам нужно спросить о чём-то в похожем контексте.`
  }

  // Refine with context if available
  if (prevText) {
    situation = `После фразы "${prevText}" ${situation.toLowerCase()}`
  }
  if (nextText) {
    sense = `${sense} Ответ "${nextText}" подтверждает это значение.`
  }

  return {
    situation,
    intent,
    tone,
    sense,
    usageNote,
  }
}

/**
 * Extract YouTube video ID from various URL formats.
 */
export function extractYoutubeId(url: string): string | null {
  if (!url) return null

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

/**
 * Format seconds to MM:SS display string.
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
