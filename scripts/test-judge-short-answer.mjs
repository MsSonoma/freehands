/**
 * Smoke test for /api/judge-short-answer endpoint
 * Run this with: node scripts/test-judge-short-answer.mjs
 * 
 * Prerequisites:
 * - Dev server running on http://localhost:3001
 * - OPENAI_API_KEY configured
 */

const BASE_URL = 'http://localhost:3001';

async function testJudge(testCase) {
  const { name, input, expectedCorrect } = testCase;
  
  console.log(`\nTesting: ${name}`);
  console.log(`Question: ${input.question}`);
  console.log(`Learner Answer: ${input.learnerAnswer}`);
  console.log(`Expected Answer: ${input.expectedAnswer}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/judge-short-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status}`);
      const text = await response.text();
      console.error(text);
      return false;
    }
    
    const result = await response.json();
    console.log(`Result: ${result.correct ? 'CORRECT' : 'INCORRECT'}`);
    console.log(`Feedback: ${result.feedback || 'none'}`);
    
    const passed = result.correct === expectedCorrect;
    console.log(passed ? '✅ PASSED' : '❌ FAILED');
    
    return passed;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('=== Short Answer Judge API Smoke Tests ===\n');
  
  const testCases = [
    {
      name: 'Exact match',
      input: {
        question: 'What is 2 + 2?',
        learnerAnswer: '4',
        expectedAnswer: '4',
      },
      expectedCorrect: true,
    },
    {
      name: 'Number word to digit',
      input: {
        question: 'What is 2 + 2?',
        learnerAnswer: 'four',
        expectedAnswer: '4',
      },
      expectedCorrect: true,
    },
    {
      name: 'Synonym match',
      input: {
        question: 'What is a large body of water called?',
        learnerAnswer: 'ocean',
        expectedAnswer: 'sea',
        expectedAny: ['ocean', 'sea'],
      },
      expectedCorrect: true,
    },
    {
      name: 'Keyword match (1 of 2)',
      input: {
        question: 'Explain photosynthesis.',
        learnerAnswer: 'Plants use sunlight to make food',
        expectedAnswer: 'process where plants convert sunlight to energy',
        keywords: ['sunlight', 'plants', 'energy'],
        minKeywords: 2,
      },
      expectedCorrect: true,
    },
    {
      name: 'Wrong answer',
      input: {
        question: 'What is the capital of France?',
        learnerAnswer: 'London',
        expectedAnswer: 'Paris',
      },
      expectedCorrect: false,
    },
    {
      name: 'Close but missing keyword',
      input: {
        question: 'What is gravity?',
        learnerAnswer: 'A pulling thing',
        expectedAnswer: 'force that pulls objects together',
        keywords: ['force', 'pull', 'objects'],
        minKeywords: 2,
      },
      expectedCorrect: false,
    },
    {
      name: 'Case insensitive',
      input: {
        question: 'What is DNA?',
        learnerAnswer: 'DEOXYRIBONUCLEIC ACID',
        expectedAnswer: 'deoxyribonucleic acid',
      },
      expectedCorrect: true,
    },
    {
      name: 'With filler words',
      input: {
        question: 'What is 5 times 3?',
        learnerAnswer: 'Well, I think it is 15',
        expectedAnswer: '15',
      },
      expectedCorrect: true,
    },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const result = await testJudge(testCase);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log('\n❌ Some tests failed.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
