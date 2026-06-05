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
  generateSenseBlock,
  parseTranscriptJson,
} from './lib/transcript'
import { translateText, dictionaryLookup } from './lib/translation/translationService'
import type { DictionaryLookupResult } from './lib/translation/types'
import { fetchSenseBlock } from './lib/senseBlockService'
import HeroSummary from './components/HeroSummary'
import QuizPanel from './components/QuizPanel'
import CardEditorPanel from './components/CardEditorPanel'
import CardPreviewPanel from './components/CardPreviewPanel'
import CardCollectionPanel from './components/CardCollectionPanel'
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
  const hasContextScene = Boolean(selectedCard?.youtubeUrl && selectedCard.sceneStartSeconds != null)

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
      <HeroSummary
        cardsCount={cards.length}
        onToggleTheme={toggleTheme}
        theme={theme}
      />

      {quizActive && quiz ? (
        <QuizPanel
          quiz={quiz}
          quizScore={quizScore}
          onAnswer={handleQuizAnswer}
          onNextQuestion={nextQuestion}
          onStop={stopQuiz}
        />
      ) : (
        <>
          <section className="workspace">
            <CardEditorPanel
              activeSuggestions={activeSuggestions}
              activeTranscriptIndex={activeTranscriptIndex}
              draft={draft}
              englishFieldId={englishFieldId}
              imageFieldId={imageFieldId}
              isEditing={isEditing}
              isLoadingTranscript={isLoadingTranscript}
              isTranslating={isTranslating}
              loadTranscriptFromYouTubeUrl={loadTranscriptFromYouTubeUrl}
              matchCandidates={matchCandidates}
              onFindPhrase={handleFindPhrase}
              onImageSearch={openGoogleImageSearch}
              onPreviewTimeChange={setPlayerCurrentTime}
              onResetForm={resetForm}
              onSelectMatchCandidate={selectMatchCandidate}
              onSubmit={handleSubmit}
              playFromTranscriptSeconds={playFromTranscriptSeconds}
              onTranslateEnToRu={handleTranslateEnToRu}
              onTranslateRuToEn={handleTranslateRuToEn}
              onTranscriptLineClick={handleTranscriptLineClick}
              parsedTranscript={parsedTranscript}
              previewPhraseEndSeconds={previewPhraseEndSeconds}
              previewPhraseStartSeconds={previewPhraseStartSeconds}
              previewSceneEndSeconds={previewSceneEndSeconds}
              previewSceneStartSeconds={previewSceneStartSeconds}
              russianFieldId={russianFieldId}
              selectedMatchIndex={selectedMatchIndex}
              showContextEditor={showContextEditor}
              transcriptEntryRefs={transcriptEntryRefs}
              transcriptError={transcriptError}
              translationFallbackNote={translationFallbackNote}
              translationProvider={translationProvider}
              updateDraft={updateDraft}
              youtubeFieldId={youtubeFieldId}
            />

            <CardPreviewPanel
              autoPlayAudio={autoPlayAudio}
              dictionaryError={dictionaryError}
              dictionaryResult={dictionaryResult}
              dictionaryWord={dictionaryWord}
              hasContextScene={hasContextScene}
              isDictionaryLoading={isDictionaryLoading}
              isFlipped={isFlipped}
              onAutoPlayChange={setAutoPlayAudio}
              onDictionaryLookup={handleDictionaryLookup}
              onDictionaryWordChange={setDictionaryWord}
              onSpeakText={speakText}
              onToggleCardSide={toggleCardSide}
              selectedCard={selectedCard}
              speakingKey={speakingKey}
              updateDraft={(field, value) => updateDraft(field, value)}
            />
          </section>

          <CardCollectionPanel
            canStartQuiz={canStartQuiz}
            cards={cards}
            onEdit={startEditing}
            onRemove={removeCard}
            onSelect={selectCard}
            onStartQuiz={startQuiz}
            selectedCardId={selectedCard?.id ?? null}
          />
        </>
      )}
    </main>
  )
}

export default App
