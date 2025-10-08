// Message Export Plugin - export chat sessions to various formats

import type { ToolPlugin, PluginMetadata } from '../../types'
import type { ChatSession } from '../../../types'
import manifestData from './plugin.json'

export class MessageExportPlugin implements ToolPlugin {
  metadata: PluginMetadata & { type: 'tool' } = {
    ...(manifestData as any),
    enabled: true,
  }

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

  async execute(params: { format: 'json' | 'markdown' | 'text'; session: ChatSession }) {
    const { format, session } = params

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

  private exportAsJSON(session: ChatSession): string {
    return JSON.stringify(session, null, 2)
  }

  private exportAsMarkdown(session: ChatSession): string {
    let markdown = `# ${session.title}\n\n`
    markdown += `**Provider:** ${session.provider}\n`
    markdown += `**Model:** ${session.model}\n`
    markdown += `**Created:** ${new Date(session.createdAt).toLocaleString()}\n\n`
    markdown += `---\n\n`

    for (const message of session.messages) {
      const role = message.role === 'user' ? '👤 User' : '🤖 Assistant'
      markdown += `## ${role}\n\n`
      markdown += `${message.content}\n\n`
    }

    return markdown
  }

  private exportAsText(session: ChatSession): string {
    let text = `${session.title}\n`
    text += `Provider: ${session.provider}\n`
    text += `Model: ${session.model}\n`
    text += `Created: ${new Date(session.createdAt).toLocaleString()}\n\n`
    text += `${'='.repeat(50)}\n\n`

    for (const message of session.messages) {
      const role = message.role === 'user' ? 'User' : 'Assistant'
      text += `[${role}]\n`
      text += `${message.content}\n\n`
      text += `${'-'.repeat(50)}\n\n`
    }

    return text
  }

  // Helper method to download the export
  downloadExport(content: string, filename: string, mimeType: string) {
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

  onLoad() {
    console.log(`[${this.metadata.name}] v${this.metadata.version} loaded`)
  }
}
