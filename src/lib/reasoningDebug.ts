/**
 * Debugging utilities for reasoning models
 * This helps diagnose why reasoning content might not be showing
 */

import { hasReasoningCapability } from './visionDetection'

export interface ReasoningDebugInfo {
    modelName: string
    isReasoningModel: boolean
    hasReasoningTags: boolean
    hasReasoningContent: boolean
    reasoningTagCount: number
    contentPreview: string
    issues: string[]
    suggestions: string[]
}

/**
 * Analyze a model response to debug reasoning issues
 */
export function debugReasoningResponse(
    modelName: string,
    response: string,
    rawResponse?: any
): ReasoningDebugInfo {
    const issues: string[] = []
    const suggestions: string[] = []

    // Check if model is recognized as reasoning-capable
    const isReasoningModel = hasReasoningCapability(modelName)
    if (!isReasoningModel) {
        issues.push('Model is not recognized as a reasoning model')
        suggestions.push('Check if the model name matches patterns in hasReasoningCapability()')
        suggestions.push('Add the model pattern to src/lib/visionDetection.ts if needed')
    }

    // Check for reasoning tags in content
    const thinkTagRegex = /<think>[\s\S]*?<\/think>/gi
    const thinkingTagRegex = /<thinking>[\s\S]*?<\/thinking>/gi
    const reasoningTagRegex = /<reasoning>[\s\S]*?<\/reasoning>/gi
    const reasoningCodeBlockRegex = /```reasoning[\s\S]*?```/gi

    const thinkMatches = response.match(thinkTagRegex) || []
    const thinkingMatches = response.match(thinkingTagRegex) || []
    const reasoningMatches = response.match(reasoningTagRegex) || []
    const codeBlockMatches = response.match(reasoningCodeBlockRegex) || []

    const hasReasoningTags =
        thinkMatches.length > 0 ||
        thinkingMatches.length > 0 ||
        reasoningMatches.length > 0 ||
        codeBlockMatches.length > 0

    const reasoningTagCount =
        thinkMatches.length +
        thinkingMatches.length +
        reasoningMatches.length +
        codeBlockMatches.length

    if (isReasoningModel && !hasReasoningTags) {
        issues.push('Model is recognized as reasoning-capable but response contains no reasoning tags')
        suggestions.push('The model might not be outputting reasoning in the expected format')
        suggestions.push('Try asking a more complex question that requires step-by-step thinking')
        suggestions.push('Check if the model needs specific prompts to trigger reasoning output')
    }

    // Check for reasoning_content field in raw response
    const hasReasoningContent = !!(
        rawResponse?.reasoning_content ||
        rawResponse?.message?.reasoning_content ||
        rawResponse?.choices?.[0]?.message?.reasoning_content ||
        rawResponse?.choices?.[0]?.delta?.reasoning_content
    )

    if (isReasoningModel && !hasReasoningContent && !hasReasoningTags) {
        issues.push('No reasoning content found in either reasoning_content field or inline tags')
        suggestions.push('For OpenAI o1/o3: Check if the API is returning reasoning_content field')
        suggestions.push('For Ollama/LM Studio: Check if the model outputs <think> tags')
        suggestions.push('Enable browser DevTools and check the actual API response')
    }

    // Check for incomplete reasoning tags (streaming issue)
    const hasOpenThinkTag = response.includes('<think>') && !response.includes('</think>')
    const hasOpenThinkingTag = response.includes('<thinking>') && !response.includes('</thinking>')
    const hasOpenReasoningTag = response.includes('<reasoning>') && !response.includes('</reasoning>')

    if (hasOpenThinkTag || hasOpenThinkingTag || hasOpenReasoningTag) {
        issues.push('Incomplete reasoning tags detected (missing closing tag)')
        suggestions.push('This might be a streaming issue - wait for the response to complete')
        suggestions.push('If the issue persists, the model might be cutting off reasoning mid-stream')
    }

    // Generate content preview
    const contentPreview = response.length > 200
        ? response.substring(0, 200) + '...'
        : response

    return {
        modelName,
        isReasoningModel,
        hasReasoningTags,
        hasReasoningContent,
        reasoningTagCount,
        contentPreview,
        issues,
        suggestions,
    }
}

/**
 * Log reasoning debug info to console
 */
export function logReasoningDebug(info: ReasoningDebugInfo): void {
    console.group(`🧠 Reasoning Debug: ${info.modelName}`)

    console.log('Model recognized as reasoning:', info.isReasoningModel ? '✅' : '❌')
    console.log('Has reasoning tags:', info.hasReasoningTags ? '✅' : '❌')
    console.log('Has reasoning_content field:', info.hasReasoningContent ? '✅' : '❌')
    console.log('Reasoning tag count:', info.reasoningTagCount)

    if (info.issues.length > 0) {
        console.group('⚠️ Issues Found:')
        info.issues.forEach(issue => console.warn(issue))
        console.groupEnd()
    }

    if (info.suggestions.length > 0) {
        console.group('💡 Suggestions:')
        info.suggestions.forEach(suggestion => console.info(suggestion))
        console.groupEnd()
    }

    console.log('Content preview:', info.contentPreview)

    console.groupEnd()
}

/**
 * Enable reasoning debug mode
 * Call this in browser console: window.enableReasoningDebug()
 */
export function enableReasoningDebug(): void {
    (window as any).__REASONING_DEBUG__ = true
    console.log('🧠 Reasoning debug mode enabled')
    console.log('Reasoning responses will be logged to console')
}

/**
 * Disable reasoning debug mode
 */
export function disableReasoningDebug(): void {
    (window as any).__REASONING_DEBUG__ = false
    console.log('🧠 Reasoning debug mode disabled')
}

/**
 * Check if reasoning debug mode is enabled
 */
export function isReasoningDebugEnabled(): boolean {
    return !!(window as any).__REASONING_DEBUG__
}

// Expose debug functions to window for easy access in browser console
if (typeof window !== 'undefined') {
    const w = window as any
    w.enableReasoningDebug = enableReasoningDebug
    w.disableReasoningDebug = disableReasoningDebug
}
