import { useRef, useEffect, useState } from 'react'
import { useStreak } from '../hooks/useStreak'
import { useParticles } from '../hooks/useParticles'

function getMode(value) {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'zero'
}

export default function DisplayPage() {
  const { streak, displayedStreak, message, loading } = useStreak()
  const canvasRef = useRef(null)
  const [timeLeft, setTimeLeft] = useState('')

  const mode = getMode(streak ?? 0)
  useParticles(canvasRef, mode)

  // Set body class for overflow
  useEffect(() => {
    document.body.classList.remove('admin-page')
    return () => {}
  }, [])

  // Timer until midnight
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      const midnight = new Date()
      midnight.setHours(24, 0, 0, 0)
      
      const diff = midnight - now
      if (diff <= 0) {
        setTimeLeft('00:00:00')
        return
      }
      
      const h = Math.floor(diff / (1000 * 60 * 60))
      const m = Math.floor((diff / (1000 * 60)) % 60)
      const s = Math.floor((diff / 1000) % 60)
      
      setTimeLeft(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      )
    }
    
    updateTimer() // initial call
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="display-root">
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="particle-canvas" />

      {/* Vignette */}
      <div className={`vignette ${mode}`} />

      {/* Main Content wrapper */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
        
        {/* Streak number */}
        <div className="streak-wrapper">
          {/* Glow aura */}
          <div className={`glow-aura ${mode}`} />

          {loading ? (
            <span className="loading-number">—</span>
          ) : (
            <span className={`streak-number ${mode}`}>
              {displayedStreak}
            </span>
          )}
        </div>

        {/* Exact timer */}
        {!loading && (
          <div className="exact-timer" style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '2rem',
            fontWeight: '600',
            letterSpacing: '0.1em',
            color: 'rgba(53, 44, 36, 0.7)',
            marginTop: '-1rem',
            animation: 'fadeIn 1s ease-out'
          }}>
            {timeLeft}
          </div>
        )}
      </div>

      {/* Custom Message */}
      {message && message.trim() !== '' && !loading && (
        <div className="custom-message">
          {message}
        </div>
      )}
    </div>
  )
}
