/**
 * Message Export Plugin
 * 
 * Export chat sessions to various formats (JSON, Markdown, plain text).
 * Uses pluginAPI for UI integration.
 */

class MessageExportPlugin {
  /**
   * Called when plugin is loaded
   */
  onLoad() {
    console.log('[MessageExportPlugin] Loading...')
    
    // Add export button to toolbar using pluginAPI
    pluginAPI.ui.addToolbarButton({
      id: 'export-chat',
      label: 'Export Chat',
      icon: '📥',
      onClick: () => {
        this.showExportDialog()
      }
    })
    
    console.log('[MessageExportPlugin] Added toolbar button')
  }

  /**
   * Called when plugin is unloaded
   */
  onUnload() {
    console.log('[MessageExportPlugin] Unloading...')
    
    // Remove toolbar button
    pluginAPI.ui.removeToolbarButton('export-chat')
  }

  /**
   * Show export dialog to user
   */
  showExportDialog() {
    // Get current session data
    const session = pluginAPI.session.getCurrent()
    
    if (!session) {
      pluginAPI.ui.showNotification('No active session to export', 'error')
      return
    }

    // For now, export as JSON (in future, show format selection dialog)
    const format = 'json'
    
    try {
      const exportedData = this.exportSession(session, format)
      this.downloadExport(exportedData, `chat-${session.id}.${format}`, this.getMimeType(format))
      
      pluginAPI.ui.showNotification('Chat exported successfully!', 'success')
    } catch (error) {
      console.error('[MessageExportPlugin] Export failed:', error)
      pluginAPI.ui.showNotification('Export failed: ' + error.message, 'error')
    }
  }

  /**
   * Export session to specified format
   */
  exportSession(session, format) {
    switch (format) {
      case 'json':
        return this.exportAsJSON(session)
      case 'markdown':
        return this.exportAsMarkdown(session)
      case 'text':
        return this.exportAsText(session)
      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  }

  /**
   * Export as JSON
   */
  exportAsJSON(session) {
    return JSON.stringify(session, null, 2)
  }

  /**
   * Export as Markdown
   */
  exportAsMarkdown(session) {
    let markdown = `# ${session.title}\n\n`
    markdown += `**Provider:** ${session.provider || 'Unknown'}\n`
    markdown += `**Model:** ${session.model || 'Unknown'}\n`
    markdown += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n\n`
    markdown += `---\n\n`

    const messages = session.messages || []
    for (const message of messages) {
      const role = message.role === 'user' ? '👤 User' : '🤖 Assistant'
      markdown += `## ${role}\n\n`
      markdown += `${message.content}\n\n`
    }

    return markdown
  }

  /**
   * Export as plain text
   */
  exportAsText(session) {
    let text = `${session.title}\n`
    text += `Provider: ${session.provider || 'Unknown'}\n`
    text += `Model: ${session.model || 'Unknown'}\n`
    text += `Created: ${new Date(session.createdAt).toLocaleString()}\n\n`
    text += `${'='.repeat(50)}\n\n`

    const messages = session.messages || []
    for (const message of messages) {
      const role = message.role === 'user' ? 'User' : 'Assistant'
      text += `[${role}]\n`
      text += `${message.content}\n\n`
      text += `${'-'.repeat(50)}\n\n`
    }

    return text
  }

  /**
   * Get MIME type for format
   */
  getMimeType(format) {
    const mimeTypes = {
      json: 'application/json',
      markdown: 'text/markdown',
      text: 'text/plain'
    }
    return mimeTypes[format] || 'text/plain'
  }

  /**
   * Download exported data as file
   */
  downloadExport(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Get tool definition (for AI tool integration)
   */
  getTool() {
    return {
      name: 'export_chat',
      description: 'Export the current chat session',
      parameters: {
        format: {
          type: 'string',
          enum: ['json', 'markdown', 'text'],
          description: 'Export format',
        },
      },
    }
  }

  /**
   * Execute tool (called by AI)
   */
  async execute(params) {
    const { format } = params
    const session = pluginAPI.session.getCurrent()
    
    if (!session) {
      throw new Error('No active session to export')
    }

    return this.exportSession(session, format)
  }
}

// Export the plugin class
export default MessageExportPlugin
