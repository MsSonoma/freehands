/**
 * V2 Services - API integrations
 * 
 * Clean service layer for TTS and lesson loading.
 * Zero coupling to session state or components.
 */

/**
 * Fetch TTS audio from Google Cloud TTS API
 * @param {string} text - Text to synthesize
 * @returns {Promise<string|null>} Base64-encoded MP3 audio or null on failure
 */
export async function fetchTTS(text) {
  if (!text?.trim()) return null;
  
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() })
    });
    
    if (!response.ok) {
      console.error('[TTS] API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.audio || null;
  } catch (err) {
    console.error('[TTS] Fetch error:', err);
    return null;
  }
}

/**
 * Fetch TTS for multiple sentences and combine
 * @param {string[]} sentences - Array of sentences to synthesize
 * @returns {Promise<string|null>} Combined base64 audio or null
 */
export async function fetchMultiSentenceTTS(sentences) {
  if (!sentences?.length) return null;
  
  // Combine sentences with natural pauses
  const combined = sentences.join(' ');
  return fetchTTS(combined);
}

/**
 * Load lesson data from public lessons directory
 * @param {string} lessonFilename - Lesson filename (e.g., "4th_Geometry_Angles_Classification_Beginner")
 * @param {string} subject - Subject folder (e.g., "math", "science", "language arts", "social studies")
 * @returns {Promise<Object>} Lesson data object
 */
