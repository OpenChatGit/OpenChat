/**
 * Test script for enhanced fallback title generation
 * This tests the new generateFallbackTitle function with various inputs
 */

// Simulate the generateFallbackTitle function
function generateFallbackTitle(message: string): string {
  if (!message || message.trim().length === 0) {
    return 'New Chat'
  }
  
  let cleaned = message.trim()
  
  // Step 1: Remove markdown code blocks and replace with placeholder
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '[code]')
  cleaned = cleaned.replace(/`[^`]+`/g, '[code]')
  
  // Step 2: Remove other markdown formatting
  // Images: ![alt](url) - must come before links to avoid conflicts
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]')
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '')
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1')
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1')
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1')
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1')
  cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1')
  cleaned = cleaned.replace(/^>\s+/gm, '')
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '')
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '')
  
  // Step 3: Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  // Step 4: If still empty after cleaning, return default
  if (cleaned.length === 0) {
    return 'New Chat'
  }
  
  // Step 5: Truncate to reasonable length (50 chars) at word boundary
  if (cleaned.length > 50) {
    const truncated = cleaned.slice(0, 50)
    const lastSpace = truncated.lastIndexOf(' ')
    
    if (lastSpace > 20) {
      cleaned = truncated.slice(0, lastSpace) + '...'
    } else {
      cleaned = truncated + '...'
    }
  }
  
  // Step 6: Final validation
  if (cleaned === '[code]' || cleaned === '[image]' || cleaned.length < 3) {
    return 'New Chat'
  }
  
  return cleaned
}

// Test cases
const testCases = [
  {
    name: 'Simple text',
    input: 'How do I center a div in CSS?',
    expected: 'How do I center a div in CSS?'
  },
  {
    name: 'Text with inline code',
    input: 'How do I use `useState` in React?',
    expected: 'How do I use [code] in React?'
  },
  {
    name: 'Text with code block',
    input: 'Debug this code:\n```javascript\nconst x = 1;\n```',
    expected: 'Debug this code: [code]'
  },
  {
    name: 'Text with bold markdown',
    input: 'How to use **React hooks** effectively?',
    expected: 'How to use React hooks effectively?'
  },
  {
    name: 'Text with italic markdown',
    input: 'Explain *quantum computing* basics',
    expected: 'Explain quantum computing basics'
  },
  {
    name: 'Text with link',
    input: 'Check out [this article](https://example.com)',
    expected: 'Check out this article'
  },
  {
    name: 'Text with image',
    input: 'Look at this: ![screenshot](image.png)',
    expected: 'Look at this: [image]'
  },
  {
    name: 'Text with header',
    input: '# My Question\nHow does this work?',
    expected: 'My Question How does this work?'
  },
  {
    name: 'Text with list',
    input: '- Item 1\n- Item 2\n- Item 3',
    expected: 'Item 1 Item 2 Item 3'
  },
  {
    name: 'Long text truncation',
    input: 'This is a very long message that should be truncated at around 50 characters to ensure readability',
    expected: 'This is a very long message that should be...'
  },
  {
    name: 'Empty string',
    input: '',
    expected: 'New Chat'
  },
  {
    name: 'Only whitespace',
    input: '   \n\t  ',
    expected: 'New Chat'
  },
  {
    name: 'Only code block',
    input: '```\ncode here\n```',
    expected: 'New Chat'
  },
  {
    name: 'Mixed markdown',
    input: '**Bold** and *italic* with `code` and [link](url)',
    expected: 'Bold and italic with [code] and link'
  },
  {
    name: 'Blockquote',
    input: '> This is a quote\nAnd this is not',
    expected: 'This is a quote And this is not'
  }
]

console.log('Testing Enhanced Fallback Title Generation\n')
console.log('='.repeat(60))

let passed = 0
let failed = 0

testCases.forEach(test => {
  const result = generateFallbackTitle(test.input)
  const success = result === test.expected
  
  if (success) {
    passed++
    console.log(`✓ ${test.name}`)
  } else {
    failed++
    console.log(`✗ ${test.name}`)
    console.log(`  Input:    "${test.input}"`)
    console.log(`  Expected: "${test.expected}"`)
    console.log(`  Got:      "${result}"`)
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
