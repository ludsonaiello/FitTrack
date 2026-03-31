import { Check, Trash2, X, Plus, Zap } from 'lucide-react'

/**
 * Bottom sheet listing all saved plans.
 * @param {{ plans: Array, activePlanId: number, switching: boolean, onSelect: (id: number) => void, onDelete: (id: number) => void, onCreate: () => void, onClose: () => void }} props
 */
export default function PlanPickerSheet({ plans, activePlanId, switching, onSelect, onDelete, onCreate, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '80dvh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.2rem' }}>
            My Plans
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Plan list */}
        <div style={{ overflowY: 'auto', flex: 1, marginBottom: 12 }}>
          {plans.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: '0.9rem' }}>
              No saved plans yet
            </div>
          )}
          {plans.map(p => {
            const isActive = p.id === activePlanId
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 4px', borderBottom: '1px solid var(--border)',
                  opacity: switching ? 0.6 : 1,
                }}
              >
                {/* Active indicator */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? 'var(--accent)' : 'var(--surface2)',
                }}>
                  {isActive
                    ? <Check size={14} strokeWidth={3} color="#000" />
                    : <Zap size={14} color="var(--text3)" />
                  }
                </div>

                {/* Plan info — tappable to switch */}
                <button
                  disabled={switching || isActive}
                  onClick={() => onSelect(p.id)}
                  style={{
                    flex: 1, background: 'none', border: 'none', cursor: isActive ? 'default' : 'pointer',
                    textAlign: 'left', padding: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem',
                      color: isActive ? 'var(--accent)' : 'var(--text)',
                    }}>
                      {p.name}
                    </span>
                    {p.serverId && (
                      <span style={{
                        fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: '#000',
                        background: 'var(--accent)', padding: '1px 5px', borderRadius: 100,
                      }}>AI</span>
                    )}
                    {isActive && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 600 }}>Active</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 1 }}>
                    {p.dayCount} training day{p.dayCount !== 1 ? 's' : ''} · {p.exerciseCount} exercise{p.exerciseCount !== 1 ? 's' : ''}
                  </div>
                </button>

                {/* Delete */}
                <button
                  onClick={e => { e.stopPropagation(); onDelete(p.id) }}
                  disabled={switching}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6, flexShrink: 0 }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Create new */}
        <button className="btn btn-ghost" style={{ width: '100%', flexShrink: 0 }} onClick={onCreate}>
          <Plus size={16} /> New Plan
        </button>
      </div>
    </div>
  )
}