export async function loadLesson(lessonFilename, subject = 'math') {
  if (!lessonFilename) {
    throw new Error('Lesson filename required');
  }
  
  try {
    // Normalize inputs
    const normalizedSubject = (subject || 'math').toLowerCase();
    // Strip .json if present, then add it back for consistency
    const baseFilename = lessonFilename.replace(/\.json$/i, '');
    const filename = `${baseFilename}.json`;
    
    // Try primary subject folder
    const subjectFolders = [normalizedSubject, 'math', 'language arts', 'science', 'social studies'];
    let response = null;
    let usedSubject = normalizedSubject;
    
    for (const folder of subjectFolders) {
      const url = `/lessons/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
      console.log('[Lesson] Trying:', url);
      response = await fetch(url);
      if (response.ok) {
        usedSubject = folder;
        break;
      }
      if (folder === normalizedSubject) {
        // Only try fallback folders if primary failed
        continue;
      }
    }
    
    if (!response || !response.ok) {
      throw new Error(`Lesson not found: ${filename}`);
    }
    
    const lessonData = await response.json();
    
    // Extract grade from filename (e.g., "4th" from "4th_Geometry...")
    const grade = baseFilename.split('_')[0] || '';
    
    return {
      key: baseFilename,
      title: lessonData.title || 'Untitled Lesson',
      subject: usedSubject,
      grade: grade,
      vocab: lessonData.vocab || [],
      examples: lessonData.examples || lessonData.example || [],
      comprehension: lessonData.comprehension || {},
      exercise: lessonData.exercise || [],
      worksheet: lessonData.worksheet || [],
      test: lessonData.test || [],
      discussion: lessonData.discussion || {},
      raw: lessonData
    };
  } catch (err) {
    console.error('[Lesson] Load error:', err);
    throw err;
  }
}

/**
 * Load lesson by subject and index
 * @param {string} subject - Subject name (e.g., "math", "language arts")
 * @param {string} grade - Grade level (e.g., "4th", "5th")
 * @param {number} index - Lesson index (1-based)
 * @returns {Promise<Object>} Lesson data
 */
export async function loadLessonByIndex(subject, grade, index) {
  const lessonKey = `${grade}_${subject.replace(/\s+/g, '_')}_${String(index).padStart(2, '0')}`;
  return loadLesson(lessonKey);
}

/**
 * Fallback: Generate test lesson when no lesson key provided
 * @returns {Object} Test lesson data
 */
export function generateTestLesson() {
  return {
    key: 'test_lesson',
    title: 'Photosynthesis Basics (Test)',
    subject: 'science',
    grade: '5th',
    vocab: [
      { term: 'Photosynthesis', definition: 'The process plants use to make food from sunlight.' },
      { term: 'Chlorophyll', definition: 'The green pigment in plants that captures light energy.' },
      { term: 'Carbon Dioxide', definition: 'A gas plants absorb from the air to make food.' }
    ],
    examples: [
      'Plants perform photosynthesis to create energy from sunlight.',
      'Chlorophyll makes leaves appear green during the growing season.',
      'Without carbon dioxide, photosynthesis cannot occur in plants.'
    ],
    comprehension: {
      question: 'How do plants make their own food?',
      sampleAnswer: 'Plants use photosynthesis to convert sunlight into energy.'
    },
    exercise: {
      questions: [
        {
          type: 'mc',
          question: 'What is the main purpose of photosynthesis?',
          options: [
            'To make food from sunlight',
            'To absorb water from soil',
            'To produce oxygen only',
            'To create carbon dioxide'
          ],
          answer: 'To make food from sunlight'
        },
        {
          type: 'mc',
          question: 'What gives plants their green color?',
          options: [
            'Water',
            'Chlorophyll',
            'Oxygen',
            'Soil nutrients'
          ],
          answer: 'Chlorophyll'
        },
        {
          type: 'tf',
          question: 'Plants need carbon dioxide to perform photosynthesis.',
          options: ['True', 'False'],
          answer: 'True'
        }
      ]
    },
    worksheet: {
      questions: [
        {
          question: 'Plants use a process called _____ to convert sunlight into energy.',
          answer: 'photosynthesis',
          hint: 'Think about the main process we learned about'
        },
        {
          question: 'The green pigment that captures light energy is called _____.',
          answer: 'chlorophyll',
          hint: 'It starts with "chloro"'
        },
        {
          question: 'Plants absorb _____ from the air to make food.',
          answer: 'carbon dioxide',
          hint: 'It\'s a gas with the formula CO2'
        }
      ]
    },
    test: {
      questions: [
        {
          type: 'mc',
          question: 'Which of these is NOT needed for photosynthesis?',
          options: [
            'Sunlight',
            'Water',
            'Soil nutrients',
            'Carbon dioxide'
          ],
          answer: 'Soil nutrients'
        },
        {
          type: 'fill',
          question: 'The main product of photosynthesis that plants use for energy is _____.',
          answer: 'glucose',
          hint: 'It\'s a type of sugar'
        },
        {
          type: 'tf',
          question: 'Photosynthesis only occurs in green plants.',
          options: ['True', 'False'],
          answer: 'False'
        },
        {
          type: 'mc',
          question: 'Where does photosynthesis primarily occur in a plant?',
          options: [
            'Roots',
            'Leaves',
            'Stems',
            'Flowers'
          ],
          answer: 'Leaves'
        }
      ]
    },
    discussion: {
      activities: [
        {
          type: 'ask',
          prompt: 'What are some things you already know about how plants grow?'
        },
        {
          type: 'riddle',
          prompt: 'I am green and I help plants make food. What am I?'
        },
        {
          type: 'poem',
          prompt: 'Plants need sunlight, water, and air. With these three gifts, they grow with care. They make their food through chemistry. This process is called photosynthesis, you see!'
        },
        {
          type: 'story',
          prompt: 'Once upon a time, there was a tiny seed. It got buried in the soil. Soon, rain came and the sun shone bright. The seed started to sprout! Day by day, it grew taller. Its green leaves reached for the sunlight. The plant was using photosynthesis to make its own food. And it grew strong and healthy!'
        },
        {
          type: 'fill-in-fun',
          prompt: 'Plants use _____ to make their food.',
          answer: 'sunlight',
          hint: 'It comes from the sky and makes you warm'
        }
      ]
    }
  };
}
