import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Book, FileText, Code, Zap, FolderOpen, Plus } from 'lucide-react'
import { Button } from './ui/Button'
import { getOrCreateHighlighter, loadLanguage } from '../lib/shikiHighlighter'

export type DocPage = 'getting-started' | 'api' | 'examples' | 'hooks'

interface PluginDocumentationProps {
  page: DocPage
  onCreateTemplate?: () => void
  onOpenPluginsFolder?: () => void
}

interface DocPageInfo {
  id: DocPage
  title: string
  icon: typeof Book
  file: string
}

const DOC_PAGES: DocPageInfo[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Book,
    file: '/src/plugins/docs/GETTING_STARTED.md'
  },
  {
    id: 'api',
    title: 'API Reference',
    icon: FileText,
    file: '/src/plugins/docs/PLUGIN_API.md'
  },
  {
    id: 'examples',
    title: 'Examples',
    icon: Code,
    file: '/src/plugins/docs/EXAMPLES.md'
  },
  {
    id: 'hooks',
    title: 'Hooks Reference',
    icon: Zap,
    file: '/src/plugins/docs/HOOKS_REFERENCE.md'
  }
]

export function PluginDocumentation({
  page,
  onCreateTemplate,
  onOpenPluginsFolder
}: PluginDocumentationProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Load documentation content
  useEffect(() => {
    loadDocumentation(page)
  }, [page])

  const loadDocumentation = async (page: DocPage) => {
    setLoading(true)
    try {
      const docPage = DOC_PAGES.find(p => p.id === page)
      if (!docPage) return

      const response = await fetch(docPage.file)
      const text = await response.text()
      setContent(text)
    } catch (error) {
      console.error('Failed to load documentation:', error)
      setContent('# Error\n\nFailed to load documentation. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Filter content based on search query
  const filteredContent = searchQuery
    ? content
        .split('\n')
        .filter(line =>
          line.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .join('\n')
    : content

  return (
    <div className="flex flex-col h-full">
      {/* Header with Actions */}
      <div className="p-4 border-b border-border space-y-4">
        {/* Quick Actions */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Quick Actions
          </label>
          <div className="flex gap-2">
            {onCreateTemplate && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onCreateTemplate}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            )}
            {onOpenPluginsFolder && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenPluginsFolder}
                className="flex-1"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Open Plugins Folder
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div>
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Documentation Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading documentation...</div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto markdown-content">
            <MarkdownContent content={filteredContent} />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Markdown content renderer with syntax highlighting
 */
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        // Custom code block renderer with Shiki
        code(props) {
          const { node, className, children, ...rest } = props
          const match = /language-(\w+)/.exec(className || '')
          const language = match ? match[1] : 'text'
          const code = String(children).replace(/\n$/, '')
          const inline = !className

          if (inline) {
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono"
                {...rest}
              >
                {children}
              </code>
            )
          }

          return (
            <CodeBlock
              code={code}
              language={language}
            />
          )
        },
        // Style headings
        h1: ({ children }) => (
          <h1 className="text-3xl font-bold mb-4 mt-8 text-foreground">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-2xl font-semibold mb-3 mt-6 text-foreground">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xl font-semibold mb-2 mt-4 text-foreground">
            {children}
          </h3>
        ),
        // Style paragraphs
        p: ({ children }) => (
          <p className="mb-4 text-muted-foreground leading-relaxed">
            {children}
          </p>
        ),
        // Style lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-4 space-y-2 text-muted-foreground">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-4 space-y-2 text-muted-foreground">
            {children}
          </ol>
        ),
        // Style links
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        // Style blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
            {children}
          </blockquote>
        ),
        // Style tables
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border border-border">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border px-4 py-2 bg-muted text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-4 py-2">
            {children}
          </td>
        )
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

/**
 * Code block component with Shiki syntax highlighting
 */
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [highlightedCode, setHighlightedCode] = useState<string>('')
  const [isHighlighting, setIsHighlighting] = useState(true)

  useEffect(() => {
    highlightCode()
  }, [code, language])

  const highlightCode = async () => {
    setIsHighlighting(true)
    try {
      // Load language if needed
      await loadLanguage(language)
      
      // Get highlighter
      const highlighter = await getOrCreateHighlighter()
      
      // Highlight code
      const html = highlighter.codeToHtml(code, {
        lang: language,
        theme: 'github-dark'
      })
      
      setHighlightedCode(html)
    } catch (error) {
      console.error('Failed to highlight code:', error)
      // Fallback to plain text
      setHighlightedCode(`<pre><code>${escapeHtml(code)}</code></pre>`)
    } finally {
      setIsHighlighting(false)
    }
  }

  if (isHighlighting) {
    return (
      <pre className="p-4 rounded-lg bg-muted overflow-x-auto">
        <code className="text-sm font-mono">{code}</code>
      </pre>
    )
  }

  return (
    <div
      className="my-4 rounded-lg overflow-hidden"
      dangerouslySetInnerHTML={{ __html: highlightedCode }}
    />
  )
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}
