export type Card = {
  id: string
  russian: string
  english: string
  imageUrl?: string
  updatedAt: string
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
