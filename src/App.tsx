import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  getEnglishSuggestions,
  getRussianSuggestions,
} from './lib/suggestions'
import {
  extractContextWindow,
  extractFullPhrase,
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
import TextMaterialReaderPanel from './components/TextMaterialReaderPanel'
import ProjectCreationPanel from './components/ProjectCreationPanel'
import {
  createTextPreview,
  getMaterialCover,
  getSetViewMode,
  INBOX_SET_ID,
  loadWorkspace,
  saveWorkspace,
  updateContinueState,
} from './lib/workspace'
import type {
  Card,
  CardDraft,
  CardSet,
  Folder,
  LearningProject,
  MatchCandidate,
  Material,
  MaterialType,
  TranscriptEntry,
  WorkspaceState,
} from './types'
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

type Screen = 'home' | 'library' | 'workspace' | 'project' | 'set'
type LibraryTab = 'projects' | 'folders' | 'sets' | 'cards'

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
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => loadWorkspace())
  const [draft, setDraft] = useState<CardDraft>(emptyDraft)
  const draftRef = useRef(draft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [lastEditedField, setLastEditedField] = useState<keyof CardDraft>('russian')
  const [screen, setScreen] = useState<Screen>('home')
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('projects')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => loadWorkspace().continueState?.projectId ?? null,
  )
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(
    () => loadWorkspace().continueState?.materialId ?? null,
  )
  const [selectedSetId, setSelectedSetId] = useState<string>(
    () => loadWorkspace().continueState?.setId ?? INBOX_SET_ID,
  )
  const [isProjectCreationOpen, setIsProjectCreationOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => loadWorkspace().cards[0]?.id ?? null,
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

  const cards = workspace.cards
  const folders = workspace.folders
  const projects = workspace.projects
  const materials = workspace.materials
  const sets = workspace.sets

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
    saveWorkspace(workspace)
  }, [workspace])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )
  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === selectedMaterialId) ?? null,
    [materials, selectedMaterialId],
  )
  const selectedSet = useMemo(
    () => sets.find((set) => set.id === selectedSetId) ?? null,
    [selectedSetId, sets],
  )
  const visibleCards = useMemo(() => {
    if (selectedSet) {
      const setCardIds = new Set(selectedSet.cardIds)
      return cards.filter((card) => setCardIds.has(card.id))
    }

    if (selectedProject) {
      return cards.filter((card) => card.projectId === selectedProject.id)
    }

    return cards
  }, [cards, selectedProject, selectedSet])
  const selectedCard = useMemo(
    () => visibleCards.find((card) => card.id === selectedId) ?? visibleCards[0] ?? null,
    [selectedId, visibleCards],
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

  function updateWorkspace(recipe: (current: WorkspaceState) => WorkspaceState) {
    setWorkspace((current) => recipe(current))
  }

  function openQuickCardFlow() {
    setSelectedProjectId(null)
    setSelectedMaterialId(null)
    setSelectedSetId(INBOX_SET_ID)
    setScreen('workspace')
    resetForm()
  }

  function openProject(projectId: string, materialId?: string, setId?: string) {
    const project = projects.find((item) => item.id === projectId) ?? null
    setSelectedProjectId(projectId)
    setSelectedMaterialId(materialId ?? project?.lastOpenedMaterialId ?? project?.primaryMaterialId ?? null)
    setSelectedSetId(setId ?? project?.defaultSetId ?? INBOX_SET_ID)
    setScreen('workspace')
    updateWorkspace((current) =>
      updateContinueState(current, {
        projectId,
        materialId: materialId ?? project?.lastOpenedMaterialId ?? project?.primaryMaterialId,
        setId: setId ?? project?.defaultSetId,
      }),
    )
  }

  function createProjectFromSource(payload: {
    type: MaterialType
    title: string
    sourceValue: string
    folderId?: string
    fileName?: string
  }) {
    const timestamp = new Date().toISOString()
    const projectId = crypto.randomUUID()
    const materialId = crypto.randomUUID()
    const defaultSetId = crypto.randomUUID()
    const title = payload.title.trim() || 'Новый проект'
    const coverUrl = getMaterialCover(payload.type, payload.type === 'youtube' ? payload.sourceValue : undefined) || undefined

    const nextMaterial: Material = {
      id: materialId,
      projectId,
      type: payload.type,
      title,
      coverUrl,
      youtubeUrl: payload.type === 'youtube' ? payload.sourceValue.trim() : undefined,
      textContent: payload.type === 'text' ? payload.sourceValue : undefined,
      fileName: payload.fileName,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const nextSet: CardSet = {
      id: defaultSetId,
      name: title,
      projectId,
      cardIds: [],
      coverUrl,
      kind: 'project-default',
      updatedAt: timestamp,
    }

    const nextProject: LearningProject = {
      id: projectId,
      name: title,
      folderId: payload.folderId,
      primaryMaterialId: materialId,
      materialIds: [materialId],
      defaultSetId,
      linkedSetIds: [defaultSetId],
      coverUrl,
      status: 'active',
      lastOpenedMaterialId: materialId,
      lastActiveAt: timestamp,
      updatedAt: timestamp,
    }

    updateWorkspace((current) =>
      updateContinueState(
        {
          ...current,
          projects: [nextProject, ...current.projects],
          materials: [nextMaterial, ...current.materials],
          sets: [nextSet, ...current.sets],
        },
        { projectId, materialId, setId: defaultSetId },
      ),
    )

    setSelectedProjectId(projectId)
    setSelectedMaterialId(materialId)
    setSelectedSetId(defaultSetId)
    setScreen('workspace')
    resetForm()

    if (payload.type === 'youtube') {
      setDraft((current) => ({
        ...current,
        youtubeUrl: payload.sourceValue.trim(),
        sourceTitle: title,
      }))
    }
  }

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
      projectId: selectedProject?.id,
      materialId: selectedMaterial?.id,
      sourceType: selectedMaterial?.type ?? (draft.youtubeUrl?.trim() ? 'youtube' : 'manual'),
      sourceOffsetStart: draft.sourceOffsetStart,
      sourceOffsetEnd: draft.sourceOffsetEnd,
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

    const targetSetIds = editingId
      ? cards.find((card) => card.id === editingId)?.setIds ?? [selectedSetId]
      : [selectedProject?.defaultSetId ?? selectedSetId ?? INBOX_SET_ID]

    if (editingId) {
      updateWorkspace((current) => ({
        ...current,
        cards: current.cards.map((card) =>
          card.id === editingId
            ? {
                ...card,
                ...cardData,
                setIds: targetSetIds,
                updatedAt: new Date().toISOString(),
              }
            : card,
        ),
      }))
      setSelectedId(editingId)
      setFlippedCardId(null)
      resetForm()
      return
    }

    const nextCard: Card = {
      id: crypto.randomUUID(),
      ...cardData,
      setIds: targetSetIds,
      updatedAt: new Date().toISOString(),
    } as Card

    updateWorkspace((current) =>
      updateContinueState(
        {
          ...current,
          cards: [nextCard, ...current.cards],
          sets: current.sets.map((set) =>
            targetSetIds.includes(set.id)
              ? {
                  ...set,
                  cardIds: [nextCard.id, ...set.cardIds],
                  updatedAt: new Date().toISOString(),
                }
              : set,
          ),
        },
        {
          projectId: selectedProject?.id,
          materialId: selectedMaterial?.id,
          setId: targetSetIds[0],
        },
      ),
    )
    setSelectedId(nextCard.id)
    setFlippedCardId(null)
    resetForm()
  }

  function startEditing(card: Card) {
    if (card.projectId) {
      setSelectedProjectId(card.projectId)
    }
    if (card.materialId) {
      setSelectedMaterialId(card.materialId)
    }
    if (card.setIds?.[0]) {
      setSelectedSetId(card.setIds[0])
    }
    setScreen('workspace')
    setEditingId(card.id)
    setSelectedId(card.id)
    setFlippedCardId(null)
    setDraft({
      russian: card.russian,
      english: card.english,
      imageUrl: card.imageUrl ?? '',
      sourceOffsetStart: card.sourceOffsetStart,
      sourceOffsetEnd: card.sourceOffsetEnd,
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

    updateWorkspace((current) => ({
      ...current,
      cards: current.cards.filter((card) => card.id !== cardId),
      sets: current.sets.map((set) => ({
        ...set,
        cardIds: set.cardIds.filter((id) => id !== cardId),
      })),
    }))

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
    const newQuiz = generateQuiz(visibleCards)
    setQuiz(newQuiz)
    setQuizActive(true)
    setQuizScore({ correct: 0, total: 0 })
  }

  function nextQuestion() {
    const newQuiz = generateQuiz(visibleCards)
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
  async function handleTranscriptLineClick(_entry: TranscriptEntry, index: number, transcript: TranscriptEntry[]) {
    // Cancel any in-flight transcript translation request
    transcriptAbortControllerRef.current?.abort()
    const controller = new AbortController()
    transcriptAbortControllerRef.current = controller

    // Assign a unique request id for stale-response detection
    const requestId = ++transcriptRequestIdRef.current
    const russianVersionBeforeRequest = russianManualEditVersionRef.current

    // 0. Extract the full sentence around the clicked segment (not just the short segment)
    const fullPhrase = extractFullPhrase(transcript, index)

    // 1. Fill english and context IMMEDIATELY (synchronously) — don't wait for DeepSeek
    const window = extractContextWindow(transcript, index)

    const clickedPhrase = fullPhrase.text
    const localSenseBlock = generateSenseBlock({
      previousLines: window.previousLines,
      targetEntry: window.targetEntry,
      nextLines: window.nextLines,
      phrase: fullPhrase.text,
      translation: '',
    })

    setPlayFromTranscriptSeconds(fullPhrase.start)

    setDraft((current) => ({
      ...current,
      english: fullPhrase.text,
      phraseStartSeconds: fullPhrase.start,
      phraseEndSeconds: fullPhrase.end,
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
        fullPhrase.text,
        '',
        window.previousLines,
        window.nextLines,
        window.targetEntry,
        controller.signal,
      ),
      translateText(fullPhrase.text, 'en', 'ru', controller.signal),
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

  async function handleTextSelectionCreateCard(selection: {
    text: string
    start: number
    end: number
    before: string
    after: string
  }) {
    if (!selectedMaterial || !selectedProject) {
      return
    }

    const contextEntry: TranscriptEntry = {
      text: selection.text,
      start: selection.start,
      end: selection.end,
    }
    const beforeEntry: TranscriptEntry = {
      text: selection.before,
      start: Math.max(0, selection.start - selection.before.length),
      end: selection.start,
    }
    const afterEntry: TranscriptEntry = {
      text: selection.after,
      start: selection.end,
      end: selection.end + selection.after.length,
    }

    const [translationResult, senseBlockResult] = await Promise.all([
      translateText(selection.text, 'en', 'ru'),
      fetchSenseBlock(
        selection.text,
        '',
        selection.before ? [beforeEntry] : [],
        selection.after ? [afterEntry] : [],
        contextEntry,
      ),
    ])

    setScreen('workspace')
    setSelectedSetId(selectedProject.defaultSetId)
    setDraft((current) => ({
      ...current,
      english: selection.text,
      russian: translationResult.ok ? translationResult.data.text : current.russian,
      sourceTitle: selectedMaterial.title,
      sourceOffsetStart: selection.start,
      sourceOffsetEnd: selection.end,
      transcriptSource: selectedMaterial.title,
      previousLines: selection.before,
      targetLine: selection.text,
      nextLines: selection.after,
      situation: senseBlockResult.senseBlock.situation,
      intent: senseBlockResult.senseBlock.intent,
      tone: senseBlockResult.senseBlock.tone,
      sense: senseBlockResult.senseBlock.sense,
      usageNote: senseBlockResult.senseBlock.usageNote,
    }))
    setTranslationProvider(translationResult.ok ? translationResult.data.provider : null)
    setTranslationFallbackNote(
      translationResult.ok && translationResult.data.provider === 'local-fallback'
        ? 'DeepSeek недоступен — использована локальная подсказка.'
        : null,
    )
  }

  function createFolder() {
    const name = window.prompt('Название папки')
    if (!name?.trim()) {
      return
    }

    const now = new Date().toISOString()
    const nextFolder: Folder = {
      id: crypto.randomUUID(),
      name: name.trim(),
      parentFolderId: currentFolderId ?? undefined,
      createdAt: now,
      updatedAt: now,
    }

    updateWorkspace((current) => ({
      ...current,
      folders: [nextFolder, ...current.folders],
    }))
  }

  function renameFolder(folderId: string) {
    const folder = folders.find((item) => item.id === folderId)
    const name = window.prompt('Новое имя папки', folder?.name ?? '')
    if (!name?.trim()) {
      return
    }

    updateWorkspace((current) => ({
      ...current,
      folders: current.folders.map((folderItem) =>
        folderItem.id === folderId
          ? { ...folderItem, name: name.trim(), updatedAt: new Date().toISOString() }
          : folderItem,
      ),
    }))
  }

  function deleteFolder(folderId: string) {
    const hasChildren = folders.some((folder) => folder.parentFolderId === folderId)
    const hasProjectsInside = projects.some((project) => project.folderId === folderId)
    const hasSetsInside = sets.some((set) => set.folderId === folderId)

    if (hasChildren || hasProjectsInside || hasSetsInside) {
      window.alert('Нельзя удалить непустую папку. Сначала переместите вложенные папки, проекты и наборы.')
      return
    }

    if (!window.confirm('Удалить пустую папку?')) {
      return
    }

    updateWorkspace((current) => ({
      ...current,
      folders: current.folders.filter((folder) => folder.id !== folderId),
    }))
  }

  function renameProject(projectId: string) {
    const project = projects.find((item) => item.id === projectId)
    const name = window.prompt('Новое имя проекта', project?.name ?? '')
    if (!name?.trim()) {
      return
    }

    updateWorkspace((current) => ({
      ...current,
      projects: current.projects.map((projectItem) =>
        projectItem.id === projectId
          ? { ...projectItem, name: name.trim(), updatedAt: new Date().toISOString() }
          : projectItem,
      ),
    }))
  }

  function archiveProject(projectId: string) {
    updateWorkspace((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? { ...project, status: project.status === 'archived' ? 'active' : 'archived', updatedAt: new Date().toISOString() }
          : project,
      ),
    }))
  }

  function moveProjectToFolder(projectId: string, folderId?: string) {
    updateWorkspace((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === projectId
          ? { ...project, folderId, updatedAt: new Date().toISOString() }
          : project,
      ),
    }))
  }

  function moveFolderToFolder(folderId: string, parentFolderId?: string) {
    if (folderId === parentFolderId) {
      return
    }

    const byId = new Map(folders.map((folder) => [folder.id, folder]))
    let pointer = parentFolderId
    while (pointer) {
      if (pointer === folderId) {
        window.alert('Нельзя переместить папку внутрь самой себя или её потомка.')
        return
      }
      pointer = byId.get(pointer)?.parentFolderId
    }

    updateWorkspace((current) => ({
      ...current,
      folders: current.folders.map((folder) =>
        folder.id === folderId
          ? { ...folder, parentFolderId, updatedAt: new Date().toISOString() }
          : folder,
      ),
    }))
  }

  function renameSet(setId: string) {
    const set = sets.find((item) => item.id === setId)
    const name = window.prompt('Новое имя набора', set?.name ?? '')
    if (!name?.trim()) {
      return
    }

    updateWorkspace((current) => ({
      ...current,
      sets: current.sets.map((setItem) =>
        setItem.id === setId
          ? { ...setItem, name: name.trim(), updatedAt: new Date().toISOString() }
          : setItem,
      ),
    }))
  }

  function setSetViewMode(setId: string, mode: 'cards' | 'list') {
    updateWorkspace((current) => ({
      ...current,
      setViewModes: {
        ...current.setViewModes,
        [setId]: mode,
      },
    }))
  }

  function addCardToSet(cardId: string, setId: string) {
    updateWorkspace((current) => ({
      ...current,
      cards: current.cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              setIds: [...new Set([...(card.setIds ?? []), setId])],
            }
          : card,
      ),
      sets: current.sets.map((set) =>
        set.id === setId
          ? {
              ...set,
              cardIds: set.cardIds.includes(cardId) ? set.cardIds : [cardId, ...set.cardIds],
              updatedAt: new Date().toISOString(),
            }
          : set,
      ),
    }))
  }

  function beginDrag(event: React.DragEvent<HTMLElement>, payload: Record<string, string>) {
    event.dataTransfer.setData('application/json', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
  }

  function readDragPayload(event: React.DragEvent<HTMLElement>) {
    const raw = event.dataTransfer.getData('application/json')
    if (!raw) {
      return null
    }

    try {
      return JSON.parse(raw) as { type: string; id: string }
    } catch {
      return null
    }
  }

  const lowerSearch = searchQuery.trim().toLowerCase()
  const filteredProjects = useMemo(
    () =>
      lowerSearch
        ? projects.filter((project) => project.name.toLowerCase().includes(lowerSearch))
        : projects,
    [lowerSearch, projects],
  )
  const filteredSets = useMemo(
    () =>
      lowerSearch
        ? sets.filter((set) => set.name.toLowerCase().includes(lowerSearch))
        : sets,
    [lowerSearch, sets],
  )
  const filteredCards = useMemo(
    () =>
      lowerSearch
        ? cards.filter(
            (card) =>
              card.russian.toLowerCase().includes(lowerSearch) ||
              card.english.toLowerCase().includes(lowerSearch),
          )
        : cards,
    [cards, lowerSearch],
  )
  const currentFolderChildren = useMemo(
    () => folders.filter((folder) => (folder.parentFolderId ?? null) === currentFolderId),
    [currentFolderId, folders],
  )
  const currentFolderBreadcrumbs = useMemo(() => {
    const map = new Map(folders.map((folder) => [folder.id, folder]))
    const items: Folder[] = []
    let pointer = currentFolderId

    while (pointer) {
      const folder = map.get(pointer)
      if (!folder) break
      items.unshift(folder)
      pointer = folder.parentFolderId ?? null
    }

    return items
  }, [currentFolderId, folders])
  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt))
        .slice(0, 4),
    [projects],
  )
  const continueProject = useMemo(
    () => projects.find((project) => project.id === workspace.continueState?.projectId) ?? recentProjects[0] ?? null,
    [projects, recentProjects, workspace.continueState?.projectId],
  )
  const currentSetViewMode = selectedSet ? getSetViewMode(workspace, selectedSet.id) : 'cards'

  const canStartQuiz = visibleCards.length >= 2
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

      <ProjectCreationPanel
        folders={folders}
        isOpen={isProjectCreationOpen}
        onClose={() => setIsProjectCreationOpen(false)}
        onCreate={createProjectFromSource}
      />

      <nav className="workspace-nav">
        <button type="button" className="ghost-button" onClick={() => setScreen('home')}>
          Домой
        </button>
        <button type="button" className="ghost-button" onClick={() => setScreen('library')}>
          Библиотека
        </button>
        {selectedProject ? (
          <button type="button" className="ghost-button" onClick={() => setScreen('project')}>
            Проект
          </button>
        ) : null}
        <button type="button" className="primary-button" onClick={() => setIsProjectCreationOpen(true)}>
          + Новый проект
        </button>
        <button type="button" className="ghost-button" onClick={openQuickCardFlow}>
          + Быстрая карточка
        </button>
      </nav>

      {screen === 'home' ? (
        <section className="home-dashboard">
          <div className="home-primary-actions">
            <button type="button" className="primary-button" onClick={() => setIsProjectCreationOpen(true)}>
              + Новый проект
            </button>
            <button type="button" className="ghost-button" onClick={openQuickCardFlow}>
              + Быстрая карточка
            </button>
          </div>

          {continueProject ? (
            <article className="continue-card">
              <div>
                <p className="panel-kicker">Продолжить работу</p>
                <h2>{continueProject.name}</h2>
                <p className="panel-description">
                  Последний активный проект с быстрым переходом к материалу и набору.
                </p>
              </div>
              <div className="continue-card-meta">
                <span>Материалов: {continueProject.materialIds.length}</span>
                <span>Карточек: {cards.filter((card) => card.projectId === continueProject.id).length}</span>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => openProject(continueProject.id)}
              >
                Продолжить
              </button>
            </article>
          ) : null}

          <section className="home-secondary-grid">
            <article className="collection-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Недавние проекты</p>
                  <h2>Быстрый возврат</h2>
                </div>
              </div>
              <div className="home-link-list">
                {recentProjects.length > 0 ? recentProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="home-link-item"
                    onClick={() => openProject(project.id)}
                  >
                    <strong>{project.name}</strong>
                    <span>{project.status === 'archived' ? 'Архив' : 'Активный проект'}</span>
                  </button>
                )) : <p>Проектов пока нет.</p>}
              </div>
            </article>

            <article className="collection-panel">
              <div className="panel-heading">
                <div>
                  <p className="panel-kicker">Навигация</p>
                  <h2>Библиотека</h2>
                </div>
              </div>
              <div className="home-link-list">
                <button type="button" className="home-link-item" onClick={() => { setLibraryTab('projects'); setScreen('library') }}>
                  <strong>Все проекты</strong>
                  <span>{projects.length}</span>
                </button>
                <button type="button" className="home-link-item" onClick={() => { setLibraryTab('folders'); setScreen('library') }}>
                  <strong>Папки</strong>
                  <span>{folders.length}</span>
                </button>
                <button type="button" className="home-link-item" onClick={() => { setLibraryTab('sets'); setScreen('library') }}>
                  <strong>Наборы</strong>
                  <span>{sets.length}</span>
                </button>
                <button type="button" className="home-link-item" onClick={() => { setLibraryTab('cards'); setScreen('library') }}>
                  <strong>Все карточки</strong>
                  <span>{cards.length}</span>
                </button>
              </div>
            </article>
          </section>
        </section>
      ) : screen === 'library' ? (
        <section className="library-shell collection-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Библиотека</p>
              <h2>Проекты, папки, наборы и карточки</h2>
              <p className="panel-description">
                Поиск остаётся единым, а структура открывается по слоям без перегруженного дерева.
              </p>
            </div>
          </div>

          <div className="library-toolbar">
            <div className="library-tabs">
              <button type="button" className={`ghost-button${libraryTab === 'projects' ? ' is-active' : ''}`} onClick={() => setLibraryTab('projects')}>Проекты</button>
              <button type="button" className={`ghost-button${libraryTab === 'folders' ? ' is-active' : ''}`} onClick={() => setLibraryTab('folders')}>Папки</button>
              <button type="button" className={`ghost-button${libraryTab === 'sets' ? ' is-active' : ''}`} onClick={() => setLibraryTab('sets')}>Наборы</button>
              <button type="button" className={`ghost-button${libraryTab === 'cards' ? ' is-active' : ''}`} onClick={() => setLibraryTab('cards')}>Все карточки</button>
            </div>
            <input
              type="search"
              className="field-input library-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Поиск по проектам, наборам и карточкам"
            />
          </div>

          {libraryTab === 'projects' ? (
            <div className="cards-grid">
              {filteredProjects.map((project) => (
                <article
                  key={project.id}
                  className="mini-card"
                  draggable
                  onDragStart={(event) => beginDrag(event, { type: 'project', id: project.id })}
                >
                  <div className="mini-card-copy">
                    <div className="mini-card-copy-head">
                      <h3>{project.name}</h3>
                      <span className={`mini-card-context-badge${project.status === 'archived' ? ' mini-card-context-badge--plain' : ''}`}>
                        {project.status === 'archived' ? 'Архив' : 'Проект'}
                      </span>
                    </div>
                    <p>{materials.find((material) => material.id === project.primaryMaterialId)?.type === 'text' ? 'Text' : 'YouTube'}</p>
                  </div>
                  <div className="mini-card-actions">
                    <button type="button" className="ghost-button" onClick={() => { setSelectedProjectId(project.id); setScreen('project') }}>Открыть</button>
                    <button type="button" className="ghost-button" onClick={() => moveProjectToFolder(project.id, currentFolderId ?? undefined)}>В папку</button>
                    <button type="button" className="ghost-button" onClick={() => renameProject(project.id)}>✏️</button>
                    <button type="button" className="ghost-button" onClick={() => archiveProject(project.id)}>{project.status === 'archived' ? '↩️' : '📦'}</button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {libraryTab === 'folders' ? (
            <div className="folder-browser">
              <div className="folder-browser-head">
                <div className="folder-breadcrumbs">
                  <button type="button" className="ghost-button ghost-button--compact" onClick={() => setCurrentFolderId(null)}>Корень</button>
                  {currentFolderBreadcrumbs.map((folder) => (
                    <button key={folder.id} type="button" className="ghost-button ghost-button--compact" onClick={() => setCurrentFolderId(folder.id)}>
                      {folder.name}
                    </button>
                  ))}
                </div>
                <button type="button" className="primary-button" onClick={createFolder}>+ Папка</button>
              </div>

              <div className="home-link-list">
                {currentFolderChildren.map((folder) => (
                  <div
                    key={folder.id}
                    className="home-link-item folder-row"
                    draggable
                    onDragStart={(event) => beginDrag(event, { type: 'folder', id: folder.id })}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      const payload = readDragPayload(event)
                      if (!payload) return
                      if (payload.type === 'project') {
                        moveProjectToFolder(payload.id, folder.id)
                      }
                      if (payload.type === 'folder') {
                        moveFolderToFolder(payload.id, folder.id)
                      }
                    }}
                  >
                    <button type="button" className="folder-open-button" onClick={() => setCurrentFolderId(folder.id)}>
                      <strong>{folder.name}</strong>
                    </button>
                    <div className="mini-card-actions">
                      <button type="button" className="ghost-button" onClick={() => moveFolderToFolder(folder.id, currentFolderId ?? undefined)}>Переместить</button>
                      <button type="button" className="ghost-button" onClick={() => renameFolder(folder.id)}>✏️</button>
                      <button type="button" className="danger-button" onClick={() => deleteFolder(folder.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
                {currentFolderChildren.length === 0 ? <p>На этом уровне пока нет вложенных папок.</p> : null}
              </div>

              <div className="home-link-list">
                {projects
                  .filter((project) => (project.folderId ?? null) === currentFolderId)
                  .map((project) => (
                    <div
                      key={project.id}
                      className="home-link-item folder-row"
                      draggable
                      onDragStart={(event) => beginDrag(event, { type: 'project', id: project.id })}
                    >
                      <button type="button" className="folder-open-button" onClick={() => { setSelectedProjectId(project.id); setScreen('project') }}>
                        <strong>{project.name}</strong>
                      </button>
                      <div className="mini-card-actions">
                        <button type="button" className="ghost-button" onClick={() => openProject(project.id)}>Открыть</button>
                        <button type="button" className="ghost-button" onClick={() => moveProjectToFolder(project.id, undefined)}>В корень</button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          {libraryTab === 'sets' ? (
            <div className="cards-grid">
              {filteredSets.map((set) => (
                <article key={set.id} className="mini-card">
                  <div className="mini-card-copy">
                    <div className="mini-card-copy-head">
                      <h3>{set.name}</h3>
                      <span className={`mini-card-context-badge${set.kind === 'custom' ? ' mini-card-context-badge--plain' : ''}`}>
                        {set.kind === 'inbox' ? 'Inbox' : set.kind === 'project-default' ? 'Project' : 'Custom'}
                      </span>
                    </div>
                    <p>{set.cardIds.length} карточек</p>
                  </div>
                  <div className="mini-card-actions">
                    <button type="button" className="ghost-button" onClick={() => { setSelectedSetId(set.id); setScreen('set') }}>Открыть</button>
                    <button type="button" className="ghost-button" onClick={() => renameSet(set.id)}>✏️</button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {libraryTab === 'cards' ? (
            <div className="cards-grid">
              {filteredCards.map((card) => (
                <article key={card.id} className="mini-card" onClick={() => { setSelectedId(card.id); setScreen('workspace') }}>
                  <div className="mini-card-copy">
                    <div className="mini-card-copy-head">
                      <h3>{card.russian}</h3>
                      <span className="mini-card-context-badge">{card.sourceType ?? 'manual'}</span>
                    </div>
                    <p>{card.english}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : screen === 'project' && selectedProject ? (
        <section className="project-shell collection-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Проект</p>
              <h2>{selectedProject.name}</h2>
              <p className="panel-description">
                Один проект начинается с одного материала, а дальше может расти без сложной обязательной структуры.
              </p>
            </div>
            <div className="mini-card-actions">
              <button type="button" className="ghost-button" onClick={() => renameProject(selectedProject.id)}>Переименовать</button>
              <button type="button" className="ghost-button" onClick={() => archiveProject(selectedProject.id)}>
                {selectedProject.status === 'archived' ? 'Вернуть из архива' : 'В архив'}
              </button>
              <button type="button" className="primary-button" onClick={() => openProject(selectedProject.id)}>
                Продолжить
              </button>
            </div>
          </div>

          <section className="project-section">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Материалы</p>
                <h2>Источник обучения</h2>
              </div>
            </div>
            <div className="cards-grid">
              {materials.filter((material) => material.projectId === selectedProject.id).map((material) => (
                <article key={material.id} className="mini-card">
                  <div className="mini-card-copy">
                    <div className="mini-card-copy-head">
                      <h3>{material.title}</h3>
                      <span className="mini-card-context-badge">{material.type === 'text' ? 'Text' : 'YouTube'}</span>
                    </div>
                    <p>{material.type === 'text' ? createTextPreview(material.textContent ?? '') : material.youtubeUrl}</p>
                  </div>
                  <div className="mini-card-actions">
                    <button type="button" className="ghost-button" onClick={() => openProject(selectedProject.id, material.id)}>
                      Продолжить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="project-section">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Наборы</p>
                <h2>Связанные наборы</h2>
              </div>
            </div>
            <div className="home-link-list">
              {sets.filter((set) => set.projectId === selectedProject.id).map((set) => (
                <button
                  key={set.id}
                  type="button"
                  className="home-link-item"
                  onClick={() => { setSelectedSetId(set.id); openProject(selectedProject.id, selectedProject.lastOpenedMaterialId, set.id) }}
                >
                  <strong>{set.name}</strong>
                  <span>{set.cardIds.length} карточек</span>
                </button>
              ))}
            </div>
          </section>
        </section>
      ) : quizActive && quiz ? (
        <QuizPanel
          quiz={quiz}
          quizScore={quizScore}
          onAnswer={handleQuizAnswer}
          onNextQuestion={nextQuestion}
          onStop={stopQuiz}
        />
      ) : (
        <>
          {selectedMaterial?.type === 'text' && selectedMaterial.textContent ? (
            <TextMaterialReaderPanel
              material={selectedMaterial}
              onCreateCardFromSelection={handleTextSelectionCreateCard}
              onProgressChange={(offset) => {
                updateWorkspace((current) => ({
                  ...current,
                  materials: current.materials.map((material) =>
                    material.id === selectedMaterial.id
                      ? { ...material, progressTextOffset: offset, updatedAt: new Date().toISOString() }
                      : material,
                  ),
                  projects: current.projects.map((project) =>
                    project.id === selectedProject?.id
                      ? {
                          ...project,
                          lastOpenedMaterialId: selectedMaterial.id,
                          lastActiveAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        }
                      : project,
                  ),
                }))
              }}
            />
          ) : null}

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
            cards={visibleCards}
            mode={currentSetViewMode}
            onCardDragStart={(cardId, event) => beginDrag(event, { type: 'card', id: cardId })}
            onEdit={startEditing}
            onRemove={removeCard}
            onSelect={selectCard}
            onStartQuiz={startQuiz}
            onViewModeChange={selectedSet ? (mode) => setSetViewMode(selectedSet.id, mode) : undefined}
            selectedCardId={selectedCard?.id ?? null}
          />

          <section className="collection-panel set-drop-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Наборы</p>
                <h2>Добавить карточку в другой набор</h2>
              </div>
            </div>
            <div className="cards-grid">
              {sets.map((set) => (
                <article
                  key={set.id}
                  className="mini-card mini-card--drop-target"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    const payload = readDragPayload(event)
                    if (payload?.type === 'card') {
                      addCardToSet(payload.id, set.id)
                    }
                  }}
                >
                  <div className="mini-card-copy">
                    <div className="mini-card-copy-head">
                      <h3>{set.name}</h3>
                      <span className="mini-card-context-badge">{set.kind}</span>
                    </div>
                    <p>{set.cardIds.length} карточек</p>
                  </div>
                  {selectedCard ? (
                    <button type="button" className="ghost-button" onClick={() => addCardToSet(selectedCard.id, set.id)}>
                      Добавить выбранную
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}

export default App
