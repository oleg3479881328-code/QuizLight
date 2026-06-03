import { useCallback, useEffect, useRef, useState } from 'react'
import { extractYoutubeId, formatTime } from '../lib/transcript'

declare const YT: any

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

type Props = {
  youtubeUrl: string
  sceneStartSeconds: number
  sceneEndSeconds: number
  phraseStartSeconds: number
  phraseEndSeconds: number
}

/**
 * YouTube Scene Player
 *
 * Использует два подхода:
 * 1. **<iframe> с start/end в URL** — основной, самый надёжный.
 *    YouTube сам обрезает видео по параметрам start и end.
 *    При каждом нажатии "Play Scene" / "Replay" React пересоздаёт iframe
 *    через key — никакого IFrame API, никакой Error 5.
 *
 * 2. **IFrame API** — запасной, для точного контроля (таймлайн, пауза).
 *    Использует правильную последовательность: mute() → stopVideo() → loadVideoById()
 *    чтобы избежать Error 5 (HTML5 player error).
 */
export default function YouTubeScenePlayer({
  youtubeUrl,
  sceneStartSeconds,
  sceneEndSeconds,
  phraseStartSeconds,
  phraseEndSeconds,
}: Props) {
  const videoId = extractYoutubeId(youtubeUrl)

  // === Режим: iframe (основной) ===
  const [useIframe, setUseIframe] = useState(true)
  const [iframeKey, setIframeKey] = useState(0)
  const [iframePlaying, setIframePlaying] = useState(false)

  // === Режим: IFrame API (запасной) ===
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const checkIntervalRef = useRef<number | null>(null)
  const [apiReady, setApiReady] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Load IFrame API (только если переключились на API-режим)
  useEffect(() => {
    if (useIframe) return
    if (window.YT?.Player) {
      setApiReady(true)
      return
    }
    if (document.getElementById('youtube-iframe-api')) return

    const tag = document.createElement('script')
    tag.id = 'youtube-iframe-api'
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScript = document.getElementsByTagName('script')[0]
    firstScript?.parentNode?.insertBefore(tag, firstScript)

    window.onYouTubeIframeAPIReady = () => {
      setApiReady(true)
    }
  }, [useIframe])

  // Destroy player on unmount
  useEffect(() => {
    return () => {
      stopTimeCheck()
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch { /* ignore */ }
        playerRef.current = null
      }
    }
  }, [])

  // Create IFrame API player
  useEffect(() => {
    if (useIframe) return
    if (!apiReady || !videoId || !containerRef.current) return

    if (playerRef.current) {
      try { playerRef.current.destroy() } catch { /* ignore */ }
      playerRef.current = null
    }

    setPlayerReady(false)
    setPlayerError(null)
    setIsPlaying(false)
    setCurrentTime(0)

    playerRef.current = new YT.Player(containerRef.current, {
      height: '100%',
      width: '100%',
      videoId,
      playerVars: {
        modestbranding: 1,
        rel: 0,
        controls: 1,
        iv_load_policy: 3,
        fs: 0,
        autoplay: 0,
      },
      events: {
        onReady: () => {
          setPlayerReady(true)
          try {
            setDuration(playerRef.current.getDuration())
          } catch {
            // ignore
          }
        },
        onStateChange: (event: any) => {
          if (event.data === YT.PlayerState.PLAYING) {
            setIsPlaying(true)
            startTimeCheck()
            try {
              playerRef.current?.unMute()
              playerRef.current?.setVolume(100)
            } catch { /* ignore */ }
          } else if (event.data === YT.PlayerState.ENDED) {
            setIsPlaying(false)
            stopTimeCheck()
          } else {
            setIsPlaying(false)
            stopTimeCheck()
          }
        },
        onError: (event: any) => {
          console.warn('YouTube player error:', event.data)
          if (event.data === 5 || event.data === 150) {
            setPlayerError('Ошибка HTML5-плеера. Попробуйте iframe-режим.')
            setPlayerReady(false)
          } else if (event.data === 2) {
            setPlayerError('Неверный ID видео.')
          } else if (event.data === 100) {
            setPlayerError('Видео недоступно.')
          } else if (event.data === 101 || event.data === 150) {
            setPlayerError('Воспроизведение запрещено.')
          }
        },
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, videoId, useIframe])

  const startTimeCheck = useCallback(() => {
    stopTimeCheck()
    checkIntervalRef.current = window.setInterval(() => {
      if (!playerRef.current) return
      try {
        const time = playerRef.current.getCurrentTime()
        setCurrentTime(time)
        if (time >= sceneEndSeconds) {
          playerRef.current.stopVideo()
          stopTimeCheck()
        }
      } catch {
        // ignore
      }
    }, 200)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneEndSeconds])

  function stopTimeCheck() {
    if (checkIntervalRef.current !== null) {
      clearInterval(checkIntervalRef.current)
      checkIntervalRef.current = null
    }
  }

  // === iframe-режим: воспроизведение ===
  function playIframeScene() {
    setIframeKey((k) => k + 1)
    setIframePlaying(true)
  }

  // === IFrame API-режим: воспроизведение ===
  function playApiScene() {
    if (!playerRef.current || !videoId) return

    setPlayerError(null)
    setIsPlaying(false)
    stopTimeCheck()

    if (!playerReady) {
      // recreate player
      setPlayerReady(false)
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch { /* ignore */ }
        playerRef.current = null
      }
      // Re-trigger creation effect
      setApiReady(false)
      setTimeout(() => setApiReady(true), 100)
      return
    }

    try {
      // Правильная последовательность для избежания Error 5:
      // mute() → stopVideo() → loadVideoById() → unMute()
      playerRef.current.mute()
      playerRef.current.stopVideo()
      playerRef.current.loadVideoById({
        videoId,
        startSeconds: sceneStartSeconds,
        endSeconds: sceneEndSeconds,
      })
      // unMute сработает в onStateChange когда видео начнёт играть
    } catch (err) {
      console.warn('playApiScene failed:', err)
      setPlayerError('Ошибка воспроизведения. Переключитесь на iframe-режим.')
    }
  }

  function pauseVideo() {
    if (!playerRef.current) return
    try {
      playerRef.current.pauseVideo()
    } catch {
      // ignore
    }
  }

  function switchToApiMode() {
    setUseIframe(false)
  }

  function switchToIframeMode() {
    setUseIframe(true)
    setPlayerError(null)
  }

  if (!videoId) {
    return (
      <div className="youtube-error">
        ⚠️ Неверный URL YouTube
      </div>
    )
  }

  // === iframe-режим ===
  if (useIframe) {
    const iframeSrc = `https://www.youtube.com/embed/${videoId}`
      + `?start=${Math.floor(sceneStartSeconds)}`
      + `&end=${Math.floor(sceneEndSeconds)}`
      + `&autoplay=1`
      + `&rel=0`
      + `&modestbranding=1`
      + `&iv_load_policy=3`

    return (
      <div className="youtube-scene-player">
        <div className="youtube-player-container">
          {iframePlaying ? (
            <iframe
              key={iframeKey}
              width="100%"
              height="100%"
              src={iframeSrc}
              allow="autoplay; encrypted-media"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ border: 'none' }}
            />
          ) : (
            <div className="youtube-loading">
              Нажмите «Play Scene», чтобы воспроизвести
            </div>
          )}
        </div>

        <div className="youtube-controls">
          <button
            type="button"
            className="youtube-play-button"
            onClick={playIframeScene}
          >
            {iframePlaying ? '↺ Повторить' : '▶ Play Scene'}
          </button>
        </div>

        <div className="youtube-timeline">
          <div className="youtube-timeline-bar">
            <div
              className="youtube-timeline-segment scene"
              style={{
                left: `${(sceneStartSeconds / (sceneEndSeconds + 10)) * 100}%`,
                width: `${((sceneEndSeconds - sceneStartSeconds) / (sceneEndSeconds + 10)) * 100}%`,
              }}
            >
              <span className="youtube-timeline-label">Scene</span>
            </div>
            <div
              className="youtube-timeline-segment phrase"
              style={{
                left: `${(phraseStartSeconds / (sceneEndSeconds + 10)) * 100}%`,
                width: `${((phraseEndSeconds - phraseStartSeconds) / (sceneEndSeconds + 10)) * 100}%`,
              }}
            >
              <span className="youtube-timeline-label">Phrase</span>
            </div>
          </div>
          <div className="youtube-timeline-times">
            <span>{formatTime(sceneStartSeconds)}</span>
            <span>{formatTime(sceneEndSeconds)}</span>
          </div>
        </div>

        <div className="youtube-mode-switch">
          <button
            type="button"
            className="ghost-button"
            onClick={switchToApiMode}
          >
            🔄 IFrame API (точный контроль)
          </button>
        </div>
      </div>
    )
  }

  // === IFrame API-режим ===
  if (playerError) {
    return (
      <div className="youtube-error">
        <p>⚠️ {playerError}</p>
        <button
          type="button"
          className="youtube-retry-button"
          onClick={switchToIframeMode}
        >
          🔄 Вернуться на iframe-режим
        </button>
      </div>
    )
  }

  const videoDuration = duration || sceneEndSeconds + 10
  const isWithinScene = currentTime >= sceneStartSeconds && currentTime <= sceneEndSeconds
  const isWithinPhrase = currentTime >= phraseStartSeconds && currentTime <= phraseEndSeconds

  return (
    <div className="youtube-scene-player">
      <div className="youtube-player-container">
        <div ref={containerRef} />
        {!playerReady && (
          <div className="youtube-loading">
            Загрузка плеера...
          </div>
        )}
      </div>

      <div className="youtube-controls">
        <button
          type="button"
          className="youtube-play-button"
          onClick={isPlaying ? pauseVideo : playApiScene}
          disabled={!playerReady}
        >
          {isPlaying ? '⏸ Пауза' : '▶ Play Scene'}
        </button>

        <button
          type="button"
          className="youtube-replay-button"
          onClick={playApiScene}
          disabled={!playerReady}
        >
          🔄 Replay
        </button>
      </div>

      <div className="youtube-timeline">
        <div className="youtube-timeline-bar">
          <div
            className={`youtube-timeline-segment scene${isWithinScene ? ' active' : ''}`}
            style={{
              left: `${(sceneStartSeconds / videoDuration) * 100}%`,
              width: `${((sceneEndSeconds - sceneStartSeconds) / videoDuration) * 100}%`,
            }}
          >
            <span className="youtube-timeline-label">Scene</span>
          </div>
          <div
            className={`youtube-timeline-segment phrase${isWithinPhrase ? ' active' : ''}`}
            style={{
              left: `${(phraseStartSeconds / videoDuration) * 100}%`,
              width: `${((phraseEndSeconds - phraseStartSeconds) / videoDuration) * 100}%`,
            }}
          >
            <span className="youtube-timeline-label">Phrase</span>
          </div>
        </div>
        <div className="youtube-timeline-times">
          <span>{formatTime(sceneStartSeconds)}</span>
          <span>{formatTime(sceneEndSeconds)}</span>
        </div>
      </div>

      <div className="youtube-mode-switch">
        <button
          type="button"
          className="ghost-button"
          onClick={switchToIframeMode}
        >
          🔄 iframe (стабильный режим)
        </button>
      </div>
    </div>
  )
}
