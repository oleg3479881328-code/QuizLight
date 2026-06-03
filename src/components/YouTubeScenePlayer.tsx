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

export default function YouTubeScenePlayer({
  youtubeUrl,
  sceneStartSeconds,
  sceneEndSeconds,
  phraseStartSeconds,
  phraseEndSeconds,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const checkIntervalRef = useRef<number | null>(null)
  const [apiReady, setApiReady] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playerKey, setPlayerKey] = useState(0) // forces re-creation

  const videoId = extractYoutubeId(youtubeUrl)

  // Load IFrame API
  useEffect(() => {
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
  }, [])

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

  // Create player when API is ready or when playerKey changes
  useEffect(() => {
    if (!apiReady || !videoId || !containerRef.current) return

    // Destroy existing player if any
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
          } else if (event.data === YT.PlayerState.ENDED) {
            setIsPlaying(false)
            stopTimeCheck()
          } else if (event.data === YT.PlayerState.CUED) {
            // Video is cued and ready to play
          } else {
            setIsPlaying(false)
            stopTimeCheck()
          }
        },
        onError: (event: any) => {
          console.warn('YouTube player error:', event.data)
          // Error 5 (HTML5 player error) - recreate player on next play attempt
          if (event.data === 5 || event.data === 150) {
            setPlayerError('Ошибка плеера. Нажмите "Play Scene" для повторной попытки.')
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
  }, [apiReady, videoId, playerKey])

  const startTimeCheck = useCallback(() => {
    stopTimeCheck()
    checkIntervalRef.current = window.setInterval(() => {
      if (!playerRef.current) return
      try {
        const time = playerRef.current.getCurrentTime()
        setCurrentTime(time)

        // Auto-stop at scene end
        if (time >= sceneEndSeconds) {
          playerRef.current.stopVideo()
          stopTimeCheck()
        }
      } catch {
        // Player might not be ready
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

  function playScene() {
    if (!playerRef.current || !videoId) return

    setPlayerError(null)
    setIsPlaying(false)
    stopTimeCheck()

    // If player is not ready, recreate it
    if (!playerReady) {
      setPlayerKey((k) => k + 1)
      return
    }

    try {
      // Use cueVideoById first (more reliable than loadVideoById for replay)
      playerRef.current.cueVideoById({
        videoId,
        startSeconds: sceneStartSeconds,
      })

      // Small delay then play
      setTimeout(() => {
        try {
          playerRef.current.seekTo(sceneStartSeconds, true)
          playerRef.current.playVideo()
        } catch {
          // If this fails, recreate the player
          setPlayerKey((k) => k + 1)
        }
      }, 200)
    } catch (err) {
      console.warn('playScene failed, recreating player:', err)
      setPlayerKey((k) => k + 1)
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

  if (!videoId) {
    return (
      <div className="youtube-error">
        ⚠️ Неверный URL YouTube
      </div>
    )
  }

  if (playerError) {
    return (
      <div className="youtube-error">
        <p>⚠️ {playerError}</p>
        <button
          type="button"
          className="youtube-retry-button"
          onClick={() => {
            setPlayerError(null)
            setPlayerKey((k) => k + 1)
          }}
        >
          🔄 Перезагрузить плеер
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
          onClick={isPlaying ? pauseVideo : playScene}
          disabled={!playerReady}
        >
          {isPlaying ? '⏸ Пауза' : '▶ Play Scene'}
        </button>

        <button
          type="button"
          className="youtube-replay-button"
          onClick={playScene}
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
    </div>
  )
}
