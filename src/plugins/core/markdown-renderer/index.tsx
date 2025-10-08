// Markdown Renderer Plugin - renders markdown content with syntax highlighting

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { RendererPlugin, PluginMetadata } from '../../types'
import manifestData from './plugin.json'
import { CodeBlock } from '../../../components/CodeBlock'

export class MarkdownRendererPlugin implements RendererPlugin {
  metadata: PluginMetadata & { type: 'renderer' } = {
    ...(manifestData as any),
    enabled: true,
  }

  canRender(content: string): boolean {
    // Check if content contains markdown syntax
    const markdownPatterns = [
      /^#{1,6}\s/m,           // Headers
      /\*\*.*\*\*/,           // Bold
      /\*.*\*/,               // Italic
      /```[\s\S]*```/,        // Code blocks
      /`[^`]+`/,              // Inline code
      /^\s*[-*+]\s/m,         // Lists
      /^\s*\d+\.\s/m,         // Numbered lists
      /\[.*\]\(.*\)/,         // Links
      /!\[.*\]\(.*\)/,        // Images
      /^\s*>\s/m,             // Blockquotes
      /\|.*\|/,               // Tables
    ]

    return markdownPatterns.some(pattern => pattern.test(content))
  }

  render(content: string): React.ReactNode {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom component styling
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            
            if (!inline && match) {
              // Block code - use CodeBlock component
              const language = match[1]
              // Extract text content - children is already a string in code blocks
              const codeString = String(children).replace(/\n$/, '')
              return <CodeBlock code={codeString} language={language} />
            }
            
            // Inline code
            return (
              <code 
                className="px-1.5 py-0.5 rounded text-sm" 
                style={{ 
                  backgroundColor: '#2d2d2d',
                  color: '#d4d4d4'
                }}
                {...props}
              >
                {children}
              </code>
            )
          },
          pre({ children }) {
            return <>{children}</>
          },
          h1({ children }) {
            return <h1 className="text-3xl font-bold mt-6 mb-4">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="text-2xl font-bold mt-5 mb-3">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="text-xl font-bold mt-4 mb-2">{children}</h3>
          },
          h4({ children }) {
            return <h4 className="text-lg font-bold mt-3 mb-2">{children}</h4>
          },
          ul({ children }) {
            return <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
          },
          li({ children }) {
            return <li className="ml-4">{children}</li>
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary pl-4 py-2 my-2 italic text-muted-foreground">
                {children}
              </blockquote>
            )
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border-collapse border border-border">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="border border-border bg-muted px-4 py-2 text-left font-semibold">
                {children}
              </th>
            )
          },
          td({ children }) {
            return <td className="border border-border px-4 py-2">{children}</td>
          },
          hr() {
            return <hr className="my-4 border-border" />
          },
          img({ src, alt }) {
            return (
              <img
                src={src}
                alt={alt}
                className="max-w-full h-auto rounded-lg my-2"
              />
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    )
  }

  onLoad() {
    console.log(`[${this.metadata.name}] v${this.metadata.version} loaded`)
  }
}
