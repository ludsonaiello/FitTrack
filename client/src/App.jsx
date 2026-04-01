import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { Home, Dumbbell, PlayCircle, BarChart2, User, WifiOff, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { NumericKeyboardProvider } from './context/NumericKeyboardContext.jsx'
import NumericKeyboard from './components/NumericKeyboard.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import ToastRenderer from './components/Toast.jsx'
import PageTransition from './components/PageTransition.jsx'
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
import LoadingScreen from './components/LoadingScreen'
import OAuthLogin from './pages/OAuthLogin'
import SessionDetail from './pages/SessionDetail'
import Sessions from './pages/Sessions'
import Admin from './pages/Admin'
import Privacy from './pages/Privacy'
import PersonalRecords from './pages/PersonalRecords'

function OfflineBannerText() {
  const { t } = useTranslation()
  return <>{t('dashboard.offline_banner')}</>
}

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
      <WifiOff size={14} /> <OfflineBannerText />
    </div>
  )
}

function AdminGuard() {
  const { user } = useAuth()
  if (!user?.isAdmin) return <Navigate to="/" replace />
  return <Admin />
}

function AdminBadge() {
  const { user } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  if (!user?.isAdmin) return null
  if (loc.pathname.startsWith('/workout/active')) return null
  return createPortal(
    <button
      onClick={() => nav('/admin')}
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        right: 14,
        zIndex: 9000,
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'var(--accent)', color: '#000',
        border: 'none', borderRadius: 100,
        padding: '5px 11px 5px 8px',
        fontFamily: 'Barlow Condensed', fontWeight: 800,
        fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase',
        cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Shield size={13} strokeWidth={2.5} />
      Admin
    </button>,
    document.body
  )
}

function BottomNav({ syncStats, syncRetry }) {
  const loc = useLocation()
  const { t } = useTranslation()
  if (loc.pathname.startsWith('/workout/active')) return null
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        {({isActive}) => <><Home strokeWidth={isActive?2.5:1.8}/><span>{t('nav.home')}</span></>}
      </NavLink>
      <NavLink to="/exercises">
        {({isActive}) => <><Dumbbell strokeWidth={isActive?2.5:1.8}/><span>{t('nav.exercises')}</span></>}
      </NavLink>
      <NavLink to="/planner">
        {({isActive}) => <><PlayCircle strokeWidth={isActive?2.5:1.8}/><span>{t('nav.plan')}</span></>}
      </NavLink>
      <NavLink to="/progress">
        {({isActive}) => <><BarChart2 strokeWidth={isActive?2.5:1.8}/><span>{t('nav.progress')}</span></>}
      </NavLink>
      <NavLink to="/profile">
        {({isActive}) => (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <User strokeWidth={isActive?2.5:1.8}/>
            <span>{t('nav.profile')}</span>
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
  // Start with the cached value; sync up if the server confirms onboarded=true
  const [onboarded, setOnboarded] = useState(() => !!user?.onboarded)
  useEffect(() => {
    if (user?.onboarded) setOnboarded(true)
  }, [user?.onboarded])
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
      localStorage.removeItem('ft_user_cache')
    }
    localStorage.setItem('ft_user_id', user.id)
  }, [user.id])

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />
  }

  return (
    <>
      <OfflineBanner />
      <AdminBadge />
      <PageTransition>
        <Routes>
          <Route path="/"                          element={<Dashboard />} />
          <Route path="/exercises"                 element={<ExerciseLibrary />} />
          <Route path="/exercises/:id"             element={<ExerciseDetail />} />
          <Route path="/planner"                   element={<Planner />} />
          <Route path="/workout/active/:sessionId"  element={<ActiveWorkout />} />
          <Route path="/workout/session/:sessionId" element={<SessionDetail />} />
          <Route path="/workout/sessions"           element={<Sessions />} />
          <Route path="/progress"                  element={<Progress />} />
          <Route path="/progress/personal-records" element={<PersonalRecords />} />
          <Route path="/profile"                   element={<Profile />} />
          <Route path="/admin"                     element={<AdminGuard />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*"      element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>
      <BottomNav syncStats={syncStats} syncRetry={syncRetry} />
    </>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  const [showLoader, setShowLoader] = useState(false)

  // Re-check the flag whenever user becomes authenticated.
  // useState initializer only runs once (at mount when user may be null),
  // so we need this effect to catch the logoff → login transition.
  useEffect(() => {
    if (user && sessionStorage.getItem('ft_show_loader')) {
      setShowLoader(true)
    }
  }, [user])

  const handleLoaderDone = useCallback(() => {
    sessionStorage.removeItem('ft_show_loader')
    setShowLoader(false)
  }, [])

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

  // Show loading screen on fresh login/register (not on cached session reload)
  if (showLoader) {
    return <LoadingScreen onDone={handleLoaderDone} userName={user?.name} />
  }

  // Authenticated — sync queue is only mounted after auth is confirmed
  return <AuthenticatedApp />
}

export default function App() {
  return (
    <ToastProvider>
      <ToastRenderer />
      <NumericKeyboardProvider>
        <NumericKeyboard />
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
      </NumericKeyboardProvider>
    </ToastProvider>
  )
}
