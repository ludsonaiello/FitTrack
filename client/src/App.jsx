import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { Home, Dumbbell, PlayCircle, BarChart2, User, WifiOff } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { db } from './db/index.js'
import Onboarding from './components/Onboarding.jsx'
import SyncBadge from './components/SyncBadge.jsx'
import { useSyncQueue } from './hooks/useSyncQueue.js'
import Dashboard from './pages/Dashboard'
import ExerciseLibrary from './pages/ExerciseLibrary'
import ExerciseDetail from './pages/ExerciseDetail'
import Planner from './pages/Planner'
import ActiveWorkout from './pages/ActiveWorkout'
import Progress from './pages/Progress'
import Profile from './pages/Profile'
import Login from './pages/Login'
import OAuthLogin from './pages/OAuthLogin'
import SessionDetail from './pages/SessionDetail'
import Sessions from './pages/Sessions'
import Admin from './pages/Admin'
import Privacy from './pages/Privacy'

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: '6px 16px',
      fontSize: '0.8rem', fontWeight: 600, color: 'var(--text3)',
    }}>
      <WifiOff size={14} /> Offline — showing cached data
    </div>
  )
}

function AdminGuard() {
  const { user } = useAuth()
  if (!user?.isAdmin) return <Navigate to="/" replace />
  return <Admin />
}

function BottomNav({ syncStats, syncRetry }) {
  const loc = useLocation()
  if (loc.pathname.startsWith('/workout/active')) return null
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        {({isActive}) => <><Home strokeWidth={isActive?2.5:1.8}/><span>Home</span></>}
      </NavLink>
      <NavLink to="/exercises">
        {({isActive}) => <><Dumbbell strokeWidth={isActive?2.5:1.8}/><span>Exercises</span></>}
      </NavLink>
      <NavLink to="/planner">
        {({isActive}) => <><PlayCircle strokeWidth={isActive?2.5:1.8}/><span>Plan</span></>}
      </NavLink>
      <NavLink to="/progress">
        {({isActive}) => <><BarChart2 strokeWidth={isActive?2.5:1.8}/><span>Progress</span></>}
      </NavLink>
      <NavLink to="/profile">
        {({isActive}) => (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <User strokeWidth={isActive?2.5:1.8}/>
            <span>Profile</span>
            {syncStats && (
              <div style={{ position: 'absolute', top: -4, right: -8 }}>
                <SyncBadge stats={syncStats} retry={syncRetry} />
              </div>
            )}
          </div>
        )}
      </NavLink>
    </nav>
  )
}

function AuthenticatedApp() {
  const { user } = useAuth()
  const [onboarded, setOnboarded] = useState(() => !!user?.onboarded)
  const { stats: syncStats, retry: syncRetry } = useSyncQueue()

  // Clear IndexedDB when a different user logs in on the same browser.
  // This prevents stale data from a previous account leaking through.
  useEffect(() => {
    const storedId = localStorage.getItem('ft_user_id')
    if (storedId && storedId !== user.id) {
      // Different user — wipe all local data
      db.plans.clear()
      db.planDays.clear()
      db.planExercises.clear()
      db.sessions.clear()
      db.exerciseSets.clear()
      db.bodyWeights.clear()
      db.goals.clear()
      db.syncQueue.clear()
      localStorage.removeItem('ft_onboarded')
      localStorage.removeItem('ft_name')
      localStorage.removeItem('ft_weight_unit')
    }
    localStorage.setItem('ft_user_id', user.id)
  }, [user.id])

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />
  }

  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/"                          element={<Dashboard />} />
        <Route path="/exercises"                 element={<ExerciseLibrary />} />
        <Route path="/exercises/:id"             element={<ExerciseDetail />} />
        <Route path="/planner"                   element={<Planner />} />
        <Route path="/workout/active/:sessionId"  element={<ActiveWorkout />} />
        <Route path="/workout/session/:sessionId" element={<SessionDetail />} />
        <Route path="/workout/sessions"           element={<Sessions />} />
        <Route path="/progress"                  element={<Progress />} />
        <Route path="/profile"                   element={<Profile />} />
        <Route path="/admin"                     element={<AdminGuard />} />
        {/* Redirect /login → / when already signed in */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*"      element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav syncStats={syncStats} syncRetry={syncRetry} />
    </>
  )
}

function AppRoutes() {
  const { user } = useAuth()

  // Checking cookie session — show blank to avoid flash
  if (user === undefined) {
    return <div style={{ minHeight: '100dvh', background: 'var(--bg)' }} />
  }

  // Not authenticated — only /login is accessible
  if (user === null) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Authenticated — sync queue is only mounted after auth is confirmed
  return <AuthenticatedApp />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Always public — rendered before auth check */}
          <Route path="/oauth-login" element={<OAuthLogin />} />
          <Route path="/privacy"     element={<Privacy />} />
          <Route path="*"            element={<AppRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
