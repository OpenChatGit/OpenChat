/**
 * Test script for {title}...{/title} tag extraction
 * This tests the new robust title extraction format
 */

// Simulate the cleanAndValidateTitle function
function cleanAndValidateTitle(rawTitle: string): string | null {
  if (!rawTitle) return null
  
  let cleaned = rawTitle.trim()
  
  // Step 1: Try to extract title from {title}...{/title} tags first
  const titleMatch = cleaned.match(/\{title\}([\s\S]*?)\{\/title\}/i)
  if (titleMatch) {
    // Extract content between tags (even if empty)
    cleaned = titleMatch[1].trim()
    // If empty after extraction, return null early
    if (cleaned.length === 0) return null
  } else {
    // Fallback: Remove reasoning content
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    cleaned = cleaned.replace(/<think>[\s\S]*$/g, '').trim()
    cleaned = cleaned.replace(/<\/think>/g, '').trim()
  }
  
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

// Test cases for {title}...{/title} format
const testCases = [
  {
    name: 'Simple title with tags',
    input: '{title}CSS Centering Question{/title}',
    expected: 'CSS Centering Question'
  },
  {
    name: 'Title with reasoning before tags',
    input: '<think>Let me think about this...</think>{title}Python Debugging{/title}',
    expected: 'Python Debugging'
  },
  {
    name: 'Title with reasoning after tags',
    input: '{title}React Hooks Guide{/title}<think>That should work</think>',
    expected: 'React Hooks Guide'
  },
  {
    name: 'Title with reasoning before and after',
    input: '<think>Analyzing...</think>{title}TypeScript Basics{/title}<think>Good title</think>',
    expected: 'TypeScript Basics'
  },
  {
    name: 'Title with multi-line reasoning',
    input: `<think>
The user is asking about CSS.
Let me create a good title.
</think>{title}CSS Flexbox Layout{/title}`,
    expected: 'CSS Flexbox Layout'
  },
  {
    name: 'Title with case-insensitive tags',
    input: '{TITLE}JavaScript Promises{/TITLE}',
    expected: 'JavaScript Promises'
  },
  {
    name: 'Title with mixed case tags',
    input: '{Title}Node.js Basics{/Title}',
    expected: 'Node.js Basics'
  },
  {
    name: 'Title with extra whitespace inside tags',
    input: '{title}  Web Development  {/title}',
    expected: 'Web Development'
  },
  {
    name: 'Title with newlines inside tags',
    input: '{title}\nDatabase Design\n{/title}',
    expected: 'Database Design'
  },
  {
    name: 'Fallback: Plain text without tags',
    input: 'Simple Title',
    expected: 'Simple Title'
  },
  {
    name: 'Fallback: Text with old <think> tags',
    input: '<think>Reasoning...</think>API Integration',
    expected: 'API Integration'
  },
  {
    name: 'Fallback: Incomplete <think> tag',
    input: '<think>This is incomplete reasoning that never closes',
    expected: null
  },
  {
    name: 'Title with quotes inside tags',
    input: '{title}"Machine Learning"{/title}',
    expected: 'Machine Learning'
  },
  {
    name: 'Long title gets truncated',
    input: '{title}This is a very long title that exceeds the maximum allowed length and should be truncated{/title}',
    expected: 'This is a very long title that exceeds the maximum allowed l'
  },
  {
    name: 'Empty title tags',
    input: '{title}{/title}',
    expected: null
  },
  {
    name: 'Title tags with only whitespace',
    input: '{title}   \n\t  {/title}',
    expected: null
  },
  {
    name: 'Real-world reasoning model response',
    input: '<think>The user wants a title for a CSS question. I should make it concise and descriptive.</think>{title}CSS Grid Layout{/title}',
    expected: 'CSS Grid Layout'
  },
  {
    name: 'Qwen-style incomplete reasoning',
    input: '<think>Okay, the user wants me to generate a concise title for a chat conversation. The title needs{title}Docker Containers{/title}',
    expected: 'Docker Containers'
  }
]

console.log('Testing {title}...{/title} Tag Extraction\n')
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
