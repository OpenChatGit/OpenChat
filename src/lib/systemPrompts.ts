// System Prompts for AI Models with Tool Support

import type { ToolDefinition } from '../types/tools'

/**
 * Generate system prompt with tool definitions
 */
export function generateSystemPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) {
    return getBaseSystemPrompt()
  }

  return `${getBaseSystemPrompt()}

# Available Tools

You have access to the following tools that you can use to help answer user questions:

${tools.map(tool => formatToolDefinition(tool)).join('\n\n')}

## When to Use Tools

**Use web_search when:**
- User asks about current events, news, or recent information
- User requests specific facts, statistics, or data you might not have
- User asks "search for", "look up", "find information about"
- User asks about topics that change frequently (technology, prices, etc.)
- You need to verify or supplement your knowledge with current information

**Do NOT use tools when:**
- You can answer from your existing knowledge with confidence
- User asks about general concepts you know well
- Question is about coding, math, or logic you can solve directly

## How to Use Tools - Step by Step

**Step 1:** Determine if you need a tool (see "When to Use Tools" above)

**Step 2:** If yes, respond with ONLY the JSON tool call (no other text):

\`\`\`json
{
  "tool_calls": [
    {
      "id": "call_1",
      "type": "function",
      "function": {
        "name": "web_search",
        "arguments": "{\\"query\\": \\"your search query\\", \\"maxResults\\": 5}"
      }
    }
  ]
}
\`\`\`

**Step 3:** Wait for tool results (they will be provided as a system message)

**Step 4:** Use the tool results to formulate your final answer, citing sources

## Important Rules

1. **Unique IDs**: Use "call_1", "call_2", etc. for each tool call
2. **JSON String**: Arguments must be a JSON string (escape quotes with \\\\)
3. **Wait for Results**: NEVER provide a final answer before receiving tool results
4. **Cite Sources**: Always mention which sources you used from the tool results
5. **No Mixed Response**: Either make a tool call OR answer directly, never both

## Example Workflow

**User:** "What are the latest TypeScript features in 2024?"

**Your Response (Tool Call):**
\`\`\`json
{
  "tool_calls": [
    {
      "id": "call_1",
      "type": "function",
      "function": {
        "name": "web_search",
        "arguments": "{\\"query\\": \\"TypeScript new features 2024\\", \\"maxResults\\": 5}"
      }
    }
  ]
}
\`\`\`

**System provides tool results...**

**Your Final Answer:**
"Based on the latest information, here are the new TypeScript features in 2024:

1. **Decorators** - Now in Stage 3...
2. **Satisfies Operator** - Allows...

Sources:
- https://devblogs.microsoft.com/typescript/...
- https://www.typescriptlang.org/docs/..."
`
}

/**
 * Base system prompt without tools
 */
function getBaseSystemPrompt(): string {
  // Get current date information
  const now = new Date()
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  return `You are a helpful AI assistant. Provide accurate, concise, and well-structured responses.

**Current Date and Time:**
- Today is ${dateString}
- Current time: ${timeString} (local time)

**Critical Date Interpretation Rules:**
- ALWAYS interpret dates relative to today (${dateString})
- Dates in the future are ERRORS in source data
- Calculate time elapsed: "October 2024" when today is October 2025 = over 1 year ago
- When asked about "latest" or "current" versions, find the MOST RECENT version mentioned
- If web search results seem outdated, acknowledge this limitation

**Core Guidelines:**
- Be clear and direct in your responses
- Use markdown formatting for readability
- If you use external information (e.g., tool results), cite the sources
- Be skeptical of contradictory information and mention discrepancies
- Admit when you don't know something and propose using tools when available
- Be respectful and professional
- Think step-by-step before deciding to use any tools`
}

/**
 * Format a single tool definition for the prompt
 */
function formatToolDefinition(tool: ToolDefinition): string {
  const func = tool.function

  let formatted = `### ${func.name}\n`
  formatted += `**Description**: ${func.description}\n\n`
  formatted += `**Parameters**:\n`

  for (const [paramName, paramDef] of Object.entries(func.parameters.properties)) {
    const required = func.parameters.required.includes(paramName) ? '(required)' : '(optional)'
    formatted += `- \`${paramName}\` ${required}: ${paramDef.description}\n`

    if (paramDef.enum) {
      formatted += `  - Allowed values: ${paramDef.enum.join(', ')}\n`
    }
  }

  return formatted
}

/**
 * Create tool result message for AI
 */
export function createToolResultMessage(toolCallId: string, result: string, error?: string): string {
  if (error) {
    return `Tool execution failed (ID: ${toolCallId}): ${error}`
  }

  return `Tool execution result (ID: ${toolCallId}):\n\n${result}`
}

/**
 * Parse tool calls from AI response
 */
export function parseToolCalls(content: string): any[] | null {
  try {
    // Try to extract JSON from code blocks
    const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/)

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1])
      return parsed.tool_calls || null
    }

    // Try to parse the entire content as JSON
    const parsed = JSON.parse(content)
    return parsed.tool_calls || null
  } catch {
    return null
  }
}

/**
 * Check if response contains tool calls
 */
export function hasToolCalls(content: string): boolean {
  return parseToolCalls(content) !== null
}
