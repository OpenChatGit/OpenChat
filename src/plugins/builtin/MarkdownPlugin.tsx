// Markdown Renderer Plugin - renders markdown content with syntax highlighting

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypePrettyCode from 'rehype-pretty-code'
import type { RendererPlugin } from '../core'
import { CodeBlock } from '../../components/CodeBlock'

export class MarkdownPlugin implements RendererPlugin {
  metadata = {
    id: 'markdown-renderer',
    name: 'Markdown Renderer',
    version: '1.0.0',
    description: 'Renders markdown content with syntax highlighting, math support, and GFM',
    author: 'OpenChat',
    type: 'renderer' as const,
    appVersion: '1.0.0',
    enabled: true,
    loaded: false,
    folderPath: 'src/plugins/builtin/markdown-renderer',
    isBuiltin: true,
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
    // Configure rehype-pretty-code with Shiki options
    const rehypePrettyCodeOptions = {
      theme: 'github-dark',
      keepBackground: false, // Use our custom background from CodeBlock component
      onVisitLine(node: any) {
        // Prevent empty lines from collapsing
        if (node.children.length === 0) {
          node.children = [{ type: 'text', value: ' ' }]
        }
      },
      onVisitHighlightedLine(node: any) {
        // Add class for highlighted lines
        if (!node.properties.className) {
          node.properties.className = []
        }
        node.properties.className.push('highlighted')
      }
    }

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeKatex, 
          [rehypePrettyCode, rehypePrettyCodeOptions]
        ]}
        components={{
          // Delegate code rendering to CodeBlock component
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const inline = !match
            
            // For inline code, use simple styling
            if (inline) {
              return (
                <code 
                  className="px-1.5 py-0.5 rounded text-sm font-mono"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    fontSize: '0.9em'
                  }}
                  {...props}
                >
                  {children}
                </code>
              )
            }
            
            // For code blocks, delegate to CodeBlock component
            const language = match ? match[1] : 'text'
            const codeContent = String(children).replace(/\n$/, '')
            
            return (
              <CodeBlock 
                code={codeContent}
                language={language}
              />
            )
          },
          pre({ children }) {
            // Return children directly to avoid double-wrapping
            return <>{children}</>
          },
          h1({ children }) {
            return (
              <h1 
                className="font-semibold mt-6 mb-4 first:mt-0"
                style={{ fontSize: '2em', lineHeight: '1.3' }}
              >
                {children}
              </h1>
            )
          },
          h2({ children }) {
            return (
              <h2 
                className="font-semibold mt-5 mb-3 first:mt-0"
                style={{ fontSize: '1.5em', lineHeight: '1.4' }}
              >
                {children}
              </h2>
            )
          },
          h3({ children }) {
            return (
              <h3 
                className="font-semibold mt-4 mb-2 first:mt-0"
                style={{ fontSize: '1.25em', lineHeight: '1.5' }}
              >
                {children}
              </h3>
            )
          },
          h4({ children }) {
            return (
              <h4 
                className="font-semibold mt-3 mb-2 first:mt-0"
                style={{ fontSize: '1.1em', lineHeight: '1.5' }}
              >
                {children}
              </h4>
            )
          },
          ul({ children }) {
            return (
              <ul 
                className="my-4 first:mt-0 last:mb-0"
                style={{ 
                  paddingLeft: '2em',
                  listStyleType: 'disc',
                  lineHeight: '1.7'
                }}
              >
                {children}
              </ul>
            )
          },
          ol({ children }) {
            return (
              <ol 
                className="my-4 first:mt-0 last:mb-0"
                style={{ 
                  paddingLeft: '2em',
                  listStyleType: 'decimal',
                  lineHeight: '1.7'
                }}
              >
                {children}
              </ol>
            )
          },
          li({ children }) {
            return (
              <li 
                className="my-2"
                style={{ lineHeight: '1.7' }}
              >
                {children}
              </li>
            )
          },
          blockquote({ children }) {
            return (
              <blockquote 
                className="my-4 py-2 px-4 first:mt-0 last:mb-0"
                style={{
                  borderLeft: '4px solid rgba(255, 255, 255, 0.3)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontStyle: 'italic',
                  lineHeight: '1.7'
                }}
              >
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
                className="transition-all duration-200"
                style={{
                  color: '#58a6ff',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none'
                }}
              >
                {children}
              </a>
            )
          },
          p({ children }) {
            return (
              <p 
                className="my-4 first:mt-0 last:mb-0"
                style={{ lineHeight: '1.7' }}
              >
                {children}
              </p>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-6 first:mt-0 last:mb-0">
                <table 
                  style={{
                    borderCollapse: 'collapse',
                    width: '100%',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                >
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th 
                className="text-left font-semibold"
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  padding: '0.75em 1em'
                }}
              >
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td 
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '0.75em 1em'
                }}
              >
                {children}
              </td>
            )
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
    console.log('Markdown plugin loaded')
  }
}
