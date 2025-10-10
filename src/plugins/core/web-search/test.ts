// Test Script for Web Search Tool

import { WebSearchTool } from './index'

/**
 * Test 1: Check tool initialization
 */
async function testInitialization() {
  console.log('\n=== Test 1: Tool Initialization ===')
  
  new WebSearchTool()
  console.log('Tool initialized successfully')
  console.log('Using fetch-based scraper (browser-compatible)')
}

/**
 * Test 2: Simple search
 */
async function testSimpleSearch() {
  console.log('\n=== Test 2: Simple Search ===')
  
  const tool = new WebSearchTool()
  
  try {
    const results = await tool.search({
      query: 'TypeScript',
      maxResults: 3,
    })
    
    console.log('Query:', results.query)
    console.log('Results found:', results.results.length)
    console.log('Relevant chunks:', results.relevantChunks.length)
    console.log('Sources:', results.sources.length)
    
    if (results.results.length > 0) {
      console.log('\nFirst result:')
      console.log('- Title:', results.results[0].title)
      console.log('- URL:', results.results[0].url)
      console.log('- Snippet:', results.results[0].snippet.slice(0, 100) + '...')
    }
    
    await tool.cleanup()
  } catch (error) {
    console.error('Search failed:', error)
  }
}

/**
 * Test 3: Multiple results scraping
 */
async function testMultipleScraping() {
  console.log('\n=== Test 3: Multiple Results ===')
  
  const tool = new WebSearchTool()
  
  try {
    const results = await tool.search({
      query: 'React hooks tutorial',
      maxResults: 3,
    })
    
    console.log('Results found:', results.results.length)
    console.log('Content scraped:', results.relevantChunks.length, 'chunks')
    
    if (results.relevantChunks.length > 0) {
      console.log('\nMost relevant chunk:')
      console.log('Source:', results.relevantChunks[0].source)
      console.log('Relevance:', results.relevantChunks[0].relevance)
      console.log('Preview:', results.relevantChunks[0].content.slice(0, 150) + '...')
    }
    
    await tool.cleanup()
  } catch (error) {
    console.error('Multiple scraping test failed:', error)
  }
}

/**
 * Test 4: Formatted output
 */
async function testFormattedOutput() {
  console.log('\n=== Test 4: Formatted Output ===')
  
  const tool = new WebSearchTool()
  
  try {
    const formatted = await tool.searchAndFormat(
      { query: 'JavaScript async await', maxResults: 2 },
      'text'
    )
    
    console.log('Formatted output:')
    console.log(formatted.slice(0, 500) + '...')
    
    await tool.cleanup()
  } catch (error) {
    console.error('Format test failed:', error)
  }
}

/**
 * Test 5: Cache functionality
 */
async function testCache() {
  console.log('\n=== Test 5: Cache ===')
  
  const tool = new WebSearchTool()
  
  try {
    console.log('First search (no cache)...')
    console.time('First search')
    await tool.search({ query: 'Node.js', maxResults: 2 })
    console.timeEnd('First search')
    
    console.log('\nSecond search (cached)...')
    console.time('Cached search')
    await tool.search({ query: 'Node.js', maxResults: 2 })
    console.timeEnd('Cached search')
    
    const stats = tool.getCacheStats()
    console.log('\nCache stats:', stats)
    
    await tool.cleanup()
  } catch (error) {
    console.error('Cache test failed:', error)
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 Web Search Tool - Test Suite')
  console.log('================================')
  
  await testInitialization()
  await testSimpleSearch()
  await testMultipleScraping()
  await testFormattedOutput()
  await testCache()
  
  console.log('\n✅ All tests completed')
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error)
}

export {
  testInitialization,
  testSimpleSearch,
  testMultipleScraping,
  testFormattedOutput,
  testCache,
  runAllTests,
}
