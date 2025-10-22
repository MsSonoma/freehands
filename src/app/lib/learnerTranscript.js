/**
 * Generate a transcript of learner progress for Mr. Mentor counseling context
 */

import { getMedalsForLearner, tierForPercent } from '@/app/lib/medalsClient';

/**
 * Build a text transcript summarizing a learner's progress
 * @param {Object} learner - Learner data from database
 * @param {Object} medals - Medals data by lesson key
 * @returns {string} - Formatted transcript text
 */
export async function buildLearnerTranscript(learner, medals) {
  if (!learner) return '';

  const lines = [];
  
  // Basic info with ID for scheduling
  lines.push(`LEARNER PROFILE:`);
  lines.push(`ID: ${learner.id}`);
  lines.push(`Name: ${learner.name || 'Unknown'}`);
  if (learner.grade) {
    lines.push(`Grade: ${learner.grade}`);
  }
  
  // Target goals
  lines.push(``);
  lines.push(`LEARNING TARGETS:`);
  lines.push(`- Comprehension: ${learner.comprehension ?? learner.targets?.comprehension ?? 'Not set'}`);
  lines.push(`- Exercise: ${learner.exercise ?? learner.targets?.exercise ?? 'Not set'}`);
  lines.push(`- Worksheet: ${learner.worksheet ?? learner.targets?.worksheet ?? 'Not set'}`);
  lines.push(`- Test: ${learner.test ?? learner.targets?.test ?? 'Not set'}`);
  
  // Session timer setting
  if (learner.session_timer_minutes) {
    lines.push(`- Session Duration: ${learner.session_timer_minutes} minutes`);
  }
  
  // Golden Keys
  if (learner.golden_keys != null) {
    lines.push(``);
    lines.push(`GOLDEN KEYS: ${learner.golden_keys} available`);
  }
  
  // Approved lessons count
  const approvedLessons = learner.approved_lessons || {};
  const approvedCount = Object.keys(approvedLessons).length;
  if (approvedCount > 0) {
    lines.push(``);
    lines.push(`APPROVED LESSONS: ${approvedCount} lessons approved by facilitator`);
    
    // Group by subject
    const bySubject = {};
    Object.keys(approvedLessons).forEach(key => {
      const [subject, ...rest] = key.split('/');
      if (!bySubject[subject]) bySubject[subject] = [];
      bySubject[subject].push(rest.join('/'));
    });
    
    Object.keys(bySubject).sort().forEach(subject => {
      lines.push(`  - ${subject}: ${bySubject[subject].length} lessons`);
    });
  }
  
  // Lesson notes from facilitator
  const lessonNotes = learner.lesson_notes || {};
  const notesKeys = Object.keys(lessonNotes).filter(key => lessonNotes[key]);
  if (notesKeys.length > 0) {
    lines.push(``);
    lines.push(`FACILITATOR NOTES ON LESSONS:`);
    notesKeys.sort().forEach(key => {
      const [subject, ...rest] = key.split('/');
      const lessonName = rest.join('/').replace(/\.json$/, '').replace(/_/g, ' ');
      lines.push(``);
      lines.push(`${subject} - ${lessonName}:`);
      lines.push(`  "${lessonNotes[key]}"`);
    });
  }
  
  // Medals and progress
  if (medals && Object.keys(medals).length > 0) {
    lines.push(``);
    lines.push(`PROGRESS & ACHIEVEMENTS:`);
    
    const lessonKeys = Object.keys(medals).sort();
    const goldCount = lessonKeys.filter(k => medals[k].medalTier === 'gold').length;
    const silverCount = lessonKeys.filter(k => medals[k].medalTier === 'silver').length;
    const bronzeCount = lessonKeys.filter(k => medals[k].medalTier === 'bronze').length;
    const totalLessons = lessonKeys.length;
    
    lines.push(`Total Lessons Attempted: ${totalLessons}`);
    lines.push(`Medals Earned: 🥇 ${goldCount} Gold, 🥈 ${silverCount} Silver, 🥉 ${bronzeCount} Bronze`);
    
    // Group by subject with scores
    const bySubject = {};
    lessonKeys.forEach(key => {
      const [subject, ...rest] = key.split('/');
      if (!bySubject[subject]) bySubject[subject] = [];
      const medal = medals[key];
      const tier = medal.medalTier || 'none';
      const emoji = tier === 'gold' ? '🥇' : tier === 'silver' ? '🥈' : tier === 'bronze' ? '🥉' : '';
      const lessonName = rest.join('/').replace(/\.json$/, '').replace(/_/g, ' ');
      bySubject[subject].push({
        name: lessonName,
        percent: medal.bestPercent || 0,
        tier: tier,
        emoji: emoji
      });
    });
    
    Object.keys(bySubject).sort().forEach(subject => {
      lines.push(``);
      lines.push(`${subject.toUpperCase()}:`);
      
      // Sort by percent descending
      bySubject[subject].sort((a, b) => b.percent - a.percent);
      
      // Show top 10 lessons per subject to avoid overwhelming context
      const lessons = bySubject[subject].slice(0, 10);
      lessons.forEach(lesson => {
        lines.push(`  ${lesson.emoji} ${lesson.name}: ${lesson.percent}%`);
      });
      
      if (bySubject[subject].length > 10) {
        lines.push(`  ... and ${bySubject[subject].length - 10} more lessons`);
      }
    });
  }
  
  return lines.join('\n');
}

/**
 * Fetch complete learner data and build transcript
 * @param {string} learnerId - Learner ID
 * @param {Object} supabase - Supabase client
 * @returns {Promise<string>} - Formatted transcript
 */
export async function fetchLearnerTranscript(learnerId, supabase) {
  if (!learnerId || !supabase) return '';
  
  try {
    // Fetch learner data
    const { data: learner, error } = await supabase
      .from('learners')
      .select('*')
      .eq('id', learnerId)
      .maybeSingle();
    
    if (error || !learner) {
      console.error('[Learner Transcript] Failed to fetch learner:', error);
      return '';
    }
    
    // Fetch medals
    const medals = await getMedalsForLearner(learnerId);
    
    // Build transcript
    return await buildLearnerTranscript(learner, medals);
  } catch (err) {
    console.error('[Learner Transcript] Error building transcript:', err);
    return '';
  }
}
