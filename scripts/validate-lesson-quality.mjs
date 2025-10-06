#!/usr/bin/env node

/**
 * Lesson Quality Validation Script
 * 
 * Checks all lesson files for:
 * 1. Missing vocab definitions (words used in answers but not defined)
 * 2. Insufficient synonyms in expectedAny arrays
 * 3. Grade appropriateness issues
 * 4. Potential accuracy issues
 * 
 * Usage: node scripts/validate-lesson-quality.mjs [grade] [subject]
 * Examples:
 *   node scripts/validate-lesson-quality.mjs K "language arts"
 *   node scripts/validate-lesson-quality.mjs 5th math
 *   node scripts/validate-lesson-quality.mjs (validates all files)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MIN_EXPECTED_ANY = 2; // Minimum number of acceptable answers
const MIN_EXPECTED_ANY_SHORT = 3; // For short answer questions
const LESSONS_DIR = path.join(__dirname, '../public/lessons');

// Grade levels in order
const GRADES = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
const SUBJECTS = ['language arts', 'math', 'science', 'social studies'];

// Common words that don't need to be in vocab
const COMMON_WORDS = new Set([
  // Articles, pronouns, common verbs
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'could', 'may', 'might', 'must', 'can', 'am', 'i', 'you', 'he', 'she',
  'it', 'we', 'they', 'them', 'their', 'my', 'your', 'his', 'her', 'its',
  'our', 'me', 'him', 'us', 'who', 'what', 'when', 'where', 'why', 'how',
  
  // Prepositions and conjunctions
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'up', 'down',
  'out', 'over', 'under', 'and', 'or', 'but', 'not', 'if', 'so', 'as',
  'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'among', 'since', 'until', 'while', 'because', 'although',
  
  // Demonstratives and quantifiers
  'this', 'that', 'these', 'those', 'all', 'some', 'any', 'many', 'much',
  'more', 'most', 'less', 'few', 'several', 'each', 'every', 'both', 'either',
  'neither', 'other', 'another', 'such', 'same', 'different',
  
  // Common adjectives and adverbs
  'good', 'bad', 'big', 'small', 'long', 'short', 'high', 'low', 'new', 'old',
  'hot', 'cold', 'fast', 'slow', 'hard', 'easy', 'late', 'early', 'far', 'near',
  'very', 'too', 'also', 'only', 'just', 'still', 'even', 'well', 'back', 'again',
  'here', 'there', 'now', 'then', 'always', 'never', 'sometimes', 'often',
  
  // True/false and correctness
  'true', 'false', 'yes', 'no', 'correct', 'incorrect', 'right', 'wrong', 't', 'f',
  
  // Numbers
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
  'eighty', 'ninety', 'hundred', 'thousand', 'million', 'zero',
  
  // Ordinals
  'first', 'second', 'third', 'fourth', 'fifth', 'last', 'next',
  
  // Common school/question words
  'letter', 'number', 'word', 'sound', 'sentence', 'question', 'answer',
  'example', 'show', 'tell', 'explain', 'describe', 'write', 'read',
  'make', 'use', 'find', 'give', 'name', 'list', 'choose', 'pick',
  'get', 'put', 'take', 'come', 'go', 'went', 'going', 'made', 'using',
  'called', 'means', 'thing', 'things', 'way', 'ways', 'time', 'times',
  'day', 'days', 'year', 'years', 'people', 'person', 'student', 'students',
  
  // Common everyday words
  'like', 'want', 'need', 'know', 'think', 'see', 'look', 'help', 'work',
  'play', 'run', 'walk', 'talk', 'said', 'say', 'says', 'got', 'gets',
  'getting', 'inside', 'outside', 'around', 'away', 'home', 'school',
  'book', 'books', 'page', 'pages', 'story', 'stories',
]);

// Statistics
let stats = {
  filesScanned: 0,
  totalIssues: 0,
  issuesByType: {
    missingVocab: 0,
    insufficientSynonyms: 0,
    gradeLevel: 0,
    potentialAccuracy: 0,
  },
  issuesByGrade: {},
  issuesBySubject: {},
};

// Results storage
let allIssues = [];

/**
 * Normalize possibly non-array values to arrays
 */
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return [val];
  return [];
}

