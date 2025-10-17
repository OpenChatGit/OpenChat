// Tool Executor - Executes tool calls from AI models

import type { ToolCall, ToolCallResult, ToolDefinition } from '../types/tools'
import type { PluginManager, ToolPlugin } from '../plugins/core'

export class ToolExecutor {
  private pluginManager: PluginManager

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager
  }

  /**
   * Get all available tool definitions
   */
  getAvailableTools(): ToolDefinition[] {
    const toolPlugins = this.pluginManager.getByType<ToolPlugin>('tool')
    
    return toolPlugins.map(plugin => {
      const tool = plugin.getTool()
      
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: this.convertParameters(tool.parameters),
            required: this.getRequiredParams(tool.parameters),
          },
        },
      }
    })
  }

  /**
   * Execute a single tool call
   */
  async executeToolCall(toolCall: ToolCall): Promise<ToolCallResult> {
    try {
      const functionName = toolCall.function.name
      const args = JSON.parse(toolCall.function.arguments)

      // Find the plugin that provides this tool
      const toolPlugins = this.pluginManager.getByType<ToolPlugin>('tool')
      const plugin = toolPlugins.find(p => p.getTool().name === functionName)

      if (!plugin) {
        throw new Error(`Tool '${functionName}' not found`)
      }

      console.log(`Executing tool: ${functionName}`, args)

      // Execute the tool with context
      const context = {
        sessionId: '', // TODO: Get from session
        messageId: toolCall.id
      }
      const result = await plugin.execute(args, context)

      return {
        toolCallId: toolCall.id,
        result: typeof result === 'string' ? result : JSON.stringify(result),
        timestamp: Date.now(),
      }
    } catch (error) {
      console.error('Tool execution error:', error)
      
      return {
        toolCallId: toolCall.id,
        result: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolCallResult[]> {
    console.log(`Executing ${toolCalls.length} tool calls...`)
    
    const promises = toolCalls.map(call => this.executeToolCall(call))
    const results = await Promise.all(promises)
    
    console.log(`Tool execution completed in ${Date.now() - results[0]?.timestamp || 0}ms`)
    
    return results
  }

  /**
   * Convert plugin parameters to OpenAI tool format
   */
  private convertParameters(params: Record<string, any>): Record<string, any> {
    const properties: Record<string, any> = {}

    for (const [key, value] of Object.entries(params)) {
      properties[key] = {
        type: value.type || 'string',
        description: value.description || '',
        ...(value.enum && { enum: value.enum }),
      }
    }

    return properties
  }

  /**
   * Get required parameter names
   */
  private getRequiredParams(params: Record<string, any>): string[] {
    return Object.entries(params)
      .filter(([_, value]) => value.required === true)
      .map(([key]) => key)
  }

  /**
   * Format tool results for AI context
   */
  formatToolResultsForAI(results: ToolCallResult[]): string {
    let formatted = '# Tool Execution Results\n\n'

    for (const result of results) {
      formatted += `## Tool Call ID: ${result.toolCallId}\n\n`
      
      if (result.error) {
        formatted += `**Error**: ${result.error}\n\n`
      } else {
        formatted += `**Result**:\n${result.result}\n\n`
      }
      
      formatted += `---\n\n`
    }

    return formatted
  }
}
