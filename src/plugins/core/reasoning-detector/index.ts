// Reasoning Detector Plugin - Detects reasoning in AI messages
import type { ReasoningDetectorPlugin, ReasoningPart } from '../../types'

// Export the UI component
export { ReasoningBlock } from './ReasoningBlock'

export class ReasoningDetector implements ReasoningDetectorPlugin {
  metadata = {
    id: 'reasoning-detector',
    name: 'Reasoning Detector',
    version: '1.0.0',
    description: 'Detects and separates reasoning from final answers in AI messages',
    author: 'OpenChat Team',
    type: 'reasoning-detector' as const,
    appVersion: '1.0.0',
    enabled: true,
    core: true,
  }

  parseReasoning(content: string): ReasoningPart[] {
    const parts: ReasoningPart[] = []
    
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
    const reasoningTagMatch = content.match(/<(reasoning|think)>/i)
    const closingTagMatch = content.match(/<\/(reasoning|think)>/i)
    const hasReasoningTag = reasoningTagMatch !== null
    const hasClosingTag = closingTagMatch !== null
    
    if (hasReasoningTag && !hasClosingTag) {
      const reasoningIndex = reasoningTagMatch!.index!
      const tagLength = reasoningTagMatch![0].length
      
      const beforeReasoning = content.slice(0, reasoningIndex).trim()
      const afterReasoning = content.slice(reasoningIndex + tagLength).trim()
      
      if (beforeReasoning) parts.push({ type: 'text', content: beforeReasoning })
      if (afterReasoning) parts.push({ type: 'reasoning', content: afterReasoning })
      return parts.length > 0 ? parts : [{ type: 'text', content }]
    }
    
    // Fallback 2: Only closing tag (no opening tag) - some models do this
    if (!hasReasoningTag && hasClosingTag) {
      const closingIndex = closingTagMatch!.index!
      const closingTagLength = closingTagMatch![0].length
      
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
    // Enhanced patterns to catch more reasoning indicators
    const reasoningPatterns = [
      // Common reasoning starters
      /^(Okay|Alright|Well|So|Now|First|Let me think|I need to|I should|I'll|I will)/i,
      /^(Looking at|Analyzing|Considering|Examining|Reviewing|Checking)/i,
      // Structured reasoning
      /^(Step \d+:|Analysis:|Reasoning:|Thought:|Thinking:|Wait,|Hmm,)/i,
      // Question-based reasoning
      /^(What|Why|How|When|Where|Which|Who).*\?/i,
      // Conditional reasoning
      /^(If|Given|Since|Because|As|When)/i,
      // Meta-cognitive markers
      /^(This means|Therefore|Thus|Hence|So,|In other words)/i,
    ]
    
    const lines = content.split('\n').filter(l => l.trim())
    
    // Check if ANY line starts with reasoning pattern
    const hasReasoningPatterns = lines.some(line => 
      reasoningPatterns.some(pattern => pattern.test(line.trim()))
    )
    
    // Count how many lines look like reasoning
    const reasoningLineCount = lines.filter(line =>
      reasoningPatterns.some(pattern => pattern.test(line.trim()))
    ).length
    
    // More aggressive detection during streaming:
    // - If 2+ lines match patterns and content is substantial
    // - OR if first line matches and content is growing
    if (hasReasoningPatterns && reasoningLineCount >= 2 && content.length > 50) {
      return [{ type: 'reasoning', content }]
    }
    
    // If it starts with reasoning pattern and has some content
    const startsWithReasoning = lines.length > 0 && reasoningPatterns.some(pattern => 
      pattern.test(lines[0].trim())
    )
    
    if (startsWithReasoning && content.length > 30) {
      return [{ type: 'reasoning', content }]
    }
    
    // No reasoning detected - return as text
    return [{ type: 'text', content }]
  }

  onLoad() {
    console.log('[Reasoning Detector] Loaded - supports <reasoning> and <think> tags')
  }
}
