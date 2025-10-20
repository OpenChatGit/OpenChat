import { X } from 'lucide-react'
import type { UpdateInfo } from '../services/updateChecker'
import { openDownloadPage } from '../services/updateChecker'

interface UpdateModalProps {
  updateInfo: UpdateInfo
  onClose: () => void
}

export function UpdateModal({ updateInfo, onClose }: UpdateModalProps) {
  const handleDownload = async () => {
    await openDownloadPage(updateInfo.downloadUrl)
  }

  const handleViewRelease = async () => {
    await openDownloadPage(updateInfo.releaseUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl mx-4 rounded-lg shadow-xl border"
        style={{
          backgroundColor: 'var(--color-sidebar)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-foreground)' }}>
              Update Available
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
              Version {updateInfo.latestVersion} is now available
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Version Info */}
          <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
            <div>
              <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                Current Version
              </div>
              <div className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>
                v{updateInfo.currentVersion}
              </div>
            </div>
            <div className="text-2xl" style={{ color: 'var(--color-muted-foreground)' }}>
              →
            </div>
            <div>
              <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                Latest Version
              </div>
              <div className="text-lg font-semibold text-green-500">
                v{updateInfo.latestVersion}
              </div>
            </div>
          </div>

          {/* Release Notes */}
          {updateInfo.releaseNotes && (
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>
                What's New
              </h3>
              <div
                className="p-4 rounded-lg max-h-64 overflow-y-auto text-sm"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--color-muted-foreground)',
                }}
              >
                <pre className="whitespace-pre-wrap font-sans">{updateInfo.releaseNotes}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          <button
            onClick={handleViewRelease}
            className="px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm"
            style={{ color: 'var(--color-foreground)' }}
          >
            View Release
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 transition-colors text-sm font-medium text-white"
          >
            Download Update
          </button>
        </div>
      </div>
    </div>
  )
}
