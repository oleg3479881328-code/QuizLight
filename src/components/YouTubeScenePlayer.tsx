import { useCallback, useEffect, useRef, useState } from 'react'
import { extractYoutubeId, formatTime } from '../lib/transcript'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const YT: any

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * Два режима:
 * 1. **IFrame API (основной)** — YT.Player создаётся один раз при загрузке API.
 *    При каждом Play Scene вызывается только loadVideoById() без stopVideo().
 *    Player не уничтожается и не пересоздаётся.
 *
 * 2. **<iframe> (запасной)** — простой embed без autoplay, пользователь запускает
 *    нативной кнопкой YouTube. Используется при ошибках API-режима.
 */
export default function YouTubeScenePlayer({
  youtubeUrl,
  sceneStartSeconds,
  sceneEndSeconds,
  phraseStartSeconds,
  phraseEndSeconds,
}: Props) {
  const videoId = extractYoutubeId(youtubeUrl)

  // === Режим: IFrame API (основной) ===
  const [useApi, setUseApi] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null)
  const checkIntervalRef = useRef<number | null>(null)
  const [apiReady, setApiReady] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // === Режим: iframe (запасной) ===
  const [iframeKey, setIframeKey] = useState(0)

  // Загружаем IFrame API при монтировании
  useEffect(() => {
    if (window.YT?.Player) {
      // API уже загружен — ставим флаг через микротаску, чтобы не было setState в эффекте
      queueMicrotask(() => setApiReady(true))
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
  }, [])

  // Создаём YT.Player один раз, когда API готов
  useEffect(() => {
    if (!apiReady || !videoId || !containerRef.current) return
    if (playerRef.current) return // уже создан

    const player = new YT.Player(containerRef.current, {
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
        playsinline: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          setPlayerReady(true)
          try {
            setDuration(player.getDuration())
          } catch {
            // ignore
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onStateChange: (event: any) => {
          if (event.data === YT.PlayerState.PLAYING) {
            setIsPlaying(true)
            startTimeCheck()
          } else if (event.data === YT.PlayerState.ENDED) {
            setIsPlaying(false)
            stopTimeCheck()
          } else {
            setIsPlaying(false)
            stopTimeCheck()
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (event: any) => {
          console.warn('YouTube player error:', event.data)
          if (event.data === 5) {
            setPlayerError('Ошибка HTML5-плеера. Попробуйте iframe-режим.')
            setPlayerReady(false)
          } else if (event.data === 2) {
            setPlayerError('Неверный ID видео.')
          } else if (event.data === 100) {
            setPlayerError('Видео недоступно.')
          } else if (event.data === 101 || event.data === 150) {
            setPlayerError('Владелец видео запретил встраивание.')
          } else if (event.data === 153) {
            setPlayerError('YouTube отклонил запрос: отсутствует идентификация страницы-источника.')
          }
        },
      },
    })
    playerRef.current = player
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, videoId])

  // Уничтожаем player при размонтировании
  useEffect(() => {
    return () => {
      stopTimeCheck()
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch { /* ignore */ }
        playerRef.current = null
      }
    }
  }, [])

  const startTimeCheck = useCallback(() => {
    stopTimeCheck()

    // Защита: если таймкоды некорректные, не запускаем авто-остановку
    const sceneDuration = sceneEndSeconds - sceneStartSeconds
    if (sceneEndSeconds <= sceneStartSeconds || sceneDuration < 1) {
      console.warn('YouTubeScenePlayer: некорректные таймкоды сцены, авто-остановка отключена', {
        sceneStartSeconds,
        sceneEndSeconds,
        sceneDuration,
      })
      return
    }

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
  }, [sceneEndSeconds, sceneStartSeconds])

  function stopTimeCheck() {
    if (checkIntervalRef.current !== null) {
      clearInterval(checkIntervalRef.current)
      checkIntervalRef.current = null
    }
  }

  // === API-режим: Play Scene ===
  function playApiScene() {
    if (!playerRef.current || !videoId) return

    console.log('YouTube scene playback diagnostic', {
      videoId,
      sceneStartSeconds,
      sceneEndSeconds,
      duration: sceneEndSeconds - sceneStartSeconds,
    })

    setPlayerError(null)
    setIsPlaying(false)
    stopTimeCheck()

    try {
      playerRef.current.setVolume(100)
      playerRef.current.unMute()
      playerRef.current.loadVideoById({
        videoId,
        startSeconds: sceneStartSeconds,
        endSeconds: sceneEndSeconds,
      })
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

  function switchToIframeMode() {
    setUseApi(false)
    setPlayerError(null)
  }

  function switchToApiMode() {
    setUseApi(true)
    setPlayerError(null)
  }

  if (!videoId) {
    return (
      <div className="youtube-error">
        ⚠️ Неверный URL YouTube
      </div>
    )
  }

  // === Запасной iframe-режим ===
  if (!useApi) {
    const iframeSrc = `https://www.youtube.com/embed/${videoId}`
      + `?start=${Math.floor(sceneStartSeconds)}`
      + `&end=${Math.floor(sceneEndSeconds)}`
      + `&rel=0`
      + `&modestbranding=1`
      + `&iv_load_policy=3`
      + `&controls=1`
      + `&origin=${encodeURIComponent(window.location.origin)}`

    return (
      <div className="youtube-scene-player">
        <div className="youtube-player-container">
          <iframe
            key={iframeKey}
            width="100%"
            height="100%"
            src={iframeSrc}
            allow="encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ border: 'none' }}
          />
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
            onClick={() => { setIframeKey((k) => k + 1); switchToApiMode() }}
          >
            🔄 IFrame API (точный контроль)
          </button>
        </div>
      </div>
    )
  }

  // === API-режим: ошибка ===
  if (playerError) {
    return (
      <div className="youtube-error">
        <p>⚠️ {playerError}</p>
        <button
          type="button"
          className="youtube-retry-button"
          onClick={switchToIframeMode}
        >
          🔄 iframe (запасной режим)
        </button>
      </div>
    )
  }

  // === API-режим: нормальный рендер ===
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
          🔄 iframe (запасной режим)
        </button>
      </div>
    </div>
  )
}
