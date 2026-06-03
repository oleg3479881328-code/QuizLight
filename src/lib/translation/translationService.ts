import type {
  TranslationResult,
  DictionaryLookupResult,
  TranslationResponse,
} from './types'
import {
  getEnglishSuggestions,
  getRussianSuggestions,
} from '../suggestions'

// ─── Translate ───────────────────────────────────────────────────────────────

/**
 * Translate text from one language to another.
 *
 * Uses Azure Translator API via Vite dev-server middleware.
 * Falls back to local suggestion bank when Azure is unavailable or unconfigured.
 *
 * @param text - The text to translate
 * @param from - Source language code (e.g. "en", "ru"). Use "auto" for auto-detect.
 * @param to - Target language code (e.g. "ru", "en")
 * @param signal - Optional AbortSignal for cancellation
 */
export async function translateText(
  text: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<TranslationResponse<TranslationResult>> {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ok: false, error: { code: 400, message: 'Empty text' } }
  }

  // Always try Azure via middleware — middleware returns 503 if not configured
  try {
    const body = [{ Text: trimmed }]
    const params = new URLSearchParams({ 'api-version': '3.0', to })
    if (from && from !== 'auto') {
      params.set('from', from)
    }

    const res = await fetch(`/api/translate?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (res.ok) {
      const data = await res.json()
      const translation = data[0]
      return {
        ok: true,
        data: {
          text: translation.translations[0].text,
          detectedLanguage: translation.detectedLanguage?.language,
          confidence: translation.detectedLanguage?.score,
        },
      }
    }

    // Non-2xx response: log and fall through to local fallback
    console.warn(`Azure translate returned ${res.status}, falling back to local`)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: { code: 0, message: 'Aborted' } }
    }
    // Network error: fall through to local fallback
    console.warn('Azure translate failed, falling back to local:', err)
  }

  // Local fallback
  return localTranslate(trimmed, from, to)
}

// ─── Dictionary Lookup ───────────────────────────────────────────────────────

/**
 * Look up a single word in the dictionary for detailed POS-tagged translations.
 *
 * Uses Azure Translator Dictionary Lookup API via Vite dev-server middleware.
 * Falls back to a simple local heuristic when Azure is unavailable.
 *
 * @param word - A single word to look up
 * @param from - Source language code (e.g. "en")
 * @param to - Target language code (e.g. "ru")
 * @param signal - Optional AbortSignal for cancellation
 */
export async function dictionaryLookup(
  word: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<TranslationResponse<DictionaryLookupResult>> {
  const trimmed = word.trim()
  if (!trimmed) {
    return { ok: false, error: { code: 400, message: 'Empty word' } }
  }

  // Always try Azure via middleware — middleware returns 503 if not configured
  try {
    const body = [{ Text: trimmed }]
    const params = new URLSearchParams({
      'api-version': '3.0',
      from,
      to,
    })

    const res = await fetch(`/api/dictionary-lookup?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (res.ok) {
      const data = await res.json()
      const entry = data[0]
      return {
        ok: true,
        data: {
          normalizedSource: entry.normalizedSource,
          displaySource: entry.displaySource,
          translations: entry.translations.map(
            (t: {
              normalizedTarget: string
              displayTarget: string
              posTag: string
              confidence: number
              prefixWord: string
              backTranslations?: { normalizedText: string; displayText: string; numExamples: number; frequencyCount: number }[]
            }) => ({
              normalizedTarget: t.normalizedTarget,
              displayTarget: t.displayTarget,
              posTag: t.posTag,
              confidence: t.confidence,
              prefixWord: t.prefixWord,
              backTranslations: t.backTranslations,
            }),
          ),
        },
      }
    }

    // Non-2xx response: log and fall through to local fallback
    console.warn(`Azure dictionary lookup returned ${res.status}, falling back to local`)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: { code: 0, message: 'Aborted' } }
    }
    // Network error: fall through to local fallback
    console.warn('Azure dictionary lookup failed, falling back to local:', err)
  }

  // Local fallback
  return localDictionaryLookup(trimmed, from, to)
}

// ─── Local Fallbacks ─────────────────────────────────────────────────────────

function localTranslate(
  text: string,
  from: string,
  to: string,
): TranslationResponse<TranslationResult> {
  if (from === 'en' || to === 'ru') {
    const suggestions = getRussianSuggestions(text)
    if (suggestions.length > 0) {
      return {
        ok: true,
        data: { text: suggestions[0] },
      }
    }
  }

  if (from === 'ru' || to === 'en') {
    const suggestions = getEnglishSuggestions(text)
    if (suggestions.length > 0) {
      return {
        ok: true,
        data: { text: suggestions[0] },
      }
    }
  }

  return {
    ok: false,
    error: {
      code: 404,
      message: 'Translation not found in local bank. Configure Azure Translator for full coverage.',
    },
  }
}

function localDictionaryLookup(
  word: string,
  from: string,
  to: string,
): TranslationResponse<DictionaryLookupResult> {
  // Try to find a translation from the suggestion bank
  if (from === 'en' && to === 'ru') {
    const suggestions = getRussianSuggestions(word)
    if (suggestions.length > 0) {
      return {
        ok: true,
        data: {
          normalizedSource: word.toLowerCase(),
          displaySource: word,
          translations: suggestions.map((s) => ({
            normalizedTarget: s.toLowerCase(),
            displayTarget: s,
            posTag: 'UNKNOWN',
            confidence: 0.5,
            prefixWord: '',
          })),
        },
      }
    }
  }

  if (from === 'ru' && to === 'en') {
    const suggestions = getEnglishSuggestions(word)
    if (suggestions.length > 0) {
      return {
        ok: true,
        data: {
          normalizedSource: word.toLowerCase(),
          displaySource: word,
          translations: suggestions.map((s) => ({
            normalizedTarget: s.toLowerCase(),
            displayTarget: s,
            posTag: 'UNKNOWN',
            confidence: 0.5,
            prefixWord: '',
          })),
        },
      }
    }
  }

  return {
    ok: false,
    error: {
      code: 404,
      message: 'Dictionary entry not found in local bank. Configure Azure Translator for full coverage.',
    },
  }
}

