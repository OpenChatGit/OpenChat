// Quick test for shouldUseWebSearch function

function shouldUseWebSearch(query) {
  const lowerQuery = query.toLowerCase()
  
  const strongIndicators = [
    'search the web', 'search web', 'suche im web', 'web search',
    'google', 'google for', 'google nach',
    'suche nach', 'search for', 'finde im internet', 'find on the web',
    'look up', 'schau nach', 'recherchiere',
    'aktuell', 'current', 'latest', 'neueste', 'newest', 'recent',
    'heute', 'today', 'jetzt', 'now',
    'zeit', 'time', 'uhrzeit', 'datum', 'date',
    'wann', 'when',
    'wetter', 'weather',
    'nachrichten', 'news',
    '2024', '2025', '2026',
  ]
  
  const questionPatterns = [
    'was ist', 'what is', 'what are',
    'wer ist', 'who is',
    'wie viel', 'how much',
  ]
  
  const hasStrongIndicator = strongIndicators.some(keyword => 
    lowerQuery.includes(keyword)
  )
  
  const hasQuestionPattern = questionPatterns.some(pattern => 
    lowerQuery.includes(pattern)
  )
  
  return hasStrongIndicator || (hasQuestionPattern && lowerQuery.length > 15)
}

// Test cases
const testQueries = [
  "can you search the web for the current time and date in germany",
  "Was ist die aktuelle Zeit in Deutschland?",
  "Erkläre mir React Hooks",
  "What are the latest TypeScript features?",
  "Wie viel kostet ein Tesla?",
]

console.log('Testing shouldUseWebSearch:\n')
testQueries.forEach(query => {
  const result = shouldUseWebSearch(query)
  console.log(`${result ? '✅' : '❌'} "${query}"`)
  console.log(`   Result: ${result}\n`)
})
