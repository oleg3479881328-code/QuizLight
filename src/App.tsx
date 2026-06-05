import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './App.css'
import { loadCards, saveCards } from './lib/cards'
import {
  getEnglishSuggestions,
  getRussianSuggestions,
} from './lib/suggestions'
import {
  extractContextWindow,
  extractYoutubeId,
  findPhraseInTranscript,
  formatTime,
  generateSenseBlock,
  parseTranscriptJson,
} from './lib/transcript'
import { translateText, dictionaryLookup } from './lib/translation/translationService'
import type { DictionaryLookupResult } from './lib/translation/types'
import { fetchSenseBlock } from './lib/senseBlockService'
import YouTubeScenePlayer from './components/YouTubeScenePlayer'
import type { Card, CardDraft, MatchCandidate, TranscriptEntry } from './types'
import { YoutubeTranscript } from 'youtube-transcript'

const THEME_STORAGE_KEY = 'quizlight.theme.v1'

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const emptyDraft: CardDraft = {
  russian: '',
  english: '',
  imageUrl: '',
}

type QuizState = {
  questionCard: Card
  options: string[]
  answered: boolean
  selectedAnswer: string | null
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function generateQuiz(cards: Card[]): QuizState | null {
  if (cards.length < 2) return null

  const questionCard = cards[Math.floor(Math.random() * cards.length)]
  const otherAnswers = cards
    .filter((c) => c.id !== questionCard.id)
    .map((c) => c.english)
  const distractors = shuffleArray(otherAnswers).slice(0, 3)

  const options = shuffleArray([questionCard.english, ...distractors])

  return {
    questionCard,
    options,
    answered: false,
    selectedAnswer: null,
  }
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const [cards, setCards] = useState<Card[]>(() => loadCards())
  const [draft, setDraft] = useState<CardDraft>(emptyDraft)
  const draftRef = useRef(draft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [lastEditedField, setLastEditedField] = useState<keyof CardDraft>('russian')
  const [selectedId, setSelectedId] = useState<string | null>(
    () => loadCards()[0]?.id ?? null,
  )
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null)
  const [speakingKey, setSpeakingKey] = useState<string | null>(null)
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('quizlight.autoPlayAudio') === 'true'
  })
  const [quizActive, setQuizActive] = useState(false)
  const [quiz, setQuiz] = useState<QuizState | null>(null)
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 })

  // Context Scene Card state
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([])
  const [selectedMatchIndex, setSelectedMatchIndex] = useState<number | null>(null)
  const [showContextEditor, setShowContextEditor] = useState(false)
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false)
  const [parsedTranscript, setParsedTranscript] = useState<TranscriptEntry[] | null>(null)
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0)
  const [playFromTranscriptSeconds, setPlayFromTranscriptSeconds] = useState<number | null>(null)
  const transcriptEntryRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Translation state
  const [isTranslating, setIsTranslating] = useState<'ru-to-en' | 'en-to-ru' | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const transcriptAbortControllerRef = useRef<AbortController | null>(null)
  const transcriptRequestIdRef = useRef(0)
  const candidateAbortControllerRef = useRef<AbortController | null>(null)
  const candidateRequestIdRef = useRef(0)
  const russianManualEditVersionRef = useRef(0)
  const [translationProvider, setTranslationProvider] = useState<'deepseek' | 'local-fallback' | null>(null)
  const [translationFallbackNote, setTranslationFallbackNote] = useState<string | null>(null)

  // Dictionary state
  const [dictionaryWord, setDictionaryWord] = useState('')
  const [dictionaryResult, setDictionaryResult] = useState<DictionaryLookupResult | null>(null)
  const [isDictionaryLoading, setIsDictionaryLoading] = useState(false)
  const [dictionaryError, setDictionaryError] = useState<string | null>(null)

  const russianFieldId = useId()
  const englishFieldId = useId()
  const imageFieldId = useId()
  const youtubeFieldId = useId()

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('quizlight.autoPlayAudio', String(autoPlayAudio))
    }
  }, [autoPlayAudio])

  useEffect(() => {
    const youtubeUrl = draft.youtubeUrl?.trim()

    if (!youtubeUrl) {
      queueMicrotask(() => setParsedTranscript(null))
      return undefined
    }

    if (!extractYoutubeId(youtubeUrl)) {
      queueMicrotask(() => setTranscriptError('Ссылка не распознана как YouTube URL.'))
      return undefined
    }

    const timer = window.setTimeout(() => {
      void loadTranscriptFromYouTubeUrl()
    }, 600)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.youtubeUrl])

  function toggleTheme() {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
  }

  useEffect(() => {
    saveCards(cards)
  }, [cards])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedId) ?? cards[0] ?? null,
    [cards, selectedId],
  )
  const englishSuggestions = useMemo(
    () => getEnglishSuggestions(draft.russian),
    [draft.russian],
  )
  const russianSuggestions = useMemo(
    () => getRussianSuggestions(draft.english),
    [draft.english],
  )
  /** Abort pending transcript translation and increment request id to invalidate stale responses */
  function invalidateTranscriptTranslation() {
    transcriptAbortControllerRef.current?.abort()
    transcriptAbortControllerRef.current = null
    transcriptRequestIdRef.current += 1
  }

  function invalidateMatchCandidateResolution() {
    candidateAbortControllerRef.current?.abort()
    candidateAbortControllerRef.current = null
    candidateRequestIdRef.current += 1
  }

  function updateDraft(field: keyof CardDraft, value: string | number | undefined) {
    setLastEditedField(field as keyof CardDraft)
    if (field === 'russian') {
      russianManualEditVersionRef.current += 1
    }
    if (field === 'english') {
      invalidateTranscriptTranslation()
    }
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function applyEnglishSuggestion(value: string) {
    updateDraft('english', value)
  }

  function applyRussianSuggestion(value: string) {
    updateDraft('russian', value)
  }

  const activeSuggestions = useMemo(() => {
    const hasRussian = draft.russian.trim().length > 0
    const hasEnglish = draft.english.trim().length > 0

    if (lastEditedField === 'russian' && englishSuggestions.length > 0) {
      return {
        label: 'Варианты перевода',
        items: englishSuggestions,
        apply: applyEnglishSuggestion,
        activeValue: draft.english.trim(),
      }
    }

    if (lastEditedField === 'english' && russianSuggestions.length > 0) {
      return {
        label: 'Варианты русского',
        items: russianSuggestions,
        apply: applyRussianSuggestion,
        activeValue: draft.russian.trim(),
      }
    }

    if (hasRussian && englishSuggestions.length > 0) {
      return {
        label: 'Варианты перевода',
        items: englishSuggestions,
        apply: applyEnglishSuggestion,
        activeValue: draft.english.trim(),
      }
    }

    if (hasEnglish && russianSuggestions.length > 0) {
      return {
        label: 'Варианты русского',
        items: russianSuggestions,
        apply: applyRussianSuggestion,
        activeValue: draft.russian.trim(),
      }
    }

    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.english,
    draft.russian,
    englishSuggestions,
    lastEditedField,
    russianSuggestions,
  ])

  const isEditing = editingId !== null
  const isFlipped = selectedCard ? flippedCardId === selectedCard.id : false

  function resetForm() {
    invalidateTranscriptTranslation()
    invalidateMatchCandidateResolution()
    setDraft(emptyDraft)
    setEditingId(null)
    setLastEditedField('russian')
    setTranscriptError(null)
    setMatchCandidates([])
    setSelectedMatchIndex(null)
    setShowContextEditor(false)
    setTranslationProvider(null)
    setTranslationFallbackNote(null)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const russian = draft.russian.trim()
    const english = draft.english.trim()
    const imageUrl = draft.imageUrl?.trim() || undefined

    if (!russian || !english) {
      return
    }

    const cardData: Partial<Card> = {
      russian,
      english,
      imageUrl,
      youtubeUrl: draft.youtubeUrl?.trim() || undefined,
      sourceTitle: draft.sourceTitle?.trim() || undefined,
      transcriptSource: draft.transcriptSource?.trim() || undefined,
      phraseStartSeconds: draft.phraseStartSeconds,
      phraseEndSeconds: draft.phraseEndSeconds,
      sceneStartSeconds: draft.sceneStartSeconds,
      sceneEndSeconds: draft.sceneEndSeconds,
      previousLines: draft.previousLines,
      targetLine: draft.targetLine,
      nextLines: draft.nextLines,
      situation: draft.situation,
      intent: draft.intent,
      tone: draft.tone,
      sense: draft.sense,
      usageNote: draft.usageNote,
      confidenceScore: draft.confidenceScore,
    }

    if (editingId) {
      setCards((current) =>
        current.map((card) =>
          card.id === editingId
            ? {
                ...card,
                ...cardData,
                updatedAt: new Date().toISOString(),
              }
            : card,
        ),
      )
      setSelectedId(editingId)
      setFlippedCardId(null)
      resetForm()
      return
    }

    const nextCard: Card = {
      id: crypto.randomUUID(),
      ...cardData,
      updatedAt: new Date().toISOString(),
    } as Card

    setCards((current) => [nextCard, ...current])
    setSelectedId(nextCard.id)
    setFlippedCardId(null)
    resetForm()
  }

  function startEditing(card: Card) {
    setEditingId(card.id)
    setSelectedId(card.id)
    setFlippedCardId(null)
    setDraft({
      russian: card.russian,
      english: card.english,
      imageUrl: card.imageUrl ?? '',
      youtubeUrl: card.youtubeUrl ?? '',
      sourceTitle: card.sourceTitle ?? '',
      transcriptSource: card.transcriptSource ?? '',
      phraseStartSeconds: card.phraseStartSeconds,
      phraseEndSeconds: card.phraseEndSeconds,
      sceneStartSeconds: card.sceneStartSeconds,
      sceneEndSeconds: card.sceneEndSeconds,
      previousLines: card.previousLines,
      targetLine: card.targetLine,
      nextLines: card.nextLines,
      situation: card.situation,
      intent: card.intent,
      tone: card.tone,
      sense: card.sense,
      usageNote: card.usageNote,
      confidenceScore: card.confidenceScore,
    })
  }

  function removeCard(cardId: string) {
    const remainingCards = cards.filter((card) => card.id !== cardId)

    setCards(remainingCards)

    if (editingId === cardId) {
      resetForm()
    }

    if (selectedId === cardId) {
      setSelectedId(remainingCards[0]?.id ?? null)
      setFlippedCardId(null)
    }
  }

  function selectCard(cardId: string) {
    setSelectedId(cardId)
    setFlippedCardId(null)
  }

  function toggleCardSide() {
    if (!selectedCard) {
      return
    }

    const nextFlipped = flippedCardId !== selectedCard.id

    setFlippedCardId(nextFlipped ? selectedCard.id : null)

    if (autoPlayAudio) {
      const nextText = nextFlipped ? selectedCard.english : selectedCard.russian
      const nextLang = nextFlipped ? 'en-US' : 'ru-RU'
      const nextSide = nextFlipped ? 'english' : 'russian'

      speakText(undefined, nextText, nextLang, nextSide)
    }
  }

  function openGoogleImageSearch(query: string) {
    if (!query.trim()) return
    const url = `https://www.google.com/search?q=${encodeURIComponent(query.trim())}&udm=2`
    window.open(url, '_blank', 'noopener')
  }

  function speakText(
    event: React.MouseEvent<HTMLButtonElement> | undefined,
    text: string,
    lang: string,
    side: 'russian' | 'english',
  ) {
    event?.stopPropagation()

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }

    const trimmedText = text.trim()

    if (!trimmedText || !selectedCard) {
      return
    }

    const nextKey = `${selectedCard.id}:${side}`

    if (speakingKey === nextKey) {
      window.speechSynthesis.cancel()
      setSpeakingKey(null)
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(trimmedText)
    utterance.lang = lang
    utterance.onend = () => setSpeakingKey(null)
    utterance.onerror = () => setSpeakingKey(null)

    setSpeakingKey(nextKey)
    window.speechSynthesis.speak(utterance)
  }

  function startQuiz() {
    const newQuiz = generateQuiz(cards)
    setQuiz(newQuiz)
    setQuizActive(true)
    setQuizScore({ correct: 0, total: 0 })
  }

  function nextQuestion() {
    const newQuiz = generateQuiz(cards)
    setQuiz(newQuiz)
  }

  function handleQuizAnswer(answer: string) {
    if (!quiz || quiz.answered) return

    const isCorrect = answer === quiz.questionCard.english
    setQuiz({
      ...quiz,
      answered: true,
      selectedAnswer: answer,
    })
    setQuizScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }))
  }

  function stopQuiz() {
    setQuizActive(false)
    setQuiz(null)
  }

  // === Context Scene Card handlers ===

  async function loadTranscriptFromYouTubeUrl() {
    const youtubeUrl = draft.youtubeUrl?.trim()

    if (!youtubeUrl) {
      setTranscriptError('Сначала вставьте ссылку на YouTube.')
      return false
    }

    const videoId = extractYoutubeId(youtubeUrl)

    if (!videoId) {
      setTranscriptError('Ссылка не распознана как YouTube URL.')
      return false
    }

    setIsLoadingTranscript(true)
    setTranscriptError(null)

    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId)

      // Normalize timings: detect if offset is in milliseconds or seconds
      const normalizedTranscript = transcript.map((entry) => {
        const shouldConvertFromMs = entry.offset > 1000 || entry.duration > 100
        const start = shouldConvertFromMs ? entry.offset / 1000 : entry.offset
        const duration = shouldConvertFromMs ? entry.duration / 1000 : entry.duration
        return { text: entry.text, start, end: start + duration }
      })

      console.log('Transcript timing diagnostic', {
        raw: transcript.slice(0, 3),
        normalized: normalizedTranscript.slice(0, 3),
      })

      const transcriptJson = JSON.stringify(normalizedTranscript, null, 2)

      updateDraft('transcriptJson', transcriptJson)
      updateDraft('transcriptSource', youtubeUrl)

      // Parse and store for clickable list
      try {
        const parsed = parseTranscriptJson(transcriptJson)
        setParsedTranscript(parsed)
      } catch {
        setParsedTranscript(null)
      }

      return true
    } catch {
      // Fallback: try via Vite dev proxy
      try {
        const fallbackRes = await fetch(`/api/youtube-transcript?videoId=${encodeURIComponent(videoId)}`)

        if (!fallbackRes.ok) {
          throw new Error(`Fallback failed with ${fallbackRes.status}`)
        }

        const transcript = await fallbackRes.json()

        const transcriptJson = JSON.stringify(
          Array.isArray(transcript)
            ? transcript
            : [],
          null,
          2,
        )

        updateDraft('transcriptJson', transcriptJson)
        updateDraft('transcriptSource', youtubeUrl)

        // Parse and store for clickable list
        try {
          const parsed = parseTranscriptJson(transcriptJson)
          setParsedTranscript(parsed)
        } catch {
          setParsedTranscript(null)
        }

        return true
      } catch (fallbackErr) {
        setTranscriptError(
          `Не удалось загрузить транскрипт: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
        )
        return false
      }
    } finally {
      setIsLoadingTranscript(false)
    }
  }

  async function handleFindPhrase() {
    setTranscriptError(null)
    setMatchCandidates([])
    setSelectedMatchIndex(null)

    const phrase = draft.english.trim()
    let transcriptJson = draft.transcriptJson?.trim()

    if (!phrase) {
      setTranscriptError('Сначала введите английскую фразу.')
      return
    }

    if (!transcriptJson) {
      const loaded = await loadTranscriptFromYouTubeUrl()
      if (!loaded) {
        return
      }
      transcriptJson = draft.transcriptJson?.trim()
    }

    if (!transcriptJson) {
      setTranscriptError('Вставьте JSON транскрипта или загрузите его из YouTube.')
      return
    }

    let transcript
    try {
      transcript = parseTranscriptJson(transcriptJson)
    } catch (err) {
      setTranscriptError(
        `Ошибка парсинга транскрипта: ${err instanceof Error ? err.message : String(err)}`,
      )
      return
    }

    const candidates = findPhraseInTranscript(phrase, transcript)

    if (candidates.length === 0) {
      setTranscriptError(
        'Фраза не найдена в транскрипте. Попробуйте другой вариант или укажите таймкоды вручную.',
      )
      return
    }

    setMatchCandidates(candidates)
    setSelectedMatchIndex(0)
    applyMatchCandidate(candidates[0], transcript)
  }

  async function applyMatchCandidate(candidate: MatchCandidate, transcript?: ReturnType<typeof parseTranscriptJson>) {
    if (!transcript && draft.transcriptJson) {
      try {
        transcript = parseTranscriptJson(draft.transcriptJson)
      } catch {
        return
      }
    }
    if (!transcript) return

    candidateAbortControllerRef.current?.abort()
    const controller = new AbortController()
    candidateAbortControllerRef.current = controller
    const requestId = ++candidateRequestIdRef.current

    const window = extractContextWindow(transcript, candidate.index)
    const currentEnglish = draft.english.trim()
    const currentRussian = draft.russian.trim()
    const localSenseBlock = generateSenseBlock({
      previousLines: window.previousLines,
      targetEntry: window.targetEntry,
      nextLines: window.nextLines,
      phrase: currentEnglish,
      translation: currentRussian,
    })

    setDraft((current) => ({
      ...current,
      phraseStartSeconds: window.phraseStartSeconds,
      phraseEndSeconds: window.phraseEndSeconds,
      sceneStartSeconds: window.sceneStartSeconds,
      sceneEndSeconds: window.sceneEndSeconds,
      previousLines: window.previousLines.map((l) => l.text).join('\n'),
      targetLine: window.targetEntry.text,
      nextLines: window.nextLines.map((l) => l.text).join('\n'),
      situation: localSenseBlock.situation,
      intent: localSenseBlock.intent,
      tone: localSenseBlock.tone,
      sense: localSenseBlock.sense,
      usageNote: localSenseBlock.usageNote,
      confidenceScore: candidate.confidence,
    }))

    setShowContextEditor(true)

    const [senseBlockResult, translationResult] = await Promise.all([
      fetchSenseBlock(
        currentEnglish,
        currentRussian,
        window.previousLines,
        window.nextLines,
        window.targetEntry,
        controller.signal,
      ),
      currentEnglish
        ? translateText(currentEnglish, 'en', 'ru', controller.signal)
        : Promise.resolve({
            ok: false as const,
            error: { code: 400, message: 'Empty text' },
          }),
    ])

    if (controller.signal.aborted || requestId !== candidateRequestIdRef.current) {
      return
    }

    const currentDraft = draftRef.current
    const isAcceptedCandidateResult =
      currentDraft.targetLine === window.targetEntry.text &&
      currentDraft.english.trim() === currentEnglish &&
      currentDraft.russian.trim() === currentRussian

    if (!isAcceptedCandidateResult) {
      return
    }

    setDraft((current) => ({
      ...current,
      situation: senseBlockResult.senseBlock.situation,
      intent: senseBlockResult.senseBlock.intent,
      tone: senseBlockResult.senseBlock.tone,
      sense: senseBlockResult.senseBlock.sense,
      usageNote: senseBlockResult.senseBlock.usageNote,
      russian: translationResult.ok ? translationResult.data.text : current.russian,
    }))

    if (translationResult.ok) {
      setTranslationProvider(translationResult.data.provider)
      setTranslationFallbackNote(
        translationResult.data.provider === 'local-fallback'
          ? 'DeepSeek недоступен — использована локальная подсказка.'
          : null,
      )
    } else {
      setTranslationProvider(null)
      setTranslationFallbackNote(null)
    }
  }

  function selectMatchCandidate(index: number) {
    setSelectedMatchIndex(index)
    const candidate = matchCandidates[index]
    if (candidate && draft.transcriptJson) {
      try {
        const transcript = parseTranscriptJson(draft.transcriptJson)
        applyMatchCandidate(candidate, transcript)
      } catch {
        // ignore
      }
    }
  }

  /** Click a transcript line → fill the card with that phrase + context */
  async function handleTranscriptLineClick(entry: TranscriptEntry, index: number, transcript: TranscriptEntry[]) {
    // Cancel any in-flight transcript translation request
    transcriptAbortControllerRef.current?.abort()
    const controller = new AbortController()
    transcriptAbortControllerRef.current = controller

    // Assign a unique request id for stale-response detection
    const requestId = ++transcriptRequestIdRef.current
    const russianVersionBeforeRequest = russianManualEditVersionRef.current

    // 1. Fill english and context IMMEDIATELY (synchronously) — don't wait for DeepSeek
    const window = extractContextWindow(transcript, index)

    const clickedPhrase = entry.text
    const localSenseBlock = generateSenseBlock({
      previousLines: window.previousLines,
      targetEntry: window.targetEntry,
      nextLines: window.nextLines,
      phrase: entry.text,
      translation: '',
    })

    setPlayFromTranscriptSeconds(entry.start)

    setDraft((current) => ({
      ...current,
      english: entry.text,
      phraseStartSeconds: window.phraseStartSeconds,
      phraseEndSeconds: window.phraseEndSeconds,
      sceneStartSeconds: window.sceneStartSeconds,
      sceneEndSeconds: window.sceneEndSeconds,
      previousLines: window.previousLines.map((l) => l.text).join('\n'),
      targetLine: window.targetEntry.text,
      nextLines: window.nextLines.map((l) => l.text).join('\n'),
      situation: localSenseBlock.situation,
      intent: localSenseBlock.intent,
      tone: localSenseBlock.tone,
      sense: localSenseBlock.sense,
      usageNote: localSenseBlock.usageNote,
      confidenceScore: 1.0,
    }))

    setShowContextEditor(true)
    setTranscriptError(null)

    // 2. Run DeepSeek sense-block replacement and EN→RU translation in parallel
    const [senseBlockResult, translationResult] = await Promise.all([
      fetchSenseBlock(
        entry.text,
        '',
        window.previousLines,
        window.nextLines,
        window.targetEntry,
        controller.signal,
      ),
      translateText(entry.text, 'en', 'ru', controller.signal),
    ])

    if (controller.signal.aborted) return

    // 3. Ref-based stale-response guard (not reliant on React updater sync execution)
    if (requestId !== transcriptRequestIdRef.current) return
    if (russianManualEditVersionRef.current !== russianVersionBeforeRequest) return

    const autoRussian = translationResult.ok ? translationResult.data.text : ''
    const provider = translationResult.ok ? translationResult.data.provider : 'local-fallback'
    const currentDraft = draftRef.current
    const isAcceptedTranscriptResult = currentDraft.english === clickedPhrase

    if (!isAcceptedTranscriptResult) return

    // 4. Apply draft and provider state at the same accepted point
    setDraft((current) => ({
      ...current,
      russian: autoRussian,
      situation: senseBlockResult.senseBlock.situation,
      intent: senseBlockResult.senseBlock.intent,
      tone: senseBlockResult.senseBlock.tone,
      sense: senseBlockResult.senseBlock.sense,
      usageNote: senseBlockResult.senseBlock.usageNote,
    }))

    setTranslationProvider(provider)
    setTranslationFallbackNote(
      provider === 'local-fallback'
        ? 'DeepSeek недоступен — использована локальная подсказка.'
        : null,
    )
  }

  // ─── Translation handlers ─────────────────────────────────────────────────

  async function handleTranslateRuToEn() {
    const text = draft.russian.trim()
    if (!text) return

    // Cancel previous request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsTranslating('ru-to-en')

    const result = await translateText(text, 'ru', 'en', controller.signal)
    if (controller.signal.aborted) return

    setIsTranslating(null)

    if (result.ok) {
      updateDraft('english', result.data.text)
      setTranslationProvider(result.data.provider)
      setTranslationFallbackNote(
        result.data.provider === 'local-fallback'
          ? 'DeepSeek недоступен — использована локальная подсказка.'
          : null,
      )
    } else {
      console.warn('Translation failed (RU→EN):', result.error.message)
      setTranslationProvider(null)
      setTranslationFallbackNote(null)
    }
  }

  async function handleTranslateEnToRu() {
    const text = draft.english.trim()
    if (!text) return

    // Cancel previous request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsTranslating('en-to-ru')

    const result = await translateText(text, 'en', 'ru', controller.signal)
    if (controller.signal.aborted) return

    setIsTranslating(null)

    if (result.ok) {
      updateDraft('russian', result.data.text)
      setTranslationProvider(result.data.provider)
      setTranslationFallbackNote(
        result.data.provider === 'local-fallback'
          ? 'DeepSeek недоступен — использована локальная подсказка.'
          : null,
      )
    } else {
      console.warn('Translation failed (EN→RU):', result.error.message)
      setTranslationProvider(null)
      setTranslationFallbackNote(null)
    }
  }

  // ─── Dictionary handler ───────────────────────────────────────────────────

  async function handleDictionaryLookup() {
    const word = dictionaryWord.trim()
    if (!word) return

    setIsDictionaryLoading(true)
    setDictionaryError(null)
    setDictionaryResult(null)

    const result = await dictionaryLookup(word, 'en', 'ru')
    setIsDictionaryLoading(false)

    if (result.ok) {
      setDictionaryResult(result.data)
    } else {
      setDictionaryError(result.error.message)
    }
  }

  const canStartQuiz = cards.length >= 2
  const hasContextScene = selectedCard?.youtubeUrl && selectedCard.sceneStartSeconds != null

  const previewSceneStartSeconds = Math.max(0, draft.sceneStartSeconds ?? draft.phraseStartSeconds ?? 0)
  const previewSceneEndSeconds = Math.max(
    previewSceneStartSeconds + 1,
    draft.sceneEndSeconds ?? draft.phraseEndSeconds ?? previewSceneStartSeconds + 15,
  )
  const previewPhraseStartSeconds = Math.max(0, draft.phraseStartSeconds ?? previewSceneStartSeconds)
  const previewPhraseEndSeconds = Math.max(
    previewPhraseStartSeconds + 1,
    draft.phraseEndSeconds ?? previewSceneEndSeconds,
  )

  const activeTranscriptIndex = useMemo(() => {
    if (!parsedTranscript || parsedTranscript.length === 0) return -1

    const currentTime = playerCurrentTime
    for (let index = 0; index < parsedTranscript.length; index += 1) {
      const entry = parsedTranscript[index]
      const nextStart = parsedTranscript[index + 1]?.start ?? entry.end + 1
      if (currentTime >= entry.start && currentTime < nextStart) {
        return index
      }
    }

    return parsedTranscript.findIndex((entry) => currentTime >= entry.start && currentTime < entry.end)
  }, [parsedTranscript, playerCurrentTime])

  useEffect(() => {
    if (activeTranscriptIndex >= 0) {
      transcriptEntryRefs.current[activeTranscriptIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [activeTranscriptIndex])

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="hero-top">
            <p className="eyebrow">QuizLight</p>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
          <h1>Карточки для быстрого словаря</h1>
          <p className="hero-text">
            Первый MVP только про одно: добавить карточку, увидеть русский и
            английский вариант, а потом спокойно отредактировать запись.
          </p>
        </div>
        <div className="hero-stats" aria-label="Сводка по карточкам">
          <article>
            <span>Карточек</span>
            <strong>{cards.length}</strong>
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

      {quizActive && quiz ? (
        <section className="quiz-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Тест</p>
              <h2>Выберите правильный перевод</h2>
            </div>
            <div className="quiz-score">
              <span>Счёт: {quizScore.correct}/{quizScore.total}</span>
            </div>
          </div>

          <div className="quiz-question">
            <span className="quiz-question-label">Русский</span>
            <p className="quiz-question-text">{quiz.questionCard.russian}</p>
            {quiz.questionCard.imageUrl ? (
              <img
                className="quiz-question-image"
                src={quiz.questionCard.imageUrl}
                alt=""
              />
            ) : null}
          </div>

          <div className="quiz-options">
            {quiz.options.map((option) => {
              let optionClass = 'quiz-option'
              if (quiz.answered) {
                if (option === quiz.questionCard.english) {
                  optionClass += ' is-correct'
                } else if (option === quiz.selectedAnswer) {
                  optionClass += ' is-wrong'
                }
              }
              return (
                <button
                  key={option}
                  type="button"
                  className={optionClass}
                  onClick={() => handleQuizAnswer(option)}
                  disabled={quiz.answered}
                >
                  {option}
                </button>
              )
            })}
          </div>

          {quiz.answered ? (
            <div className="quiz-feedback">
              {quiz.selectedAnswer === quiz.questionCard.english ? (
                <p className="quiz-feedback-correct">✅ Верно!</p>
              ) : (
                <p className="quiz-feedback-wrong">
                  ❌ Неверно. Правильный ответ: <strong>{quiz.questionCard.english}</strong>
                </p>
              )}
            </div>
          ) : null}

          <div className="quiz-actions">
            {quiz.answered ? (
              <button
                type="button"
                className="primary-button"
                onClick={nextQuestion}
              >
                Следующий вопрос →
              </button>
            ) : null}
            <button
              type="button"
              className="ghost-button"
              onClick={stopQuiz}
            >
              Завершить тест
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="workspace">
            <form className="editor-panel" onSubmit={handleSubmit}>
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Редактор</p>
                  <h2>{isEditing ? 'Редактирование карточки' : 'Новая карточка'}</h2>
                </div>
                {isEditing ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={resetForm}
                  >
                    Отменить
                  </button>
                ) : null}
              </div>

              <label className="field" htmlFor={russianFieldId}>
                <span>Русский вариант</span>
                <textarea
                  id={russianFieldId}
                  value={draft.russian}
                  onChange={(event) => updateDraft('russian', event.target.value)}
                  placeholder="Например: Доброе утро"
                  rows={3}
                />
                <div className="translate-button-row">
                  <button
                    type="button"
                    className="translate-button"
                    onClick={handleTranslateRuToEn}
                    disabled={!draft.russian.trim() || isTranslating === 'ru-to-en'}
                  >
                    {isTranslating === 'ru-to-en' ? '⏳ Перевод...' : '🌐 Перевести на английский'}
                  </button>
                  {translationProvider && !isTranslating ? (
                    <span className="provider-label">
                      {translationProvider === 'deepseek' ? 'DeepSeek' : 'Локальная подсказка'}
                    </span>
                  ) : null}
                  {translationFallbackNote ? (
                    <span className="fallback-note">{translationFallbackNote}</span>
                  ) : null}
                </div>
              </label>

              {activeSuggestions ? (
                <div className="suggestions-block">
                  <span className="suggestions-label">{activeSuggestions.label}</span>
                  <span className="provider-label">Локальная подсказка</span>
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
                <div className="translate-button-row">
                  <button
                    type="button"
                    className="translate-button"
                    onClick={handleTranslateEnToRu}
                    disabled={!draft.english.trim() || isTranslating === 'en-to-ru'}
                  >
                    {isTranslating === 'en-to-ru' ? '⏳ Перевод...' : '🌐 Перевести на русский'}
                  </button>
                  {translationProvider && !isTranslating ? (
                    <span className="provider-label">
                      {translationProvider === 'deepseek' ? 'DeepSeek' : 'Локальная подсказка'}
                    </span>
                  ) : null}
                  {translationFallbackNote ? (
                    <span className="fallback-note">{translationFallbackNote}</span>
                  ) : null}
                </div>
              </label>

              <label className="field" htmlFor={imageFieldId}>
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
                      onClick={() => openGoogleImageSearch(draft.russian)}
                      disabled={!draft.russian.trim()}
                      title="Искать на Google Картинках (русский)"
                    >
                      🇷🇺 🔍
                    </button>
                    <button
                      type="button"
                      className="image-search-button"
                      onClick={() => openGoogleImageSearch(draft.english)}
                      disabled={!draft.english.trim()}
                      title="Search Google Images (English)"
                    >
                      🇬🇧 🔍
                    </button>
                  </div>
                </div>
              </label>

              {/* Context Scene Card section */}
              <details className="context-scene-section">
                <summary className="context-scene-summary">
                  🎬 Контекстная сцена (YouTube + транскрипт)
                </summary>

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
                      onTimeChange={setPlayerCurrentTime}
                      playFromSeconds={playFromTranscriptSeconds}
                    />
                  </div>
                ) : null}

                {/* Clickable transcript list */}
                {parsedTranscript && parsedTranscript.length > 0 ? (
                  <div className="transcript-clickable-list">
                    <span className="transcript-clickable-label">
                      👆 Нажмите на фразу, чтобы вставить в карточку:
                    </span>
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
                            onClick={() => handleTranscriptLineClick(entry, i, parsedTranscript)}
                          >
                            <span className="transcript-entry-time">
                              {formatTime(entry.start)}
                            </span>
                            <span className="transcript-entry-text">
                              {entry.text}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="primary-button"
                  onClick={handleFindPhrase}
                  disabled={!draft.english.trim() || (!draft.transcriptJson?.trim() && !draft.youtubeUrl?.trim())}
                >
                  🔍 Найти фразу в транскрипте
                </button>

                {transcriptError ? (
                  <div className="transcript-error">
                    ⚠️ {transcriptError}
                  </div>
                ) : null}

                {matchCandidates.length > 1 ? (
                  <div className="match-candidates">
                    <span className="match-candidates-label">
                      Найдено {matchCandidates.length} совпадений. Выберите:
                    </span>
                    <div className="match-candidates-list">
                      {matchCandidates.map((candidate, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`match-candidate-chip${selectedMatchIndex === i ? ' is-selected' : ''}`}
                          onClick={() => selectMatchCandidate(i)}
                        >
                          #{i + 1} ({Math.round(candidate.confidence * 100)}%){' '}
                          {candidate.entry.text.slice(0, 40)}
                          {candidate.entry.text.length > 40 ? '...' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {showContextEditor ? (
                  <div className="context-editor">
                    <label className="field">
                      <span>Scene Start (сек)</span>
                      <input
                        type="number"
                        className="field-input"
                        value={draft.sceneStartSeconds ?? ''}
                        onChange={(e) =>
                          updateDraft('sceneStartSeconds', Number(e.target.value))
                        }
                        step={0.1}
                      />
                    </label>
                    <label className="field">
                      <span>Scene End (сек)</span>
                      <input
                        type="number"
                        className="field-input"
                        value={draft.sceneEndSeconds ?? ''}
                        onChange={(e) =>
                          updateDraft('sceneEndSeconds', Number(e.target.value))
                        }
                        step={0.1}
                      />
                    </label>
                    <label className="field">
                      <span>Previous Lines</span>
                      <textarea
                        className="field-textarea-code"
                        value={draft.previousLines ?? ''}
                        onChange={(e) => updateDraft('previousLines', e.target.value)}
                        rows={2}
                      />
                    </label>
                    <label className="field">
                      <span>Target Line</span>
                      <textarea
                        className="field-textarea-code"
                        value={draft.targetLine ?? ''}
                        onChange={(e) => updateDraft('targetLine', e.target.value)}
                        rows={2}
                      />
                    </label>
                    <label className="field">
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
                    <label className="field">
                      <span>Sense</span>
                      <textarea
                        className="field-textarea-code"
                        value={draft.sense ?? ''}
                        onChange={(e) => updateDraft('sense', e.target.value)}
                        rows={3}
                      />
                    </label>
                    <label className="field">
                      <span>Usage Note</span>
                      <textarea
                        className="field-textarea-code"
                        value={draft.usageNote ?? ''}
                        onChange={(e) => updateDraft('usageNote', e.target.value)}
                        rows={2}
                      />
                    </label>
                  </div>
                ) : null}
              </details>

              <button type="submit" className="primary-button">
                {isEditing ? 'Сохранить изменения' : 'Добавить карточку'}
              </button>
            </form>

            <section className="preview-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Просмотр</p>
                  <h2>Текущая карточка</h2>
                </div>
                <div className="panel-heading-actions">
                  <button
                    type="button"
                    className="panel-settings-button"
                    aria-label="Настройка карточки"
                    title="Настройка карточки"
                  >
                    ⚙️
                  </button>
                </div>
              </div>

              <label className="preview-setting-row">
                <input
                  type="checkbox"
                  checked={autoPlayAudio}
                  onChange={(event) => setAutoPlayAudio(event.target.checked)}
                />
                <span>Автопроигрывание звука при клике на карточку</span>
              </label>

              {selectedCard ? (
                <article
                  className={`focus-card${isFlipped ? ' is-flipped' : ''}`}
                  onClick={toggleCardSide}
                >
                  <div className="focus-card-face focus-card-front">
                    <div className="focus-card-head">
                      <span>Русский</span>
                      <button
                        type="button"
                        className={`audio-button${speakingKey === `${selectedCard.id}:russian` ? ' is-speaking' : ''}`}
                        onClick={(event) =>
                          speakText(event, selectedCard.russian, 'ru-RU', 'russian')
                        }
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
                        onClick={(event) =>
                          speakText(event, selectedCard.english, 'en-US', 'english')
                        }
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

              {/* Context Scene display on selected card */}
              {hasContextScene && selectedCard ? (
                <div className="context-scene-display">
                  <h3 className="context-scene-display-title">🎬 Контекстная сцена</h3>

                  <YouTubeScenePlayer
                    youtubeUrl={selectedCard.youtubeUrl!}
                    sceneStartSeconds={selectedCard.sceneStartSeconds!}
                    sceneEndSeconds={selectedCard.sceneEndSeconds!}
                    phraseStartSeconds={selectedCard.phraseStartSeconds!}
                    phraseEndSeconds={selectedCard.phraseEndSeconds!}
                  />

                  {/* Transcript lines */}
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

                  {/* Sense block */}
                  <div className="context-sense-block">
                    {selectedCard.situation ? (
                      <div className="sense-row">
                        <span className="sense-label">Situation:</span>
                        <span>{selectedCard.situation}</span>
                      </div>
                    ) : null}
                    {selectedCard.intent ? (
                      <div className="sense-row">
                        <span className="sense-label">Intent:</span>
                        <span>{selectedCard.intent}</span>
                      </div>
                    ) : null}
                    {selectedCard.tone ? (
                      <div className="sense-row">
                        <span className="sense-label">Tone:</span>
                        <span>{selectedCard.tone}</span>
                      </div>
                    ) : null}
                    {selectedCard.sense ? (
                      <div className="sense-row">
                        <span className="sense-label">Sense:</span>
                        <span>{selectedCard.sense}</span>
                      </div>
                    ) : null}
                    {selectedCard.usageNote ? (
                      <div className="sense-row">
                        <span className="sense-label">Usage:</span>
                        <span>{selectedCard.usageNote}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Dictionary Lookup section */}
              <details className="dictionary-section">
                <summary className="dictionary-summary">
                  📖 Словарь (Dictionary Lookup)
                </summary>
                <div className="dictionary-input-row">
                  <input
                    type="text"
                    className="field-input"
                    value={dictionaryWord}
                    onChange={(e) => setDictionaryWord(e.target.value)}
                    placeholder="Введите английское слово..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleDictionaryLookup()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleDictionaryLookup}
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
                            onClick={() => setDictionaryWord(t.displayTarget)}
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
                                  onClick={() => setDictionaryWord(bt.displayText)}
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
            </section>
          </section>

          <section className="collection-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Коллекция</p>
                <h2>Все карточки</h2>
              </div>
              <button
                type="button"
                className="primary-button quiz-start-button"
                onClick={startQuiz}
                disabled={!canStartQuiz}
                title={!canStartQuiz ? 'Нужно минимум 2 карточки для теста' : 'Начать тест'}
              >
                🧠 Начать тест
              </button>
            </div>

            {cards.length > 0 ? (
              <div className="cards-grid">
                {cards.map((card) => {
                  const isSelected = card.id === selectedCard?.id

                  return (
                    <article
                      key={card.id}
                      className={`mini-card${isSelected ? ' is-selected' : ''}`}
                      onClick={() => selectCard(card.id)}
                    >
                      <div className="mini-card-copy">
                        {card.imageUrl ? (
                          <img
                            className="mini-card-image"
                            src={card.imageUrl}
                            alt=""
                          />
                        ) : null}
                        <h3>{card.russian}</h3>
                        <p>{card.english}</p>
                        {card.youtubeUrl ? (
                          <span className="mini-card-context-badge">🎬</span>
                        ) : null}
                      </div>
                      <div className="mini-card-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            startEditing(card)
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            removeCard(card.id)
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
        </>
      )}
    </main>
  )
}

export default App
