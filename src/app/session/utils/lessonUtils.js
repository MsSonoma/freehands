/**
 * Lesson utilities for loading and resolving lesson information.
 */

/**
 * Resolve lesson information from subject and lesson parameters.
 * Ensures proper .json extension.
 * 
 * @param {string} subject - The subject area (e.g., 'math', 'science')
 * @param {string} lesson - The lesson identifier or filename
 * @returns {Object} Object with title and file properties
 * @returns {string} return.title - The lesson title
 * @returns {string} return.file - The lesson filename with .json extension
 * 
 * @example
 * resolveLessonInfo('math', 'Addition_Basics')
 * // Returns: { title: 'Addition_Basics', file: 'Addition_Basics.json' }
 */
export function resolveLessonInfo(subject, lesson) {
  let base = lesson || "";
  // ensure filename ends with .json
  let file = base.endsWith('.json') ? base : `${base}.json`;
  return { title: lesson || "Lesson", file };
}

/**
 * Get the lesson title from lesson data with fallback options.
 * 
 * @param {Object} lessonData - The lesson data object
 * @param {Object} manifestInfo - The manifest information object
 * @param {string} fallback - Fallback title if none found
 * @returns {string} The resolved lesson title
 */
export function getLessonTitle(lessonData, manifestInfo = {}, fallback = "Lesson") {
  return (
    lessonData?.title || 
    lessonData?.lessonTitle || 
    manifestInfo?.title || 
    fallback
  );
}

/**
 * Build the lesson file path for fetching.
 * 
 * @param {string} subject - The subject area
 * @param {string} filename - The lesson filename
 * @returns {string} The full path to the lesson file
 */
export function buildLessonPath(subject, filename) {
  return `/lessons/${encodeURIComponent(subject)}/${encodeURIComponent(filename)}`;
}
