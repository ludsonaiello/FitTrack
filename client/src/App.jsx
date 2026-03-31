import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { Home, Dumbbell, PlayCircle, BarChart2, User } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Onboarding from './components/Onboarding.jsx'
import Dashboard from './pages/Dashboard'
import ExerciseLibrary from './pages/ExerciseLibrary'
import ExerciseDetail from './pages/ExerciseDetail'
import Planner from './pages/Planner'
import ActiveWorkout from './pages/ActiveWorkout'
import Progress from './pages/Progress'
import Profile from './pages/Profile'
import Login from './pages/Login'
import SessionDetail from './pages/SessionDetail'
import Sessions from './pages/Sessions'

function BottomNav() {
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
        {({isActive}) => <><User strokeWidth={isActive?2.5:1.8}/><span>Profile</span></>}
      </NavLink>
    </nav>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem('ft_onboarded'))

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

  // First-time user — show onboarding
  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />
  }

  // Authenticated
  return (
    <>
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
        {/* Redirect /login → / when already signed in */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*"      element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
