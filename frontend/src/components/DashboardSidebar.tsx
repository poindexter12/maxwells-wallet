'use client'

import { useState } from 'react'
import { useDashboard } from '@/contexts/DashboardContext'

interface DashboardSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const {
    dashboards,
    currentDashboard,
    loading,
    setCurrentDashboard,
    createDashboard,
    cloneDashboard,
    deleteDashboard,
    setDefaultDashboard
  } = useDashboard()

  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)

  async function handleCreate() {
    if (!newName.trim()) return
    await createDashboard({ name: newName.trim() })
    setNewName('')
    setIsCreating(false)
  }

  async function handleClone(id: number) {
    await cloneDashboard(id)
    setMenuOpenId(null)
  }

  async function handleDelete(id: number) {
    if (confirm('Delete this dashboard? This cannot be undone.')) {
      await deleteDashboard(id)
    }
    setMenuOpenId(null)
  }

  async function handleSetDefault(id: number) {
    await setDefaultDashboard(id)
    setMenuOpenId(null)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-72 bg-white shadow-xl z-50 overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Dashboards</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-2">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : (
            <>
              {dashboards.map(dashboard => (
                <div
                  key={dashboard.id}
                  className={`relative group p-3 rounded-lg cursor-pointer transition-colors ${
                    currentDashboard?.id === dashboard.id
                      ? 'bg-blue-100 border-blue-500 border'
                      : 'hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  <div
                    className="flex items-center justify-between"
                    onClick={() => {
                      setCurrentDashboard(dashboard)
                      onClose()
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{dashboard.name}</span>
                        {dashboard.is_default && (
                          <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      {dashboard.description && (
                        <p className="text-xs text-gray-500 truncate">{dashboard.description}</p>
                      )}
                    </div>

                    {/* Menu button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpenId(menuOpenId === dashboard.id ? null : dashboard.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  </div>

                  {/* Dropdown menu */}
                  {menuOpenId === dashboard.id && (
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                      <button
                        onClick={() => handleClone(dashboard.id)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                      >
                        Clone
                      </button>
                      {!dashboard.is_default && (
                        <button
                          onClick={() => handleSetDefault(dashboard.id)}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        >
                          Set as Default
                        </button>
                      )}
                      {dashboards.length > 1 && (
                        <button
                          onClick={() => handleDelete(dashboard.id)}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Create new */}
              {isCreating ? (
                <div className="p-3 border rounded-lg space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Dashboard name"
                    className="w-full px-3 py-2 border rounded text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate()
                      if (e.key === 'Escape') setIsCreating(false)
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setIsCreating(false)}
                      className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full p-3 text-left text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Dashboard
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