/**
 * Normalize expectedAny to an array of strings
 */
function toAnswers(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => typeof v === 'string');
  if (typeof val === 'string') return [val];
  return [];
}

/**
 * Normalize text for comparison
 */
function normalize(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract significant words from text
 */
function extractSignificantWords(text) {
  const normalized = normalize(text);
  const words = normalized.split(' ').filter(w => w.length > 2);
  return words.filter(w => !COMMON_WORDS.has(w));
}

/**
 * Check if vocab contains a term
 */
function vocabHasTerm(vocab, term) {
  const normalizedTerm = normalize(term);
  return vocab.some(v => {
    const normalizedVocabTerm = normalize(v.term);
    const normalizedDef = normalize(v.definition);
    return normalizedVocabTerm.includes(normalizedTerm) || 
           normalizedTerm.includes(normalizedVocabTerm) ||
           normalizedDef.includes(normalizedTerm);
  });
}

/**
 * Check for missing vocab definitions
 */
function checkMissingVocab(lesson, filePath) {
  const issues = [];
  const vocab = lesson.vocab || [];
  const vocabTerms = new Set(vocab.map(v => normalize(v.term)));
  
  // Check all answer types
  const questionTypes = ['fillintheblank', 'shortanswer'];
  
  questionTypes.forEach(type => {
    const list = toArray(lesson[type]);
    if (!list.length) return;
    
    list.forEach((q, idx) => {
      const expectedAny = toAnswers(q.expectedAny);
      if (!expectedAny.length) return;
      
      // Extract significant words from expected answers
      expectedAny.forEach(answer => {
        const words = extractSignificantWords(answer);
        
        words.forEach(word => {
          // Skip if it's a common word or already in vocab
          if (COMMON_WORDS.has(word)) return;
          if (vocabHasTerm(vocab, word)) return;
          
          // Only flag if word is clearly lesson-specific (longer technical terms)
          // Skip simple everyday words even if not in common list
          if (word.length < 4) return; // Skip short words
          
          // Check if word appears in the question itself
          const questionWords = extractSignificantWords(q.question || '');
          if (questionWords.includes(word)) {
            // This word is used but might not be defined
            const alreadyReported = issues.some(i => 
              i.word === word && i.questionType === type
            );
            
            if (!alreadyReported) {
              issues.push({
                type: 'missingVocab',
                severity: 'low', // Changed from medium to low
                questionType: type,
                questionIndex: idx,
                question: q.question,
                word: word,
                message: `Word "${word}" used in ${type} but not in vocab`,
              });
            }
          }
        });
      });
    });
  });
  
  return issues;
}

/**
 * Check for insufficient synonyms in expectedAny
 */
function checkInsufficientSynonyms(lesson, filePath) {
  const issues = [];
  // Only enforce synonyms for fill-in-the-blank and short answer, per requirements
  const questionTypes = ['fillintheblank', 'shortanswer'];
  
  questionTypes.forEach(type => {
    const list = toArray(lesson[type]);
    if (!list.length) return;
    
    list.forEach((q, idx) => {
      const answers = toAnswers(q.expectedAny);
      if (!answers.length) return;
      
      const minRequired = type === 'shortanswer' ? MIN_EXPECTED_ANY_SHORT : MIN_EXPECTED_ANY;
      
      if (answers.length < minRequired) {
        // Check if answers are too similar (not real synonyms)
        const uniqueNormalized = new Set(answers.map(normalize));
        
        if (uniqueNormalized.size < minRequired) {
          issues.push({
            type: 'insufficientSynonyms',
            severity: 'high',
            questionType: type,
            questionIndex: idx,
            question: q.question,
            currentCount: answers.length,
            minRequired: minRequired,
            answers: answers,
            message: `Only ${answers.length} answers, need at least ${minRequired} diverse synonyms`,
          });
        }
      }
      
      // Check for vague answers
      const vaguePatterns = [
        'varies by', 'personal answer', 'any', 'student', 'depends on',
        'drawing of', 'varies', 'multiple answers', 'answers vary',
      ];
      
      answers.forEach(answer => {
        const normalized = normalize(answer);
        vaguePatterns.forEach(pattern => {
          if (normalized.includes(pattern)) {
            issues.push({
              type: 'insufficientSynonyms',
              severity: 'critical',
              questionType: type,
              questionIndex: idx,
              question: q.question,
              vagueAnswer: answer,
              message: `Vague answer "${answer}" cannot be validated automatically`,
            });
          }
        });
      });
    });
  });
  
  return issues;
}

/**
 * Check grade appropriateness
 */
function checkGradeLevel(lesson, filePath) {
  const issues = [];
  const grade = lesson.grade;
  const difficulty = lesson.difficulty;
  
  // Grade-level vocabulary expectations
  const gradeExpectations = {
    'K': { maxWordLength: 8, maxSentenceWords: 8 },
    '1st': { maxWordLength: 10, maxSentenceWords: 10 },
    '2nd': { maxWordLength: 12, maxSentenceWords: 12 },
    '3rd': { maxWordLength: 14, maxSentenceWords: 15 },
    '4th': { maxWordLength: 16, maxSentenceWords: 18 },
    '5th': { maxWordLength: 18, maxSentenceWords: 20 },
  };
  
  const expectations = gradeExpectations[grade];
  if (!expectations) return issues; // Higher grades have more flexibility
  
  // Check vocab terms
  if (lesson.vocab) {
    lesson.vocab.forEach((v, idx) => {
      const termLength = v.term.length;
      const defWords = v.definition.split(' ').length;
      
      if (termLength > expectations.maxWordLength * 1.5) {
        issues.push({
          type: 'gradeLevel',
          severity: 'medium',
          section: 'vocab',
          index: idx,
          term: v.term,
          message: `Vocab term "${v.term}" may be too complex for ${grade} (${termLength} chars)`,
        });
      }
      
      if (defWords > expectations.maxSentenceWords * 1.5) {
        issues.push({
          type: 'gradeLevel',
          severity: 'low',
          section: 'vocab',
          index: idx,
          term: v.term,
          message: `Vocab definition for "${v.term}" may be too long for ${grade} (${defWords} words)`,
        });
      }
    });
  }
  
  // Check if Beginner difficulty has overly complex questions
  if (difficulty === 'Beginner') {
    ['sample', 'shortanswer'].forEach(type => {
      const list = toArray(lesson[type]);
      if (!list.length) return;
      
      list.forEach((q, idx) => {
        const wordCount = q.question.split(' ').length;
        
        if (wordCount > expectations.maxSentenceWords * 2) {
          issues.push({
            type: 'gradeLevel',
            severity: 'medium',
            questionType: type,
            questionIndex: idx,
            question: q.question,
            message: `Question too long for ${grade} Beginner (${wordCount} words)`,
          });
        }
      });
    });
  }
  
  return issues;
}

/**
 * Check for potential accuracy issues
 */
function checkAccuracy(lesson, filePath) {
  const issues = [];
  
  // Check for common factual errors
  const factChecks = [
    {
      pattern: /26 letters/i,
      wrongAnswers: ['24', '25', '27', '28', '30'],
      correct: '26',
      message: 'Alphabet has 26 letters',
    },
    {
      pattern: /5 vowels/i,
      wrongAnswers: ['3', '4', '6', '7', '10'],
      correct: '5',
      message: 'English has 5 vowels: A, E, I, O, U',
    },
    {
      pattern: /vowels.*A.*E.*I.*O.*U/i,
      wrongAnswers: ['Y'],
      correct: 'A E I O U',
      message: 'The 5 vowels are A, E, I, O, U (Y is sometimes)',
    },
  ];
  
  // Check all question types
  const allQuestions = []
    .concat(
      toArray(lesson.sample),
      toArray(lesson.truefalse),
      toArray(lesson.multiplechoice),
      toArray(lesson.fillintheblank),
      toArray(lesson.shortanswer),
      toArray(lesson.wordProblems)
    );
  
  allQuestions.forEach((q, idx) => {
  const questionText = normalize(q.question || '');
    
    factChecks.forEach(check => {
      if (check.pattern.test(questionText)) {
        // Check if wrong answers are present
        const answers = toAnswers(q.expectedAny);
        if (answers.length) {
          answers.forEach(answer => {
            check.wrongAnswers.forEach(wrong => {
              if (normalize(answer).includes(wrong)) {
                issues.push({
                  type: 'potentialAccuracy',
                  severity: 'critical',
                  question: q.question,
                  wrongAnswer: answer,
                  message: `${check.message} - found incorrect answer: ${answer}`,
                });
              }
            });
          });
        }
      }
    });
    
    // Check for contradictions in true/false
    if (q.answer !== undefined) {
      const hasTrue = questionText.includes('true') || questionText.includes('correct');
      const hasFalse = questionText.includes('false') || questionText.includes('incorrect');
      
      if (hasTrue && hasFalse) {
        issues.push({
          type: 'potentialAccuracy',
          severity: 'low',
          question: q.question,
          message: 'Question contains both "true" and "false" - may be confusing',
        });
      }
    }
  });
  
  return issues;
}

/**
 * Validate a single lesson file
 */
function validateLesson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lesson = JSON.parse(content);
    
    const fileIssues = {
      file: path.relative(LESSONS_DIR, filePath),
      grade: lesson.grade,
      subject: path.basename(path.dirname(filePath)),
      difficulty: lesson.difficulty,
      title: lesson.title,
      issues: [],
    };
    
    // Run all checks
    fileIssues.issues.push(...checkMissingVocab(lesson, filePath));
    fileIssues.issues.push(...checkInsufficientSynonyms(lesson, filePath));
    fileIssues.issues.push(...checkGradeLevel(lesson, filePath));
    fileIssues.issues.push(...checkAccuracy(lesson, filePath));
    
    // Update statistics
    stats.filesScanned++;
    stats.totalIssues += fileIssues.issues.length;
    
    fileIssues.issues.forEach(issue => {
      stats.issuesByType[issue.type]++;
    });
    
    if (fileIssues.issues.length > 0) {
      allIssues.push(fileIssues);
    }
    
    // Track by grade and subject
    const grade = lesson.grade || 'Unknown';
    const subject = path.basename(path.dirname(filePath));
    
    stats.issuesByGrade[grade] = (stats.issuesByGrade[grade] || 0) + fileIssues.issues.length;
    stats.issuesBySubject[subject] = (stats.issuesBySubject[subject] || 0) + fileIssues.issues.length;
    
    return fileIssues;
  } catch (error) {
    console.error(`Error processing ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Get all lesson files
 */
function getAllLessonFiles(gradeFilter = null, subjectFilter = null) {
  const files = [];
  
  SUBJECTS.forEach(subject => {
    if (subjectFilter && subject !== subjectFilter) return;
    
    const subjectDir = path.join(LESSONS_DIR, subject);
    if (!fs.existsSync(subjectDir)) return;
    
    const lessonFiles = fs.readdirSync(subjectDir)
      .filter(f => f.endsWith('.json'));
    
    lessonFiles.forEach(file => {
      if (gradeFilter) {
        const grade = file.split('_')[0];
        if (grade !== gradeFilter) return;
      }
      
      files.push(path.join(subjectDir, file));
    });
  });
  
  return files;
}

/**
 * Generate report
 */
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('LESSON QUALITY VALIDATION REPORT');
  console.log('='.repeat(80) + '\n');
  
  console.log('SUMMARY');
  console.log('-'.repeat(80));
  console.log(`Files Scanned: ${stats.filesScanned}`);
  console.log(`Total Issues Found: ${stats.totalIssues}`);
  console.log(`Files with Issues: ${allIssues.length}`);
  console.log(`Clean Files: ${stats.filesScanned - allIssues.length}\n`);
  
  console.log('ISSUES BY TYPE');
  console.log('-'.repeat(80));
  Object.entries(stats.issuesByType).forEach(([type, count]) => {
    console.log(`${type.padEnd(25)}: ${count}`);
  });
  console.log('');
  
  console.log('ISSUES BY GRADE');
  console.log('-'.repeat(80));
  GRADES.forEach(grade => {
    const count = stats.issuesByGrade[grade] || 0;
    if (count > 0) {
      console.log(`${grade.padEnd(10)}: ${count}`);
    }
  });
  console.log('');
  
  console.log('ISSUES BY SUBJECT');
  console.log('-'.repeat(80));
  Object.entries(stats.issuesBySubject)
    .sort((a, b) => b[1] - a[1])
    .forEach(([subject, count]) => {
      console.log(`${subject.padEnd(20)}: ${count}`);
    });
  console.log('');
  
  // Detailed issues
  console.log('DETAILED ISSUES (Top 20 files with most issues)');
  console.log('='.repeat(80) + '\n');
  
  allIssues
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 20)
    .forEach(fileIssue => {
      console.log(`FILE: ${fileIssue.file}`);
      console.log(`Grade: ${fileIssue.grade} | Subject: ${fileIssue.subject} | Difficulty: ${fileIssue.difficulty}`);
      console.log(`Title: ${fileIssue.title}`);
      console.log(`Issues: ${fileIssue.issues.length}\n`);
      
      // Group by type
      const byType = {};
      fileIssue.issues.forEach(issue => {
        if (!byType[issue.type]) byType[issue.type] = [];
        byType[issue.type].push(issue);
      });
      
      Object.entries(byType).forEach(([type, issues]) => {
        console.log(`  ${type.toUpperCase()} (${issues.length}):`);
        issues.slice(0, 3).forEach(issue => {
          console.log(`    - [${issue.severity}] ${issue.message}`);
          if (issue.question) {
            console.log(`      Q: ${issue.question.substring(0, 60)}...`);
          }
        });
        if (issues.length > 3) {
          console.log(`    ... and ${issues.length - 3} more\n`);
        } else {
          console.log('');
        }
      });
      
      console.log('-'.repeat(80) + '\n');
    });
  
  // Save full report to file
  const reportPath = path.join(__dirname, '../lesson-quality-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats,
    issues: allIssues,
  }, null, 2));
  
  console.log(`\nFull report saved to: ${reportPath}`);
  console.log(`\nTo view specific issues, run:`);
  console.log(`  node -e "console.log(JSON.parse(require('fs').readFileSync('${reportPath}', 'utf-8')).issues.slice(0,5))"`);
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const gradeFilter = args[0] || null;
  const subjectFilter = args[1] || null;
  
  console.log('Starting lesson quality validation...');
  if (gradeFilter) console.log(`Filtering by grade: ${gradeFilter}`);
  if (subjectFilter) console.log(`Filtering by subject: ${subjectFilter}`);
  console.log('');
  
  const files = getAllLessonFiles(gradeFilter, subjectFilter);
  console.log(`Found ${files.length} lesson files to validate\n`);
  
  // Validate all files
  files.forEach((file, idx) => {
    if (idx % 10 === 0) {
      process.stdout.write(`\rProgress: ${idx}/${files.length} files...`);
    }
    validateLesson(file);
  });
  
  console.log(`\rProgress: ${files.length}/${files.length} files... Done!\n`);
  
  // Generate report
  generateReport();
}

main();
