import { useState, useRef, useEffect } from 'react'
import { MoreVertical } from 'lucide-react'
import { ProfileButton } from './ProfileButton'
import type { ChatSession } from '../types'
import { formatTimestamp } from '../lib/utils'
import { cn } from '../lib/utils'
import type { UpdateInfo } from '../services/updateChecker'
import downloadIcon from '../assets/download.svg'
import { PluginHookRenderer } from './PluginHookRenderer'

interface SidebarProps {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  updateInfo: UpdateInfo | null
  onNewChat: () => void
  onSelectSession: (session: ChatSession) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, newTitle: string) => void
  onOpenSettings: () => void
  onToggleSidebar: () => void
  onOpenUpdate: () => void
  onOpenBrowser: () => void
}

export function Sidebar({
  sessions,
  currentSession,
  updateInfo,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onOpenSettings,
  onToggleSidebar,
  onOpenUpdate,
  onOpenBrowser,
}: SidebarProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const editingInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!openMenuId && !deletingSessionId) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
        setDeletingSessionId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId, deletingSessionId])

  useEffect(() => {
    if (editingSessionId) {
      requestAnimationFrame(() => {
        editingInputRef.current?.focus()
        editingInputRef.current?.select()
      })
    }
  }, [editingSessionId])

  const handleRename = (session: ChatSession) => {
    setEditingSessionId(session.id)
    setEditingTitle(session.title)
    setDeletingSessionId(null)
    setOpenMenuId(null)
  }

  const handleDelete = (sessionId: string) => {
    if (deletingSessionId === sessionId) {
      onDeleteSession(sessionId)
      setDeletingSessionId(null)
      setOpenMenuId(null)
    } else {
      setDeletingSessionId(sessionId)
    }
  }

  const submitRename = () => {
    if (!editingSessionId) return

    const trimmed = editingTitle.trim()
    if (trimmed.length > 0) {
      onRenameSession(editingSessionId, trimmed)
    }
    setEditingSessionId(null)
    setEditingTitle('')
  }

  const cancelRename = () => {
    setEditingSessionId(null)
    setEditingTitle('')
  }

  return (
    <div
      ref={sidebarRef}
      className="flex flex-col h-full w-64"
      style={{ backgroundColor: 'var(--color-sidebar)' }}
    >
      {/* Header with Icon Buttons */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="New Chat"
            aria-label="New Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
              <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h357l-80 80H200v560h560v-278l80-80v358q0 33-23.5 56.5T760-120H200Zm280-360ZM360-360v-170l367-367q12-12 27-18t30-6q16 0 30.5 6t26.5 18l56 57q11 12 17 26.5t6 29.5q0 15-5.5 29.5T897-728L530-360H360Zm481-424-56-56 56 56ZM440-440h56l232-232-28-28-29-28-231 231v57Zm260-260-29-28 29 28 28 28-28-28Z"/>
            </svg>
          </button>

          {/* Browser Button */}
          <button
            onClick={onOpenBrowser}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Open Browser"
            aria-label="Open Browser"
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
              <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-7-.5-14.5T799-507q-5 29-27 48t-52 19h-80q-33 0-56.5-23.5T560-520v-40H400v-80q0-33 23.5-56.5T480-720h40q0-23 12.5-40.5T563-789q-20-5-41-8t-42-3q-134 0-227 93t-93 227h200q66 0 113 47t47 113v40H400v110q20 5 39.5 7.5T480-160Z"/>
            </svg>
          </button>

          {/* Update Available Button */}
          {updateInfo?.available && (
            <button
              onClick={onOpenUpdate}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors relative animate-pulse"
              title={`Update available: v${updateInfo.latestVersion}`}
              aria-label="Update available"
            >
              <img src={downloadIcon} alt="Download" className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></span>
            </button>
          )}
        </div>

        {/* Sidebar Toggle Button */}
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          title="Close Sidebar"
          aria-label="Close Sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
            <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm440-80h120v-560H640v560Zm-80 0v-560H200v560h360Zm80 0h120-120Z"/>
          </svg>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Plugin hooks: Add sidebar items */}
        <PluginHookRenderer hookType="ui.sidebar" />
        
        {sessions.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            No chats yet
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => {
              const isActive = currentSession?.id === session.id
              const isMenuOpen = openMenuId === session.id

              return (
                <div
                  key={session.id}
                  className={cn(
                    'relative flex items-center p-3 rounded-lg cursor-pointer transition-colors',
                    'hover:bg-accent',
                    isActive && 'bg-accent'
                  )}
                  onClick={() => onSelectSession(session)}
                >
                  <div className="flex-1 min-w-0">
                    {editingSessionId === session.id ? (
                      <input
                        ref={editingInputRef}
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            submitRename()
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            cancelRename()
                          }
                        }}
                        onBlur={() => submitRename()}
                        className="w-full rounded-md bg-white/10 px-2 py-1 text-sm text-foreground outline-none focus:bg-white/20"
                      />
                    ) : (
                      <div className="text-sm font-medium truncate" title={session.title}>
                        {session.title}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {formatTimestamp(session.updatedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      className="p-2 rounded-md hover:bg-white/10 transition-colors"
                      onClick={(event) => {
                        event.stopPropagation()
                        setOpenMenuId((prev) => (prev === session.id ? null : session.id))
                        setDeletingSessionId(null)
                      }}
                      aria-label="Chat actions"
                      title="Chat actions"
                    >
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>

                  {isMenuOpen && (
                    <div
                      className="absolute right-2 top-10 z-20 w-32 rounded-md shadow-lg border border-white/10"
                      style={{ backgroundColor: 'var(--color-sidebar)' }}
                    >
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleRename(session)
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/10 transition-colors"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDelete(session.id)
                        }}
                      >
                        {deletingSessionId === session.id ? 'Sure?' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer - Profile Button */}
      <div className="p-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <ProfileButton onOpenSettings={onOpenSettings} />
      </div>
    </div>
  )
}
