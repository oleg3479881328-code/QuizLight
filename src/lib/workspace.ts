import { loadCards, starterCards } from './cards'
import type {
  Card,
  CardSet,
  ContinueState,
  Folder,
  LearningProject,
  Material,
  MaterialType,
  WorkspaceState,
  WorkspaceViewMode,
} from '../types'

const WORKSPACE_STORAGE_KEY = 'quizlight.workspace.v1'
const LEGACY_CARDS_KEY = 'quizlight.cards.v1'
export const INBOX_SET_ID = 'system-inbox'

function nowIso() {
  return new Date().toISOString()
}

function ensureCardShape(card: Card): Card {
  return {
    ...card,
    setIds: Array.isArray(card.setIds) ? [...new Set(card.setIds.filter((value) => typeof value === 'string'))] : undefined,
  }
}

function makeInboxSet(cardIds: string[], updatedAt: string): CardSet {
  return {
    id: INBOX_SET_ID,
    name: 'Входящие',
    cardIds,
    kind: 'inbox',
    updatedAt,
  }
}

function buildWorkspaceFromCards(cards: Card[]): WorkspaceState {
  const updatedAt = nowIso()
  const migratedCards = cards.map((card) => {
    const next = ensureCardShape(card)
    if (!next.setIds || next.setIds.length === 0) {
      next.setIds = [INBOX_SET_ID]
    }
    if (!next.sourceType) {
      next.sourceType = next.youtubeUrl ? 'youtube' : 'manual'
    }
    return next
  })

  return {
    version: 1,
    folders: [],
    projects: [],
    materials: [],
    sets: [makeInboxSet(migratedCards.map((card) => card.id), updatedAt)],
    cards: migratedCards,
    continueState: { updatedAt },
    setViewModes: { [INBOX_SET_ID]: 'cards' },
  }
}

function isFolder(value: unknown): value is Folder {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as Folder).id === 'string' &&
      typeof (value as Folder).name === 'string',
  )
}

function isProject(value: unknown): value is LearningProject {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as LearningProject).id === 'string' &&
      typeof (value as LearningProject).name === 'string' &&
      typeof (value as LearningProject).primaryMaterialId === 'string' &&
      Array.isArray((value as LearningProject).materialIds) &&
      typeof (value as LearningProject).defaultSetId === 'string' &&
      Array.isArray((value as LearningProject).linkedSetIds),
  )
}

function isMaterial(value: unknown): value is Material {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as Material).id === 'string' &&
      typeof (value as Material).projectId === 'string' &&
      typeof (value as Material).title === 'string' &&
      ((value as Material).type === 'youtube' || (value as Material).type === 'text'),
  )
}

function isSet(value: unknown): value is CardSet {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as CardSet).id === 'string' &&
      typeof (value as CardSet).name === 'string' &&
      Array.isArray((value as CardSet).cardIds) &&
      ((value as CardSet).kind === 'inbox' ||
        (value as CardSet).kind === 'project-default' ||
        (value as CardSet).kind === 'custom'),
  )
}

function normalizeSet(set: CardSet): CardSet {
  return {
    ...set,
    cardIds: [...new Set(set.cardIds.filter((value) => typeof value === 'string'))],
  }
}

function normalizeWorkspace(parsed: WorkspaceState): WorkspaceState {
  const updatedAt = nowIso()
  const cards = Array.isArray(parsed.cards) ? parsed.cards.map(ensureCardShape) : []
  const sets = Array.isArray(parsed.sets) ? parsed.sets.filter(isSet).map(normalizeSet) : []
  const folders = Array.isArray(parsed.folders) ? parsed.folders.filter(isFolder) : []
  const projects = Array.isArray(parsed.projects) ? parsed.projects.filter(isProject) : []
  const materials = Array.isArray(parsed.materials) ? parsed.materials.filter(isMaterial) : []
  const hasInbox = sets.some((set) => set.id === INBOX_SET_ID)
  const inboxCardIds = cards
    .filter((card) => !card.setIds || card.setIds.length === 0 || card.setIds.includes(INBOX_SET_ID))
    .map((card) => card.id)

  const nextSets = hasInbox
    ? sets.map((set) => (set.id === INBOX_SET_ID ? { ...set, cardIds: [...new Set([...set.cardIds, ...inboxCardIds])] } : set))
    : [makeInboxSet(inboxCardIds, updatedAt), ...sets]

  const nextCards = cards.map((card) => {
    if (!card.setIds || card.setIds.length === 0) {
      return { ...card, setIds: [INBOX_SET_ID] }
    }

    return card
  })

  return {
    version: 1,
    folders,
    projects,
    materials,
    sets: nextSets,
    cards: nextCards,
    continueState: parsed.continueState,
    setViewModes: parsed.setViewModes ?? { [INBOX_SET_ID]: 'cards' },
  }
}

export function loadWorkspace(): WorkspaceState {
  if (typeof window === 'undefined') {
    return buildWorkspaceFromCards(starterCards)
  }

  const rawWorkspace = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
  if (rawWorkspace) {
    try {
      const parsed = JSON.parse(rawWorkspace) as WorkspaceState
      if (parsed && parsed.version === 1) {
        return normalizeWorkspace(parsed)
      }
    } catch {
      // fall back to migration path below
    }
  }

  const legacyCards = loadCards()
  const workspace = buildWorkspaceFromCards(legacyCards)
  saveWorkspace(workspace)
  return workspace
}

export function saveWorkspace(workspace: WorkspaceState) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace))
}

export function hasLegacyCardStorage() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(LEGACY_CARDS_KEY) !== null
}

export function getMaterialCover(type: MaterialType, youtubeUrl?: string) {
  if (type === 'youtube' && youtubeUrl) {
    const match = youtubeUrl.match(/(?:v=|youtu\.be\/)([\w-]{6,})/)
    if (match?.[1]) {
      return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`
    }
  }

  return ''
}

export function createTextPreview(text: string, maxLength = 180) {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) {
    return compact
  }

  return `${compact.slice(0, maxLength).trim()}...`
}

export function getSetViewMode(workspace: WorkspaceState, setId: string): WorkspaceViewMode {
  return workspace.setViewModes?.[setId] ?? 'cards'
}

export function updateContinueState(
  workspace: WorkspaceState,
  nextState: Partial<ContinueState>,
): WorkspaceState {
  return {
    ...workspace,
    continueState: {
      ...workspace.continueState,
      ...nextState,
      updatedAt: nowIso(),
    },
  }
}
