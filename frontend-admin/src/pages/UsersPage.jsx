import React, { useMemo, useState } from 'react'
import { useData } from '@shared/context/DataStoreContext'
import { useAuth } from '@shared/context/AuthContext'
import { users as usersApi } from '../api/endpoints'
import UserModal from '../components/UserModal'

const ROLE_LABELS = {
  admin:       { label: 'מנהל',   pill: 'red'    },
  collector:   { label: 'גובה',   pill: 'blue'   },
  cashroom:    { label: 'מזין',   pill: 'yellow' },
  maintenance: { label: 'תחזוקה', pill: 'purple' },
}

const TAG_STYLE = {
  display: 'inline-block',
  padding: '2px 8px',
  marginInlineEnd: 4,
  marginBottom: 4,
  background: 'var(--bg2, #f3f4f6)',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 12,
  fontSize: 12,
  color: 'var(--text2)',
}

// Format an area-rule object into a short Hebrew chip label.
// Rules look like: { city, neighborhood, street, building, box_id }
function ruleToLabel(rule) {
  if (!rule || typeof rule !== 'object') return null
  if (rule.box_id) return `קופה ${rule.box_id}`
  if (rule.building) return `${rule.street || ''} ${rule.building}`.trim() + (rule.city ? ` (${rule.city})` : '')
  if (rule.street) {
    const inCity = rule.city || rule.neighborhood
    return inCity ? `${rule.street} (${inCity})` : rule.street
  }
  if (rule.neighborhood) return `${rule.neighborhood} (שכונה)`
  if (rule.city) return `${rule.city} (עיר)`
  return JSON.stringify(rule)
}

function AreaTags({ rules }) {
  const arr = Array.isArray(rules) ? rules : []
  if (arr.length === 0) return <span style={{ color: 'var(--text3)' }}>—</span>
  return (
    <div>
      {arr.map((r, i) => {
        const label = ruleToLabel(r)
        if (!label) return null
        return <span key={i} style={TAG_STYLE}>{label}</span>
      })}
    </div>
  )
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()

  // Users come from the central DataStore.
  const { data: usersData, loading } = useData('users')
  const allUsers = useMemo(() => (Array.isArray(usersData) ? usersData : []), [usersData])
  const errMsg = null

  // filters
  const [search, setSearch] = useState('')
  const [role,   setRole]   = useState('')
  const [statusTab, setStatusTab] = useState('active') // 'active' | 'all'

  // modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser,  setEditUser]  = useState(null)

  function openCreate() { setEditUser(null); setModalOpen(true) }
  function openEdit(u)  { setEditUser(u);    setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditUser(null) }

  // Store refresh via socket after a save / deactivate — no local patch needed.
  function handleSaved()       { /* store refreshes via socket */ }
  function handleDeactivated() { /* store refreshes via socket */ }

  // Row-level deactivate. A real user can't be hard-deleted — their history
  // (collections, tasks, events) references them — so "delete" = deactivate.
  // The store refreshes via the socket NOTIFY trigger.
  async function handleDeactivate(u) {
    if (!window.confirm(`להפוך את "${u.name}" ללא פעיל?`)) return
    try {
      await usersApi.remove(u.id)
    } catch (err) {
      alert(err.message || 'שגיאה בהשבתה')
    }
  }

  // counts
  const stats = useMemo(() => {
    const c = { admin: 0, collector: 0, cashroom: 0, inactive: 0 }
    for (const u of allUsers) {
      if (!u.active) c.inactive++
      if (c[u.role] !== undefined) c[u.role]++
    }
    return c
  }, [allUsers])

  // apply filters
  const filtered = useMemo(() => {
    let list = allUsers
    if (statusTab === 'active') list = list.filter(u => u.active)
    if (role)   list = list.filter(u => u.role === role)
    if (search) {
      const q = search.trim().toLowerCase()
      list = list.filter(u =>
        [u.name, u.username, u.id]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q))
      )
    }
    return list
  }, [allUsers, statusTab, role, search])

  function resetFilters() {
    setSearch(''); setRole('')
  }

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <div className="page-title">משתמשים</div>
          <div className="page-subtitle">ניהול משתמשי המערכת ושיוכי אזורים</div>
        </div>
        <button
          className="btn primary"
          onClick={openCreate}
        >+ משתמש חדש</button>
      </div>

      {/* STATS */}
      <div className="stats-row stats-3">
        <div className="stat-card">
          <div className="val">{stats.collector}</div>
          <div className="lbl">גובים</div>
        </div>
        <div className="stat-card">
          <div className="val">{stats.cashroom}</div>
          <div className="lbl">מזינים</div>
        </div>
        <div className="stat-card">
          <div className="val">{stats.admin}</div>
          <div className="lbl">מנהלים</div>
        </div>
      </div>

      {/* PANEL */}
      <div className="panel">
        <div className="filters-row">
          <div className="field grow">
            <label>חיפוש</label>
            <input
              placeholder="שם / שם משתמש"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field">
            <label>תפקיד</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">הכל</option>
              <option value="admin">מנהל</option>
              <option value="collector">גובה</option>
              <option value="cashroom">מזין</option>
              <option value="maintenance">תחזוקה</option>
            </select>
          </div>
          <button className="btn sm" onClick={resetFilters}>↺ איפוס</button>
        </div>

        <div className="actions" style={{ marginBottom: 12 }}>
          <button
            className={'btn sm' + (statusTab === 'active' ? ' primary' : '')}
            onClick={() => setStatusTab('active')}
          >פעילים</button>
          <button
            className={'btn sm' + (statusTab === 'all' ? ' primary' : '')}
            onClick={() => setStatusTab('all')}
          >כולם {stats.inactive > 0 ? `(כולל ${stats.inactive} לא פעילים)` : ''}</button>
          <div style={{ marginRight: 'auto', fontSize: 13, color: 'var(--text2)' }}>
            סה"כ: <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong>
          </div>
        </div>

        {errMsg && <div className="alert red">{errMsg}</div>}

        {loading ? (
          <div className="loading"><div className="spinner" /><span>טוען משתמשים...</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty">לא נמצאו משתמשים</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>שם משתמש</th>
                  <th>תפקיד</th>
                  <th>שיוך אזורים</th>
                  <th>החרגות</th>
                  <th>סטטוס</th>
                  <th>פעולה</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const r = ROLE_LABELS[u.role] || { label: u.role, pill: 'gray' }
                  return (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td style={{ color: 'var(--text2)' }}>{u.username}</td>
                      <td><span className={'pill ' + r.pill}>{r.label}</span></td>
                      <td><AreaTags rules={u.area_assignments} /></td>
                      <td><AreaTags rules={u.area_exclusions} /></td>
                      <td>
                        {u.active
                          ? <span className="pill green">פעיל</span>
                          : <span className="pill gray">לא פעיל</span>}
                      </td>
                      <td className="actions" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn sm"
                          onClick={() => openEdit(u)}
                        >עריכה</button>
                        {u.active && currentUser?.id !== u.id && (
                          <button
                            className="btn sm danger"
                            onClick={() => handleDeactivate(u)}
                            title="הפיכה ללא פעיל"
                          >השבתה</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserModal
        open={modalOpen}
        user={editUser}
        onClose={closeModal}
        onSaved={handleSaved}
        onDeactivated={handleDeactivated}
      />
    </div>
  )
}
