import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'

/**
 * Spring-based count interpolation hook.
 * Animates from current displayed value toward target using spring physics.
 */
function useSpringCounter(target) {
  const [displayed, setDisplayed] = useState(target)
  const animRef = useRef(null)
  const stateRef = useRef({ pos: target, vel: 0, target })

  useEffect(() => {
    stateRef.current.target = target

    const stiffness = 140
    const damping = 18
    const mass = 1
    const dt = 1 / 60

    function step() {
      const s = stateRef.current
      const dist = s.target - s.pos
      const springForce = stiffness * dist
      const dampForce = damping * s.vel
      const acc = (springForce - dampForce) / mass
      s.vel += acc * dt
      s.pos += s.vel * dt

      const displayVal = Math.round(s.pos)
      setDisplayed(displayVal)

      if (Math.abs(dist) < 0.01 && Math.abs(s.vel) < 0.01) {
        s.pos = s.target
        s.vel = 0
        setDisplayed(s.target)
        return
      }
      animRef.current = requestAnimationFrame(step)
    }

    cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animRef.current)
  }, [target])

  return displayed
}

export function useStreak() {
  const [streak, setStreak] = useState(null)
  const [message, setMessage] = useState('')
  const [autoConfig, setAutoConfig] = useState({ enabled: false, direction: 1, lastUpdate: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const displayedStreak = useSpringCounter(streak ?? 0)

  // Fetch initial value
  useEffect(() => {
    async function fetchStreak() {
      const { data, error } = await supabase
        .from('streak_data')
        .select('value, message, auto_mode_enabled, auto_mode_direction, last_auto_update_date')
        .eq('id', 1)
        .single()
      if (error) {
        setError(error.message)
      } else {
        let currentStreak = data.value
        const isAutoEnabled = !!data.auto_mode_enabled
        const autoDirection = data.auto_mode_direction ?? 1
        let lastAutoUpdate = data.last_auto_update_date

        let shouldUpdateDb = false

        if (isAutoEnabled && lastAutoUpdate) {
          const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
          if (lastAutoUpdate !== today) {
            const lastDate = new Date(lastAutoUpdate)
            const currentDate = new Date(today)
            const diffTime = currentDate - lastDate
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
            
            if (diffDays > 0) {
              currentStreak = currentStreak + (diffDays * autoDirection)
              lastAutoUpdate = today
              shouldUpdateDb = true
            } else if (diffDays < 0) {
              lastAutoUpdate = today
              shouldUpdateDb = true
            }
          }
        }

        setStreak(currentStreak)
        setMessage(data.message || '')
        setAutoConfig({ enabled: isAutoEnabled, direction: autoDirection, lastUpdate: lastAutoUpdate })

        if (shouldUpdateDb) {
          supabase.from('streak_data').update({
            value: currentStreak,
            last_auto_update_date: lastAutoUpdate
          }).eq('id', 1).then() // Fire and forget update
        }
      }
      setLoading(false)
    }
    fetchStreak()
  }, [])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('streak-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'streak_data', filter: 'id=eq.1' },
        (payload) => {
          setStreak(payload.new.value)
          setMessage(payload.new.message || '')
          setAutoConfig({
            enabled: !!payload.new.auto_mode_enabled,
            direction: payload.new.auto_mode_direction ?? 1,
            lastUpdate: payload.new.last_auto_update_date
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Update streak value in DB
  const updateStreak = useCallback(async (newValue) => {
    const { error } = await supabase
      .from('streak_data')
      .update({ value: newValue })
      .eq('id', 1)
    if (error) throw error
    // Optimistically update local state too (realtime will confirm)
    setStreak(newValue)
  }, [])

  const updateMessage = useCallback(async (newMessage) => {
    const { error } = await supabase
      .from('streak_data')
      .update({ message: newMessage })
      .eq('id', 1)
    if (error) throw error
    setMessage(newMessage)
  }, [])

  const updateStreakAndAuto = useCallback(async (newStreak, newDirection) => {
    // Only update direction if auto mode is on (so manual toggles during off mode don't change anything? 
    // Wait, requirement: "When I manually press a button while auto mode is on, the auto direction updates")
    const { error } = await supabase
      .from('streak_data')
      .update({ 
        value: newStreak, 
        ...(autoConfig.enabled ? { auto_mode_direction: newDirection } : {}) 
      })
      .eq('id', 1)
    if (error) throw error
    setStreak(newStreak)
    if (autoConfig.enabled) {
      setAutoConfig(prev => ({ ...prev, direction: newDirection }))
    }
  }, [autoConfig.enabled])

  const toggleAutoMode = useCallback(async (enabled, currentStreak) => {
    const today = new Date().toLocaleDateString('en-CA')
    const direction = currentStreak > 0 ? 1 : -1
    const { error } = await supabase
      .from('streak_data')
      .update({
        auto_mode_enabled: enabled,
        auto_mode_direction: direction,
        last_auto_update_date: today
      })
      .eq('id', 1)
    if (error) throw error
    setAutoConfig({ enabled, direction, lastUpdate: today })
  }, [])

  return { 
    streak, displayedStreak, message, autoConfig, loading, error, 
    updateStreak, updateMessage, updateStreakAndAuto, toggleAutoMode 
  }
}
