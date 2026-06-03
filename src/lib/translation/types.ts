/** Result of a single text translation */
export type TranslationResult = {
  /** The translated text */
  text: string
  /** Source language code (auto-detected or provided) */
  detectedLanguage?: string
  /** Confidence of language detection (0-1) */
  confidence?: number
}

/** A single dictionary translation entry */
export type DictionaryTranslation = {
  /** Normalized target word */
  normalizedTarget: string
  /** Display form of the target word */
  displayTarget: string
  /** Part of speech tag (e.g. "NOUN", "VERB", "ADJ") */
  posTag: string
  /** Confidence score (0-1) */
  confidence: number
  /** Prefix word for grammatical context */
  prefixWord: string
  /** Back-translations for disambiguation */
  backTranslations?: { normalizedText: string; displayText: string; numExamples: number; frequencyCount: number }[]
}

/** Result of a dictionary lookup for a single word */
export type DictionaryLookupResult = {
  /** The normalized source word */
  normalizedSource: string
  /** The display form of the source word */
  displaySource: string
  /** All possible translations with POS tags */
  translations: DictionaryTranslation[]
}

/** Configuration for the translation service */
export type TranslationConfig = {
  endpoint: string
  key: string
  region: string
}

/** Error from the translation API */
export type TranslationError = {
  code: number
  message: string
}

/** Generic response wrapper */
export type TranslationResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: TranslationError }
