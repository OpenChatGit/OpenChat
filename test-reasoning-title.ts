/**
 * Test script for reasoning model title cleaning
 * This tests that <think> tags are properly removed from titles
 */

// Simulate the cleanAndValidateTitle function
function cleanAndValidateTitle(rawTitle: string): string | null {
  if (!rawTitle) return null
  
  // Step 1: Remove reasoning content from reasoning models (o1, o3, qwen, etc.)
  let cleaned = rawTitle.trim()
  
  // Remove complete <think>...</think> pairs
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  
  // Remove incomplete/unclosed <think> tags (happens when max_tokens cuts off response)
  cleaned = cleaned.replace(/<think>[\s\S]*$/g, '').trim()
  
  // Remove any stray closing tags
  cleaned = cleaned.replace(/<\/think>/g, '').trim()
  
  // Step 2: Trim whitespace
  cleaned = cleaned.trim()
  
  // Step 3: Remove surrounding quotes
  while (cleaned.length > 0 && /^["'`''""«»]/.test(cleaned) && /["'`''""«»]$/.test(cleaned)) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  
  // Step 4: Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ')
  
  // Step 5: Remove problematic special characters
  cleaned = cleaned.replace(/[^\w\s.,!?:\-']/g, '')
  
  // Step 6: Final trim
  cleaned = cleaned.trim()
  
  // Validation
  if (cleaned.length < 3) return null
  if (/^[.,!?:\-\s]+$/.test(cleaned)) return null
  if (!/[a-zA-Z0-9]/.test(cleaned)) return null
  
  // Step 7: Limit to 60 characters
  if (cleaned.length > 60) {
    cleaned = cleaned.slice(0, 60).trim()
  }
  
  return cleaned
}

// Test cases for reasoning model responses
const testCases = [
  {
    name: 'Simple title without reasoning',
    input: 'CSS Centering Question',
    expected: 'CSS Centering Question'
  },
  {
    name: 'Title with reasoning tags',
    input: '<think>Let me analyze this question about CSS...</think>CSS Centering Question',
    expected: 'CSS Centering Question'
  },
  {
    name: 'Title with multi-line reasoning',
    input: `<think>
The user is asking about centering a div.
This is a common CSS question.
I should create a concise title.
</think>CSS Centering Question`,
    expected: 'CSS Centering Question'
  },
  {
    name: 'Title with reasoning and quotes',
    input: '<think>Analyzing...</think>"Python Code Debugging"',
    expected: 'Python Code Debugging'
  },
  {
    name: 'Only reasoning content (should fail)',
    input: '<think>This is just reasoning with no actual title</think>',
    expected: null
  },
  {
    name: 'Multiple reasoning blocks',
    input: '<think>First thought</think>React Hooks<think>Second thought</think>',
    expected: 'React Hooks'
  },
  {
    name: 'Reasoning with special characters',
    input: '<think>Let\'s think about this... The user wants to know about TypeScript.</think>TypeScript Basics',
    expected: 'TypeScript Basics'
  },
  {
    name: 'Title with reasoning in middle',
    input: 'Quantum<think>hmm, quantum computing</think>Computing Explanation',
    expected: 'QuantumComputing Explanation'
  },
  {
    name: 'Normal title with angle brackets in content',
    input: 'Using <Component> in React',
    expected: 'Using Component in React'
  },
  {
    name: 'Title after reasoning with extra whitespace',
    input: '<think>Analyzing the question...</think>   JavaScript Promises   ',
    expected: 'JavaScript Promises'
  },
  {
    name: 'Incomplete think tag (cut off by max_tokens)',
    input: '<think>Okay, the user wants me to generate a concise title for a chat conversation. The title needs',
    expected: null
  },
  {
    name: 'Incomplete think tag with partial title',
    input: '<think>Let me think about this... The user is asking about</think>CSS Centering',
    expected: 'CSS Centering'
  },
  {
    name: 'Stray closing tag',
    input: 'Python Debugging</think>',
    expected: 'Python Debugging'
  }
]

console.log('Testing Reasoning Model Title Cleaning\n')
console.log('='.repeat(60))

let passed = 0
let failed = 0

testCases.forEach((test, index) => {
  const result = cleanAndValidateTitle(test.input)
  const success = result === test.expected
  
  if (success) {
    passed++
    console.log(`✓ ${test.name}`)
  } else {
    failed++
    console.log(`✗ ${test.name}`)
    console.log(`  Input:    "${test.input.substring(0, 80)}${test.input.length > 80 ? '...' : ''}"`)
    console.log(`  Expected: ${test.expected === null ? 'null' : `"${test.expected}"`}`)
    console.log(`  Got:      ${result === null ? 'null' : `"${result}"`}`)
  }
})

console.log('='.repeat(60))
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`)

if (failed === 0) {
  console.log('\n✓ All tests passed!')
} else {
  console.log(`\n✗ ${failed} test(s) failed`)
  process.exit(1)
}
