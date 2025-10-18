/**
 * Simple test script for SearchEngine
 * Run with: npx tsx test-search-engine.ts
 */

import { SearchEngine } from './src/lib/web-search/searchEngine';

async function testSearchEngine() {
  console.log('Testing SearchEngine...\n');
  
  const engine = new SearchEngine();
  
  // Test 1: Rate limit status
  console.log('1. Testing rate limit status:');
  const status = engine.getRateLimitStatus();
  console.log('   Requests remaining:', status.requestsRemaining);
  console.log('   Is limited:', status.isLimited);
  console.log('   Reset time:', status.resetTime);
  
  // Test 2: Simple search
  console.log('\n2. Testing search functionality:');
  try {
    const results = await engine.search('TypeScript programming', 3);
    console.log(`   Found ${results.length} results:`);
    results.forEach((result, i) => {
      console.log(`\n   Result ${i + 1}:`);
      console.log(`   Title: ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
    });
  } catch (error) {
    console.error('   Search failed:', error);
  }
  
  // Test 3: Rate limit status after search
  console.log('\n3. Rate limit status after search:');
  const statusAfter = engine.getRateLimitStatus();
  console.log('   Requests remaining:', statusAfter.requestsRemaining);
  console.log('   Is limited:', statusAfter.isLimited);
  
  console.log('\n✓ Test complete!');
}

testSearchEngine().catch(console.error);
