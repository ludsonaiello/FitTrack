import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, Dumbbell, RotateCcw, Trash2, Plus, Search, ChevronLeft, ChevronRight, Shield, Upload, Link, Image, Video, X } from 'lucide-react'
import { api, apiUpload, BASE } from '../lib/api.js'
import ConfirmModal from '../components/ConfirmModal.jsx'

async function uploadFile(type, file) {
  const form = new FormData()
  form.append('file', file)
  const json = await apiUpload(`/api/admin/upload/${type}`, form)
  return json.data.url
}

// ── MultiSelect ───────────────────────────────────────────────────────────────

function MultiSelect({ label, values, onChange, options }) {
  const [q, setQ]         = useState('')
  const [open, setOpen]   = useState(false)
  const containerRef      = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const qLower    = q.trim().toLowerCase()
  const filtered  = options.filter(o => o.toLowerCase().includes(qLower) && !values.includes(o))
  const canAddNew = qLower.length > 0 && !options.some(o => o.toLowerCase() === qLower) && !values.includes(q.trim())

  function select(val) {
    onChange([...values, val])
    setQ('')
  }

  function remove(val) {
    onChange(values.filter(v => v !== val))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) { select(filtered[0]); return }
      if (canAddNew) { select(q.trim()); return }
    }
    if (e.key === 'Escape') { setOpen(false); setQ('') }
  }

  const labelStyle = { fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',display:'block',marginBottom:6 }

  return (
    <div style={{marginBottom:10}} ref={containerRef}>
      <label style={labelStyle}>{label}</label>

      {/* Selected tags */}
      {values.length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:6}}>
          {values.map(v => (
            <span key={v} style={{
              display:'inline-flex',alignItems:'center',gap:4,
              background:'var(--accent)',color:'#000',
              fontSize:'0.72rem',fontWeight:700,fontFamily:'Barlow Condensed',
              padding:'2px 8px',borderRadius:20,
            }}>
              {v}
              <button type="button" onClick={() => remove(v)} style={{background:'none',border:'none',cursor:'pointer',color:'#000',padding:0,lineHeight:1,fontSize:'0.8rem'}}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div style={{position:'relative'}}>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={`Search or add ${label.toLowerCase()}…`}
          style={{width:'100%',boxSizing:'border-box'}}
        />

        {open && (filtered.length > 0 || canAddNew) && (
          <div style={{
            position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:50,
            background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,
            maxHeight:200,overflowY:'auto',boxShadow:'0 4px 20px rgba(0,0,0,0.4)',
          }}>
            {filtered.map(opt => (
              <div
                key={opt}
                onMouseDown={e => { e.preventDefault(); select(opt) }}
                style={{padding:'9px 12px',cursor:'pointer',fontSize:'0.85rem'}}
                onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                {opt}
              </div>
            ))}
            {canAddNew && (
              <div
                onMouseDown={e => { e.preventDefault(); select(q.trim()) }}
                style={{
                  padding:'9px 12px',cursor:'pointer',fontSize:'0.85rem',
                  borderTop: filtered.length > 0 ? '1px solid var(--border)' : 'none',
                  color:'var(--accent)',fontWeight:600,
                }}
                onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}
              >
                + Add "{q.trim()}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({ children, color = 'var(--accent)' }) {
  return (
    <span style={{
      display:'inline-block', padding:'1px 7px', borderRadius:20,
      background: color, color:'#000',
      fontSize:'0.65rem', fontWeight:800, fontFamily:'Barlow Condensed', letterSpacing:'0.08em',
    }}>{children}</span>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [resetting, setResetting]   = useState(null)   // userId being reset
  const [tempPw, setTempPw]         = useState(null)   // { userId, email, password }
  const [confirmReset, setConfirmReset] = useState(null) // userId

  useEffect(() => {
    api.get('/api/admin/users')
      .then(r => setUsers(r.data || []))
      .finally(() => setLoading(false))
  }, [])

  async function resetPassword(userId) {
    setResetting(userId)
    try {
      const r = await api.post(`/api/admin/users/${userId}/reset-password`)
      const user = users.find(u => u.id === userId)
      setTempPw({ userId, email: user?.email, password: r.data.tempPassword })
    } finally {
      setResetting(null)
      setConfirmReset(null)
    }
  }

  if (loading) return <div style={{color:'var(--text3)',textAlign:'center',padding:40}}>Loading…</div>

  return (
    <div>
      {confirmReset && (
        <ConfirmModal
          title="Reset password?"
          message={`This will generate a new temporary password for ${users.find(u => u.id === confirmReset)?.email} and invalidate their current session.`}
          confirmLabel="Reset"
          onConfirm={() => resetPassword(confirmReset)}
          onCancel={() => setConfirmReset(null)}
        />
      )}

      {tempPw && (
        <div style={{
          background:'var(--surface2)', border:'1px solid var(--accent)', borderRadius:12,
          padding:'14px 16px', marginBottom:16,
        }}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:800,marginBottom:6}}>
            Temporary password for {tempPw.email}
          </div>
          <div style={{fontFamily:'monospace',fontSize:'1rem',color:'var(--accent)',letterSpacing:'0.08em',marginBottom:8}}>
            {tempPw.password}
          </div>
          <div style={{fontSize:'0.72rem',color:'var(--text3)',marginBottom:10}}>
            Copy this now — it will not be shown again.
          </div>
          <button className="btn btn-ghost" style={{fontSize:'0.8rem',padding:'6px 12px'}} onClick={() => setTempPw(null)}>
            Done
          </button>
        </div>
      )}

      <div style={{fontSize:'0.7rem',color:'var(--text3)',marginBottom:12}}>{users.length} users total</div>

      {users.map(u => (
        <div key={u.id} className="card" style={{marginBottom:10,padding:'12px 14px'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:3}}>
                <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:'0.95rem'}}>{u.name}</span>
                {u.isAdmin && <Badge>ADMIN</Badge>}
              </div>
              <div style={{fontSize:'0.78rem',color:'var(--text3)',marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {u.email}
              </div>
              <div style={{display:'flex',gap:14,fontSize:'0.7rem',color:'var(--text3)'}}>
                <span>{u._count.sessions} sessions</span>
                <span>{u._count.bodyWeights} weigh-ins</span>
                <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <button
              className="btn btn-ghost"
              style={{flexShrink:0,padding:'6px 10px',fontSize:'0.75rem',gap:5,color:'var(--text3)'}}
              disabled={resetting === u.id}
              onClick={() => setConfirmReset(u.id)}
              title="Reset password"
            >
              <RotateCcw size={13}/> Reset pw
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── ImageThumb — tiny preview with fallback ───────────────────────────────────

function ImageThumb({ src }) {
  const [err, setErr] = useState(false)
  useEffect(() => setErr(false), [src])
  if (err) return (
    <div style={{
      height:48, width:64, borderRadius:6, border:'1px solid var(--border)',
      background:'var(--surface2)', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:2,
    }}>
      <Image size={16} color="var(--text3)" />
      <span style={{fontSize:'0.6rem',color:'var(--text3)'}}>saved</span>
    </div>
  )
  return (
    <img src={src} alt="" onError={() => setErr(true)}
      style={{height:48,borderRadius:6,objectFit:'cover',border:'1px solid var(--border)',flexShrink:0}} />
  )
}

// ── MediaField — URL input or file upload toggle ──────────────────────────────

function MediaField({ label, value, onChange, uploadType, accept, Icon }) {
  const [mode, setMode]         = useState('url')
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [localPreview, setLocalPreview] = useState(null)
  const inputRef = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Show local preview immediately — avoids cross-origin img load
    if (uploadType === 'image') {
      const prev = URL.createObjectURL(file)
      setLocalPreview(prev)
    }
    setUploading(true); setUploadErr('')
    try {
      const url = await uploadFile(uploadType, file)
      onChange(url)
    } catch (err) {
      setUploadErr(err.message)
      setLocalPreview(null)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // Clean up object URL when value is cleared or component unmounts
  useEffect(() => {
    if (!value) setLocalPreview(null)
    return () => { if (localPreview) URL.revokeObjectURL(localPreview) }
  }, [value])

  const labelStyle = { fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',display:'block',marginBottom:6 }

  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
        <label style={{...labelStyle,marginBottom:0,display:'flex',alignItems:'center',gap:5}}>
          <Icon size={12}/> {label}
        </label>
        <div style={{display:'flex',gap:4}}>
          {[{id:'url',icon:<Link size={11}/>,text:'URL'},{id:'upload',icon:<Upload size={11}/>,text:'Upload'}].map(({id,icon,text}) => (
            <button
              key={id} type="button"
              onClick={() => { setMode(id); setUploadErr('') }}
              style={{
                display:'flex',alignItems:'center',gap:4,
                padding:'3px 8px', borderRadius:6, fontSize:'0.68rem', fontWeight:700,
                border: mode===id ? 'none' : '1px solid var(--border)',
                background: mode===id ? 'var(--accent)' : 'var(--surface2)',
                color: mode===id ? '#000' : 'var(--text3)',
                cursor:'pointer',
              }}
            >{icon}{text}</button>
          ))}
        </div>
      </div>

      {mode === 'url' ? (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://…"
          style={{width:'100%',boxSizing:'border-box'}}
        />
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          style={{
            border:'2px dashed var(--border)', borderRadius:10,
            padding:'16px', textAlign:'center', cursor: uploading ? 'wait' : 'pointer',
            background:'var(--surface2)',
          }}
        >
          <input ref={inputRef} type="file" accept={accept} style={{display:'none'}} onChange={handleFile} />
          {uploading
            ? <div style={{fontSize:'0.8rem',color:'var(--text3)'}}>Uploading…</div>
            : <div style={{fontSize:'0.8rem',color:'var(--text3)'}}>
                <Upload size={18} style={{display:'block',margin:'0 auto 6px'}}/> Tap to choose file
              </div>
          }
        </div>
      )}

      {uploadErr && <div style={{fontSize:'0.72rem',color:'var(--accent2)',marginTop:4}}>{uploadErr}</div>}

      {value && (
        <div style={{marginTop:6,display:'flex',alignItems:'center',gap:6}}>
          {uploadType === 'image'
            ? <ImageThumb src={localPreview || value} />
            : <div style={{fontSize:'0.7rem',color:'var(--accent)',fontFamily:'monospace',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{value}</div>
          }
          <button type="button" onClick={() => onChange('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:2,flexShrink:0}}>
            <X size={13}/>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Exercise form ─────────────────────────────────────────────────────────────

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']

const EMPTY_FORM = {
  name: '', experienceLevel: 'BEGINNER', type: 'TUTORIAL',
  equipment: [], focusArea: [], imageUrl: '', mediaUrl: '', tips: '',
}

function toArrayForm(ex) {
  return {
    ...ex,
    equipment: Array.isArray(ex.equipment) ? ex.equipment : ex.equipment.split(',').map(s => s.trim()).filter(Boolean),
    focusArea: Array.isArray(ex.focusArea)  ? ex.focusArea  : ex.focusArea.split(',').map(s => s.trim()).filter(Boolean),
    tips: Array.isArray(ex.tips) ? ex.tips.join('\n') : ex.tips,
  }
}

function ExerciseForm({ initial = EMPTY_FORM, onSave, onCancel, saving, meta }) {
  const [form, setForm] = useState(() => toArrayForm(initial))

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      name: form.name.trim(),
      type: form.type.trim() || 'TUTORIAL',
      experienceLevel: form.experienceLevel,
      equipment: form.equipment,
      focusArea: form.focusArea,
      imageUrl: form.imageUrl.trim(),
      mediaUrl: form.mediaUrl.trim(),
      tips: form.tips.split('\n').map(s => s.trim()).filter(Boolean),
    })
  }

  const fieldStyle = { width:'100%', marginBottom:10, boxSizing:'border-box' }
  const labelStyle = { fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',display:'block',marginBottom:4 }

  return (
    <form onSubmit={handleSubmit}>
      <label style={labelStyle}>Name *</label>
      <input style={fieldStyle} value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Incline Dumbbell Press" />

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        <div>
          <label style={labelStyle}>Level *</label>
          <select style={{width:'100%'}} value={form.experienceLevel} onChange={e => set('experienceLevel', e.target.value)}>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Type</label>
          <input style={{width:'100%'}} value={form.type} onChange={e => set('type', e.target.value)} placeholder="TUTORIAL" />
        </div>
      </div>

      <MultiSelect
        label="Equipment"
        values={form.equipment}
        onChange={v => set('equipment', v)}
        options={meta?.equipment ?? []}
      />
      <MultiSelect
        label="Focus Area"
        values={form.focusArea}
        onChange={v => set('focusArea', v)}
        options={meta?.focusArea ?? []}
      />

      <MediaField
        label="Image" uploadType="image"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        Icon={Image}
        value={form.imageUrl}
        onChange={v => set('imageUrl', v)}
      />
      <MediaField
        label="Video" uploadType="video"
        accept="video/mp4,video/webm,video/quicktime"
        Icon={Video}
        value={form.mediaUrl}
        onChange={v => set('mediaUrl', v)}
      />

      <label style={labelStyle}>Tips (one per line)</label>
      <textarea
        style={{...fieldStyle, height:80, resize:'vertical', fontFamily:'inherit', fontSize:'0.85rem'}}
        value={form.tips}
        onChange={e => set('tips', e.target.value)}
        placeholder="Keep elbows at 45°&#10;Control the descent"
      />

      <div style={{display:'flex',gap:8,marginTop:4}}>
        <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()} style={{flex:1}}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} style={{flex:1}}>Cancel</button>
      </div>
    </form>
  )
}

// ── Exercises tab ─────────────────────────────────────────────────────────────

function ExercisesTab() {
  const [exercises, setExercises] = useState([])
  const [meta, setMeta]           = useState({ total: 0, page: 1, limit: 50 })
  const [exerciseMeta, setExerciseMeta] = useState({ equipment: [], focusArea: [] })
  const [q, setQ]                 = useState('')
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [editing, setEditing]     = useState(null)   // exercise object
  const [saving, setSaving]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // exercise id
  const [error, setError]         = useState('')

  const load = useCallback((page = 1, search = q) => {
    setLoading(true)
    const params = new URLSearchParams({ page, limit: 50 })
    if (search) params.set('q', search)
    api.get(`/api/admin/exercises?${params}`)
      .then(r => { setExercises(r.data || []); setMeta(r.meta || { total: 0, page, limit: 50 }) })
      .finally(() => setLoading(false))
  }, [q])

  useEffect(() => {
    load(1, '')
    api.get('/api/admin/exercise-meta').then(r => setExerciseMeta(r.data || { equipment: [], focusArea: [] })).catch(() => {})
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    load(1, q)
  }

  async function handleAdd(data) {
    setSaving(true); setError('')
    try {
      await api.post('/api/admin/exercises', data)
      setShowAdd(false)
      load(1, q)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleEdit(data) {
    setSaving(true); setError('')
    try {
      await api.patch(`/api/admin/exercises/${editing.id}`, data)
      setEditing(null)
      load(meta.page, q)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/api/admin/exercises/${id}`)
      setConfirmDelete(null)
      load(meta.page, q)
    } catch (e) { setError(e.message) }
  }

  const totalPages = Math.ceil(meta.total / meta.limit)

  return (
    <div>
      {confirmDelete && (
        <ConfirmModal
          title="Delete exercise?"
          message="This will permanently delete the exercise. Existing plans referencing it will keep their data but the exercise name will no longer resolve."
          confirmLabel="Delete"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <form onSubmit={handleSearch} style={{display:'flex',gap:8,flex:1}}>
          <div style={{position:'relative',flex:1}}>
            <Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--text3)'}}/>
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search exercises…"
              style={{width:'100%',paddingLeft:32,boxSizing:'border-box'}}
            />
          </div>
          <button type="submit" className="btn btn-ghost" style={{padding:'8px 12px'}}>Search</button>
        </form>
        <button className="btn btn-primary" onClick={() => { setShowAdd(true); setEditing(null) }} style={{padding:'8px 12px',gap:6}}>
          <Plus size={14}/> Add
        </button>
      </div>

      {error && <div style={{fontSize:'0.75rem',color:'var(--accent2)',marginBottom:10}}>{error}</div>}

      {(showAdd && !editing) && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:'1rem',marginBottom:12}}>New Exercise</div>
          <ExerciseForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} meta={exerciseMeta} />
        </div>
      )}

      <div style={{fontSize:'0.7rem',color:'var(--text3)',marginBottom:10}}>
        {meta.total} exercises · page {meta.page} of {totalPages || 1}
      </div>

      {loading
        ? <div style={{color:'var(--text3)',textAlign:'center',padding:40}}>Loading…</div>
        : exercises.map(ex => (
          <div key={ex.id}>
            {editing?.id === ex.id ? (
              <div className="card" style={{marginBottom:10}}>
                <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:'1rem',marginBottom:12}}>Edit: {ex.name}</div>
                <ExerciseForm
                  initial={ex}
                  onSave={handleEdit}
                  onCancel={() => setEditing(null)}
                  saving={saving}
                  meta={exerciseMeta}
                />
              </div>
            ) : (
              <div className="card" style={{marginBottom:8,padding:'10px 14px'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:'Barlow Condensed',fontWeight:700,marginBottom:3}}>{ex.name}</div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      <Badge color="var(--surface2)">{ex.experienceLevel}</Badge>
                      {ex.focusArea.slice(0,3).map(f => <Badge key={f} color="var(--surface2)">{f}</Badge>)}
                      {ex.equipment.slice(0,2).map(e => <Badge key={e} color="rgba(232,255,0,0.15)">{e}</Badge>)}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,flexShrink:0}}>
                    <button onClick={() => { setEditing(ex); setShowAdd(false) }} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:4}}>
                      ✏️
                    </button>
                    <button onClick={() => setConfirmDelete(ex.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:4}}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      }

      {totalPages > 1 && (
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:12,marginTop:16}}>
          <button className="btn btn-ghost" style={{padding:'6px 10px'}} disabled={meta.page <= 1} onClick={() => load(meta.page - 1)}>
            <ChevronLeft size={15}/>
          </button>
          <span style={{fontSize:'0.8rem',color:'var(--text3)'}}>Page {meta.page} of {totalPages}</span>
          <button className="btn btn-ghost" style={{padding:'6px 10px'}} disabled={meta.page >= totalPages} onClick={() => load(meta.page + 1)}>
            <ChevronRight size={15}/>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Admin page ───────────────────────────────────────────────────────────

export default function Admin() {
  const [tab, setTab] = useState('users')

  const tabs = [
    { id: 'users',     label: 'Users',     Icon: Users },
    { id: 'exercises', label: 'Exercises', Icon: Dumbbell },
  ]

  return (
    <div className="page">
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
        <Shield size={18} color="var(--accent)"/>
        <h1 style={{margin:0}}>Admin <span style={{color:'var(--accent)'}}>Panel</span></h1>
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex:1, padding:'10px 0', borderRadius:10,
              border: tab === id ? 'none' : '1px solid var(--border)',
              background: tab === id ? 'var(--accent)' : 'var(--surface2)',
              color: tab === id ? '#000' : 'var(--text)',
              fontFamily:'Barlow Condensed', fontWeight:800, fontSize:'0.95rem',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              cursor:'pointer',
            }}
          >
            <Icon size={15}/> {label}
          </button>
        ))}
      </div>

      {tab === 'users'     && <UsersTab />}
      {tab === 'exercises' && <ExercisesTab />}
    </div>
  )
}
