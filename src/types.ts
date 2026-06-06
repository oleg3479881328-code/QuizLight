export type Card = {
  id: string
  russian: string
  english: string
  imageUrl?: string
  updatedAt: string
  projectId?: string
  materialId?: string
  sourceType?: 'manual' | 'youtube' | 'text'
  sourceOffsetStart?: number
  sourceOffsetEnd?: number
  setIds?: string[]
  // Context Scene Card fields
  youtubeUrl?: string
  sourceTitle?: string
  transcriptSource?: string
  phraseStartSeconds?: number
  phraseEndSeconds?: number
  sceneStartSeconds?: number
  sceneEndSeconds?: number
  previousLines?: string
  targetLine?: string
  nextLines?: string
  situation?: string
  intent?: string
  tone?: string
  sense?: string
  usageNote?: string
  confidenceScore?: number
}

export type CardDraft = {
  russian: string
  english: string
  imageUrl?: string
  sourceOffsetStart?: number
  sourceOffsetEnd?: number
  // Context Scene Card fields
  youtubeUrl?: string
  sourceTitle?: string
  transcriptSource?: string
  transcriptJson?: string
  phraseStartSeconds?: number
  phraseEndSeconds?: number
  sceneStartSeconds?: number
  sceneEndSeconds?: number
  previousLines?: string
  targetLine?: string
  nextLines?: string
  situation?: string
  intent?: string
  tone?: string
  sense?: string
  usageNote?: string
  confidenceScore?: number
}

export type TranscriptEntry = {
  text: string
  start: number
  end: number
}

export type MatchCandidate = {
  entry: TranscriptEntry
  index: number
  matchType: 'exact' | 'case-insensitive' | 'normalized' | 'fuzzy'
  confidence: number
}

export type ContextWindow = {
  previousLines: TranscriptEntry[]
  targetEntry: TranscriptEntry
  nextLines: TranscriptEntry[]
  sceneStartSeconds: number
  phraseStartSeconds: number
  phraseEndSeconds: number
  sceneEndSeconds: number
}

export type SenseBlock = {
  situation: string
  intent: string
  tone: string
  sense: string
  usageNote: string
}

export type Folder = {
  id: string
  name: string
  parentFolderId?: string
  createdAt: string
  updatedAt: string
}

export type ProjectStatus = 'active' | 'archived'

export type MaterialType = 'youtube' | 'text'

export type LearningProject = {
  id: string
  name: string
  folderId?: string
  primaryMaterialId: string
  materialIds: string[]
  defaultSetId: string
  linkedSetIds: string[]
  coverUrl?: string
  status: ProjectStatus
  lastOpenedMaterialId?: string
  lastActiveAt: string
  updatedAt: string
}

export type Material = {
  id: string
  projectId: string
  type: MaterialType
  title: string
  coverUrl?: string
  youtubeUrl?: string
  transcriptSource?: string
  transcriptJson?: string
  textContent?: string
  fileName?: string
  progressSeconds?: number
  progressTextOffset?: number
  createdAt: string
  updatedAt: string
}

export type CardSetKind = 'inbox' | 'project-default' | 'custom'

export type CardSet = {
  id: string
  name: string
  folderId?: string
  projectId?: string
  cardIds: string[]
  coverUrl?: string
  kind: CardSetKind
  updatedAt: string
}

export type ContinueState = {
  projectId?: string
  materialId?: string
  setId?: string
  updatedAt: string
  draft?: Partial<CardDraft>
}

export type WorkspaceViewMode = 'cards' | 'list'

export type WorkspaceState = {
  version: 1
  folders: Folder[]
  projects: LearningProject[]
  materials: Material[]
  sets: CardSet[]
  cards: Card[]
  continueState?: ContinueState
  setViewModes?: Record<string, WorkspaceViewMode>
}
