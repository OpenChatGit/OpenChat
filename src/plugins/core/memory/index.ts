// Memory Tool Plugin - Allows AI to create and retrieve memories
import type { ToolPlugin } from '../../types'

interface Memory {
  id: string
  content: string
  timestamp: number
  tags: string[]
}

class MemoryStore {
  private memories: Memory[] = []
  private nextId = 1

  createMemory(content: string, tags: string[] = []): Memory {
    const memory: Memory = {
      id: `mem_${this.nextId++}`,
      content,
      timestamp: Date.now(),
      tags,
    }
    this.memories.push(memory)
    return memory
  }

  searchMemories(query: string, tags?: string[]): Memory[] {
    let results = this.memories

    // Filter by tags if provided
    if (tags && tags.length > 0) {
      results = results.filter(m => 
        tags.some(tag => m.tags.includes(tag))
      )
    }

    // Search in content
    if (query) {
      const queryLower = query.toLowerCase()
      results = results.filter(m => 
        m.content.toLowerCase().includes(queryLower)
      )
    }

    // Sort by most recent
    return results.sort((a, b) => b.timestamp - a.timestamp)
  }

  getAllMemories(): Memory[] {
    return [...this.memories].sort((a, b) => b.timestamp - a.timestamp)
  }

  deleteMemory(id: string): boolean {
    const index = this.memories.findIndex(m => m.id === id)
    if (index !== -1) {
      this.memories.splice(index, 1)
      return true
    }
    return false
  }
}

const memoryStore = new MemoryStore()

export class MemoryToolPlugin implements ToolPlugin {
  metadata = {
    id: 'memory-tool',
    name: 'Memory System',
    version: '1.0.0',
    description: 'Allows AI to create and retrieve memories across conversations',
    author: 'OpenChat Team',
    type: 'tool' as const,
    appVersion: '1.0.0',
    enabled: true,
    core: true,
  }

  tools = [
    {
      type: 'function' as const,
      function: {
        name: 'create_memory',
        description: 'Create a new memory that will persist across conversations. Use this to remember important information about the user, their preferences, or context that should be recalled later.',
        parameters: {
          type: 'object' as const,
          properties: {
            content: {
              type: 'string',
              description: 'The content to remember. Be specific and clear.',
            },
            tags: {
              type: 'string',
              description: 'Optional tags to categorize the memory (e.g., "preference", "user-info", "project")',
            },
          },
          required: ['content'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'search_memories',
        description: 'Search through existing memories. Use this to recall information from previous conversations.',
        parameters: {
          type: 'object' as const,
          properties: {
            query: {
              type: 'string',
              description: 'Search query to find relevant memories',
            },
            tags: {
              type: 'string',
              description: 'Optional tags to filter memories by category',
            },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'list_memories',
        description: 'List all stored memories. Useful to see what information has been remembered.',
        parameters: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
    },
  ]

  async executeTool(toolName: string, args: Record<string, any>): Promise<string> {
    switch (toolName) {
      case 'create_memory': {
        const { content, tags = [] } = args
        const memory = memoryStore.createMemory(content, tags)
        return JSON.stringify({
          success: true,
          memory: {
            id: memory.id,
            content: memory.content,
            tags: memory.tags,
            created: new Date(memory.timestamp).toISOString(),
          },
          message: 'Memory created successfully',
        })
      }

      case 'search_memories': {
        const { query, tags } = args
        const results = memoryStore.searchMemories(query, tags)
        return JSON.stringify({
          success: true,
          count: results.length,
          memories: results.map(m => ({
            id: m.id,
            content: m.content,
            tags: m.tags,
            created: new Date(m.timestamp).toISOString(),
          })),
        })
      }

      case 'list_memories': {
        const memories = memoryStore.getAllMemories()
        return JSON.stringify({
          success: true,
          count: memories.length,
          memories: memories.map(m => ({
            id: m.id,
            content: m.content,
            tags: m.tags,
            created: new Date(m.timestamp).toISOString(),
          })),
        })
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  }
}
