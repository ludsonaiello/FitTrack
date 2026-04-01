import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// Routes that live on the bottom nav — switching between these is a tab transition
const TAB_PATHS = new Set(['/', '/exercises', '/planner', '/progress', '/profile'])

function pathDepth(pathname) {
  return pathname.split('/').filter(Boolean).length
}

function resolveDirection(prevPath, currPath) {
  if (prevPath === currPath) return 'fade'

  const prevTab = TAB_PATHS.has(prevPath)
  const currTab = TAB_PATHS.has(currPath)

  // Both are top-level tabs → crossfade
  if (prevTab && currTab) return 'fade'

  // Leaving a tab to drill deeper → push
  if (prevTab && !currTab) return 'push'

  // Returning to a tab → pop
  if (!prevTab && currTab) return 'pop'

  // Both are non-tab: compare path depth
  const diff = pathDepth(currPath) - pathDepth(prevPath)
  if (diff > 0) return 'push'
  if (diff < 0) return 'pop'
  return 'fade'
}

/**
 * Wraps <Routes> to play a directional CSS animation on every navigation.
 * The outer div is stable; the inner div is keyed by location.key so it
 * remounts (and re-animates) on every route change.
 */
export default function PageTransition({ children }) {
  const location = useLocation()
  const prevPathRef = useRef(location.pathname)
  const [direction, setDirection] = useState('fade')

  useEffect(() => {
    const prev = prevPathRef.current
    const curr = location.pathname
    if (prev === curr) return
    prevPathRef.current = curr
    setDirection(resolveDirection(prev, curr))
  }, [location.pathname])

  return (
    // Outer container — stable, clips overflowing slide content
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'clip',
      minHeight: 0,
    }}>
      {/* Inner container — remounts on each navigation, triggering the animation */}
      <div
        key={location.key}
        className={`pt-page pt-${direction}`}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        {children}
      </div>
    </div>
  )
}
