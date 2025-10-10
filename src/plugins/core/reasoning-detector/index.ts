// Reasoning Detector Plugin - Detects reasoning in AI messages
import type { ReasoningDetectorPlugin, ReasoningPart } from '../../types'

// Export the UI component
export { ReasoningBlock } from './ReasoningBlock'

export class ReasoningDetector implements ReasoningDetectorPlugin {
  metadata = {
    id: 'reasoning-detector',
    name: 'Reasoning Detector',
    version: '2.0.0',
    description: 'Detects and separates reasoning from final answers in AI messages. Supports <think> and <reasoning> tags.',
    author: 'OpenChat Team',
    type: 'reasoning-detector' as const,
    appVersion: '1.0.0',
    enabled: true,
    core: true,
  }

  // Known reasoning models that use <think> tags
  // Based on research from Ollama, LM Studio, and model documentation
  private reasoningModels = [
    // DeepSeek Reasoning Models
    'deepseek-r1',           // All sizes: 1.5b, 7b, 8b, 14b, 32b, 70b, 671b
    'deepseek-reasoner',
    'deepseek-r1-distill',   // Distilled versions
    
    // OpenAI Reasoning Models
    'o1',                    // o1-preview, o1-mini
    'o3',                    // o3, o3-mini
    
    // Qwen Reasoning Models
    'qwq',                   // QwQ-32B (Qwen reasoning)
    'qwen-r1',
    'qwen2.5-r1',
    'qwen3-thinking',        // Qwen3 with thinking mode
    'qwen3-4b-thinking',
    'qwen3-8b-thinking',
    'qwen3-32b-thinking',
    
    // Llama Reasoning Models (if any future versions)
    'llama-r1',
    'llama-reasoning',
    
    // Generic patterns
    '-r1',                   // Catches any model with -r1 suffix
    '-reasoning',            // Catches any model with -reasoning suffix
    'thinking'               // Catches models with "thinking" in name
  ]

  // Check if current model is a reasoning model
  isReasoningModel(modelName?: string): boolean {
    if (!modelName) return false
    const lowerModel = modelName.toLowerCase()
    return this.reasoningModels.some(rm => lowerModel.includes(rm))
  }

