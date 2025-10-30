/**
 * Debugging utilities for persona system
 * This helps diagnose why persona settings might not be working correctly
 */

export interface PersonaDebugInfo {
  sessionId: string
  sessionPersonaPrompt: string
  sessionPersonaEnabled: boolean
  localPersonaPrompt: string
  localPersonaEnabled: boolean
  isMatch: boolean
  issues: string[]
  suggestions: string[]
}

/**
 * Analyze persona state to debug issues
 */
export function debugPersonaState(
  sessionId: string,
  sessionPersonaPrompt: string | undefined,
  sessionPersonaEnabled: boolean | undefined,
  localPersonaPrompt: string,
  localPersonaEnabled: boolean
): PersonaDebugInfo {
  const issues: string[] = []
  const suggestions: string[] = []
  
  const normalizedSessionPrompt = sessionPersonaPrompt || ''
  const normalizedSessionEnabled = sessionPersonaEnabled || false
  
  // Check if local state matches session state
  const promptMatch = normalizedSessionPrompt === localPersonaPrompt
  const enabledMatch = normalizedSessionEnabled === localPersonaEnabled
  const isMatch = promptMatch && enabledMatch
  
  if (!isMatch) {
    issues.push('Local persona state does not match session state')
    
    if (!promptMatch) {
      issues.push(`Prompt mismatch: Session="${normalizedSessionPrompt.substring(0, 50)}" vs Local="${localPersonaPrompt.substring(0, 50)}"`)
      suggestions.push('The persona prompt in the session differs from the local state')
      suggestions.push('This might indicate a synchronization issue')
    }
    
    if (!enabledMatch) {
      issues.push(`Enabled mismatch: Session=${normalizedSessionEnabled} vs Local=${localPersonaEnabled}`)
      suggestions.push('The persona enabled flag in the session differs from the local state')
    }
    
    suggestions.push('Try switching to a different session and back to refresh the state')
  }
  
  // Check if persona is enabled but prompt is empty
  if (normalizedSessionEnabled && !normalizedSessionPrompt.trim()) {
    issues.push('Persona is enabled but prompt is empty')
    suggestions.push('Disable the persona or add a prompt to avoid confusion')
  }
  
  // Check if persona is disabled but prompt exists
  if (!normalizedSessionEnabled && normalizedSessionPrompt.trim()) {
    issues.push('Persona is disabled but prompt exists')
    suggestions.push('This is normal - the prompt is saved but not active')
  }
  
  return {
    sessionId,
    sessionPersonaPrompt: normalizedSessionPrompt,
    sessionPersonaEnabled: normalizedSessionEnabled,
    localPersonaPrompt,
    localPersonaEnabled,
    isMatch,
    issues,
    suggestions,
  }
}

/**
 * Log persona debug info to console
 */
export function logPersonaDebug(info: PersonaDebugInfo): void {
  console.group(`👤 Persona Debug: Session ${info.sessionId.substring(0, 8)}`)
  
  console.log('Session State:')
  console.log('  - Enabled:', info.sessionPersonaEnabled ? '✅' : '❌')
  console.log('  - Prompt:', info.sessionPersonaPrompt.substring(0, 100) || '(empty)')
  
  console.log('Local State:')
  console.log('  - Enabled:', info.localPersonaEnabled ? '✅' : '❌')
  console.log('  - Prompt:', info.localPersonaPrompt.substring(0, 100) || '(empty)')
  
  console.log('State Match:', info.isMatch ? '✅' : '❌')
  
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
  
  console.groupEnd()
}

/**
 * Enable persona debug mode
 * Call this in browser console: window.enablePersonaDebug()
 */
export function enablePersonaDebug(): void {
  (window as any).__PERSONA_DEBUG__ = true
  console.log('👤 Persona debug mode enabled')
  console.log('Persona state will be logged to console when sending messages')
}

/**
 * Disable persona debug mode
 */
export function disablePersonaDebug(): void {
  (window as any).__PERSONA_DEBUG__ = false
  console.log('👤 Persona debug mode disabled')
}

/**
 * Check if persona debug mode is enabled
 */
export function isPersonaDebugEnabled(): boolean {
  return !!(window as any).__PERSONA_DEBUG__
}

// Expose debug functions to window for easy access in browser console
if (typeof window !== 'undefined') {
  const w = window as any
  w.enablePersonaDebug = enablePersonaDebug
  w.disablePersonaDebug = disablePersonaDebug
}
