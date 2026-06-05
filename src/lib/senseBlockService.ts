import type { SenseBlock, TranscriptEntry } from '../types'
import { generateSenseBlock } from './transcript'


/**
 * Result of a sense-block lookup.
 */
export type SenseBlockResult = {
  senseBlock: SenseBlock
  provider: 'deepseek' | 'local-fallback'
}

/**
 * Fetch an AI-generated sense block from the server-side DeepSeek middleware.
 *
 * Falls back to the local rule-based generator when DeepSeek is unavailable.
 *
 * @param phrase - The English phrase to explain
 * @param translation - Optional Russian translation
 * @param previousLines - Optional previous transcript lines for context
 * @param nextLines - Optional next transcript lines for context
 * @param targetEntry - The matched transcript entry
 * @param signal - Optional AbortSignal for cancellation
 */
export async function fetchSenseBlock(
  phrase: string,
  translation: string,
  previousLines: TranscriptEntry[],
  nextLines: TranscriptEntry[],
  targetEntry: TranscriptEntry,
  signal?: AbortSignal,
): Promise<SenseBlockResult> {

  const trimmed = phrase.trim()
  if (!trimmed) {
    // Fall back to local for empty input
    return {
      senseBlock: generateSenseBlock({
        previousLines,
        targetEntry,
        nextLines,
        phrase: trimmed,
        translation,
      }),
      provider: 'local-fallback',
    }
  }

  // Try DeepSeek via middleware
  try {
    const body = {
      phrase: trimmed,
      translation,
      previousLines: previousLines.map((l) => l.text).join('\n'),
      nextLines: nextLines.map((l) => l.text).join('\n'),
    }

    const res = await fetch('/api/sense-block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (res.ok) {
      const data = await res.json()
      // Validate server-side response has required fields
      if (
        data &&
        typeof data.situation === 'string' &&
        typeof data.intent === 'string' &&
        typeof data.tone === 'string' &&
        typeof data.sense === 'string' &&
        typeof data.usageNote === 'string'
      ) {
        return {
          senseBlock: {
            situation: data.situation,
            intent: data.intent,
            tone: data.tone,
            sense: data.sense,
            usageNote: data.usageNote,
          },
          provider: 'deepseek',
        }
      }
      // Server returned invalid shape — fall through to local
      console.warn('DeepSeek sense-block returned invalid shape, falling back to local')
    } else {
      console.warn(`DeepSeek sense-block returned ${res.status}, falling back to local`)
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err // Re-throw abort errors
    }
    console.warn('DeepSeek sense-block failed, falling back to local:', err)
  }

  // Local fallback
  return {
    senseBlock: generateSenseBlock({
      previousLines,
      targetEntry,
      nextLines,
      phrase: trimmed,
      translation,
    }),
    provider: 'local-fallback',
  }
}