  parseReasoning(content: string, modelName?: string): ReasoningPart[] {
    const parts: ReasoningPart[] = []
    const isReasoningModel = this.isReasoningModel(modelName)
    
    // DEBUG: Log model detection
    if (modelName && content.length < 100) {
      console.log(`[Reasoning Detector] Model: ${modelName}, IsReasoning: ${isReasoningModel}`)
    }
    
    // OPTIMIZATION: Quick check - if content doesn't contain reasoning tags, return early
    const hasReasoningTags = /<(reasoning|think)>/i.test(content)
    const hasClosingTags = /<\/(reasoning|think)>/i.test(content)
    
    // For reasoning models, be more aggressive in detecting thinking process
    // They are trained to use <think> tags, so we should expect them
    
    // Support multiple formats: <reasoning>, <think>, <Think> (case-insensitive)
    const reasoningRegex = /<(reasoning|think)>([\s\S]*?)<\/(reasoning|think)>/gi
    let match
    let lastIndex = 0
    let foundReasoningBlocks = false
    
    while ((match = reasoningRegex.exec(content)) !== null) {
      foundReasoningBlocks = true
      
      // Text before tag
      if (match.index > lastIndex) {
        const beforeText = content.slice(lastIndex, match.index).trim()
        if (beforeText) {
          parts.push({ type: 'text', content: beforeText })
        }
      }
      
      // Reasoning content (match[2] contains the content between tags)
      const reasoningContent = match[2].trim()
      if (reasoningContent) {
        parts.push({ type: 'reasoning', content: reasoningContent })
      }
      
      lastIndex = match.index + match[0].length
    }
    
    if (foundReasoningBlocks) {
      // Text after last closing tag
      if (lastIndex < content.length) {
        const remainingText = content.slice(lastIndex).trim()
        if (remainingText) {
          parts.push({ type: 'text', content: remainingText })
        }
      }
      return parts
    }
    
    // Fallback 1: Incomplete streaming (has opening tag but no closing tag)
    if (hasReasoningTags && !hasClosingTags) {
      const reasoningTagMatch = content.match(/<(reasoning|think)>/i)
      if (!reasoningTagMatch) return [{ type: 'text', content }]
      
      const reasoningIndex = reasoningTagMatch!.index!
      const tagLength = reasoningTagMatch![0].length
      
      const beforeReasoning = content.slice(0, reasoningIndex).trim()
      const afterReasoning = content.slice(reasoningIndex + tagLength).trim()
      
      if (beforeReasoning) parts.push({ type: 'text', content: beforeReasoning })
      if (afterReasoning) parts.push({ type: 'reasoning', content: afterReasoning })
      return parts.length > 0 ? parts : [{ type: 'text', content }]
    }
    
    // Fallback 2: Only closing tag (no opening tag) - some models do this
    if (!hasReasoningTags && hasClosingTags) {
      const closingTagMatch = content.match(/<\/(reasoning|think)>/i)
      if (!closingTagMatch) return [{ type: 'text', content }]
      
      const closingIndex = closingTagMatch.index!
      const closingTagLength = closingTagMatch[0].length
      
      const reasoningContent = content.slice(0, closingIndex).trim()
      const finalAnswer = content.slice(closingIndex + closingTagLength).trim()
      
      if (reasoningContent && finalAnswer) {
        return [
          { type: 'reasoning', content: reasoningContent },
          { type: 'text', content: finalAnswer }
        ]
      } else if (reasoningContent) {
        return [{ type: 'reasoning', content: reasoningContent }]
      }
    }
    
    // Fallback 3: Pattern-based detection for streaming (before closing tag arrives)
    // IMPORTANT: Check for reasoning BEFORE checking for web search
    if (!hasReasoningTags && !hasClosingTags) {
      // Strong reasoning patterns that indicate thinking process
      const strongReasoningPatterns = [
        /^(Okay|Alright|Let me|I need to|I should|First|Step \d+)/i,
        /^(Analyzing|Considering|Looking at|Examining|Thinking)/i,
        /^(What|Why|How|If|Given|Since|So)/i,
        /^(Hmm|Wait|Actually|Let's see)/i,
      ]
      
      const lines = content.split('\n').filter(l => l.trim())
      const firstLine = lines[0] || ''
      
      // Check if it looks like reasoning
      const looksLikeStreamingReasoning = strongReasoningPatterns.some(p => p.test(firstLine))
      
      // AGGRESSIVE: If it looks like reasoning, treat it as reasoning
      // This works even without knowing the model name
      if (looksLikeStreamingReasoning && content.length > 20) {
        return [{ type: 'reasoning', content }]
      }
      
      // Fallback for models we know are reasoning models
      if (isReasoningModel) {
        // For known reasoning models, be even more aggressive
        if (content.length > 30 && lines.length > 1) {
          return [{ type: 'reasoning', content }]
        }
      } else {
        // Regular models: Very conservative detection
        const reasoningPatterns = [
          /^(Step \d+:|Analysis:|Reasoning:|Thought:|Thinking:)/i,
          /^(Let me think|I need to think|I should consider)/i,
        ]
        
        const lines = content.split('\n').filter(l => l.trim())
        const reasoningLineCount = lines.filter(line =>
          reasoningPatterns.some(pattern => pattern.test(line.trim()))
        ).length
        
        // Very conservative: Need 3+ matching lines AND substantial content
        if (reasoningLineCount >= 3 && content.length > 100) {
          return [{ type: 'reasoning', content }]
        }
      }
    }
    
    // OPTIMIZATION: Skip if content looks like FINAL web search answer
    // This check comes AFTER reasoning detection to not interfere with streaming
    const startsWithWebSearchPhrase = /^(Based on|According to|The search results)/i.test(content)
    const hasSourceCitations = /Source:/i.test(content) || /\[citation:\d+\]/i.test(content)
    const isSubstantialContent = content.length > 300
    const hasMultipleParagraphs = (content.match(/\n\n/g) || []).length >= 2
    
    // Only treat as final answer if it has ALL the markers of a complete response
    if (startsWithWebSearchPhrase && hasSourceCitations && (isSubstantialContent || hasMultipleParagraphs)) {
      return [{ type: 'text', content }]
    }
    
    // No reasoning detected - return as text
    return [{ type: 'text', content }]
  }

  onLoad() {
    console.log('[Reasoning Detector v2.0] Loaded')
    console.log('  - Supports <reasoning> and <think> tags')
    console.log('  - Model-aware detection for reasoning models')
    console.log('  - Supported providers: Ollama, LM Studio, llama.cpp, OpenAI')
    console.log('  - Known reasoning models:')
    console.log('    • DeepSeek-R1 (all sizes: 1.5b-671b)')
    console.log('    • QwQ-32B, Qwen3-Thinking series')
    console.log('    • OpenAI o1/o3 series')
    console.log('    • Auto-detects models with -r1, -reasoning, or thinking in name')
  }
}
