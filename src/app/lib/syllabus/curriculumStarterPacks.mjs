export const CURRICULUM_STARTER_PACK_VERSION = '2026.1'

const CORE = Object.freeze({
  'k-2': {
    math: [
      ['number-sense', 'Build number sense, place value, counting, comparing, and representing quantities.'],
      ['operations', 'Develop addition and subtraction fluency through models, strategies, and word problems.'],
      ['measurement-data', 'Measure, compare, tell time, work with money, and represent simple data.'],
      ['geometry', 'Identify, compose, partition, and describe two- and three-dimensional shapes.'],
      ['reasoning', 'Explain mathematical thinking and choose strategies for age-appropriate problems.'],
    ],
    'language-arts': [
      ['foundational-reading', 'Strengthen phonological awareness, decoding, fluency, and automatic word recognition.'],
      ['reading-comprehension', 'Read stories and informational text and explain key ideas, details, sequence, and meaning.'],
      ['writing', 'Write complete sentences and short organized pieces for narrative, informational, and opinion purposes.'],
      ['language-vocabulary', 'Build vocabulary, grammar, spelling, and conventions through reading and writing.'],
      ['speaking-listening', 'Listen, discuss, ask and answer questions, and communicate ideas clearly.'],
    ],
    science: [
      ['observation-inquiry', 'Observe, ask questions, make predictions, collect evidence, and describe patterns.'],
      ['physical-science', 'Explore matter, motion, forces, energy, light, sound, and how materials behave.'],
      ['life-science', 'Study living things, needs, life cycles, habitats, and relationships with environments.'],
      ['earth-space', 'Explore weather, seasons, land, water, the sky, and recurring Earth and space patterns.'],
      ['engineering', 'Use simple design challenges to plan, build, test, and improve solutions.'],
    ],
    'social-studies': [
      ['community-history', 'Explore families, communities, past and present, chronology, and how people and places change.'],
      ['geography', 'Use maps, globes, location words, and physical and human features to understand places.'],
      ['civics', 'Learn about rules, responsibilities, community roles, cooperation, and basic civic participation.'],
      ['economics', 'Explore needs and wants, goods and services, work, choices, saving, and exchanging resources.'],
      ['culture-sources', 'Compare traditions and perspectives and use age-appropriate sources to learn about people and events.'],
    ],
  },
  '3-5': {
    math: [
      ['whole-number-operations', 'Build fluency with multi-digit whole-number operations and solve multi-step problems.'],
      ['fractions', 'Develop fraction equivalence, comparison, operations, and reasoning with visual models and number lines.'],
      ['decimals', 'Connect fractions and decimal notation and reason about decimal place value and operations where grade-appropriate.'],
      ['measurement-data', 'Use measurement, conversions, area, perimeter, volume where appropriate, and data representations to solve problems.'],
      ['geometry', 'Reason about angles, lines, shapes, coordinate ideas where appropriate, and geometric properties.'],
      ['mathematical-reasoning', 'Model problems, explain strategies, estimate, check reasonableness, and apply mathematics in unfamiliar situations.'],
    ],
    'language-arts': [
      ['literature', 'Read increasingly complex literature and explain theme, character, setting, structure, and evidence from the text.'],
      ['informational-reading', 'Read informational text and explain main ideas, supporting details, text structure, and evidence.'],
      ['writing', 'Write organized opinion, informative, and narrative pieces with clear structure, evidence, revision, and editing.'],
      ['language-vocabulary', 'Strengthen grammar, conventions, morphology, vocabulary, and word-learning strategies in context.'],
      ['research-speaking', 'Research focused questions, evaluate age-appropriate sources, present findings, and participate in collaborative discussion.'],
    ],
    science: [
      ['scientific-inquiry', 'Ask testable questions, plan investigations, measure, record data, identify patterns, and support explanations with evidence.'],
      ['physical-science', 'Study properties of matter, energy, forces, motion, and interactions among objects and materials.'],
      ['life-science', 'Study structures and functions of organisms, life cycles, heredity, adaptations, ecosystems, and environmental relationships.'],
      ['earth-space', 'Study Earth materials and processes, weather and climate patterns, natural resources, and the Earth-sun-moon system.'],
      ['engineering', 'Define problems, compare possible solutions, test designs, use evidence, and improve solutions under constraints.'],
    ],
    'social-studies': [
      ['history', 'Build chronological understanding of major people, events, causes, consequences, and change over time.'],
      ['geography', 'Use maps and geographic tools to analyze regions, movement, resources, environments, and human settlement.'],
      ['civics', 'Understand civic institutions, rights, responsibilities, rules, government roles, and participation in communities.'],
      ['economics', 'Understand production, trade, resources, incentives, saving, spending, and economic decision-making.'],
      ['sources-culture', 'Compare cultures and perspectives and use primary and secondary sources to support historical and civic explanations.'],
    ],
  },
  '6-8': {
    math: [
      ['ratios-proportions', 'Reason with ratios, rates, percentages, proportional relationships, and scale.'],
      ['number-system', 'Operate fluently with fractions, decimals, signed numbers, rational numbers, exponents, and roots where grade-appropriate.'],
      ['expressions-equations', 'Use expressions, equations, inequalities, and systems to represent and solve mathematical relationships.'],
      ['functions-patterns', 'Analyze patterns and functions, including linear relationships, tables, graphs, and multiple representations.'],
      ['geometry', 'Solve problems involving area, surface area, volume, transformations, similarity, congruence, and the Pythagorean relationship where appropriate.'],
      ['statistics-probability', 'Analyze distributions, variability, samples, probability, associations, and data-based claims.'],
    ],
    'language-arts': [
      ['literature-analysis', 'Analyze literature for theme, characterization, structure, point of view, language, and evidence.'],
      ['informational-analysis', 'Analyze informational and argumentative text for central ideas, structure, evidence, reasoning, and source use.'],
      ['argument-informative-writing', 'Write coherent arguments and informative texts using evidence, organization, revision, and precise language.'],
      ['narrative-writing', 'Write narratives with purposeful structure, detail, pacing, perspective, and reflection.'],
      ['language-vocabulary', 'Apply grammar and conventions while developing academic vocabulary, morphology, and style.'],
      ['research-speaking', 'Conduct research, evaluate source credibility, synthesize information, cite evidence, and present ideas effectively.'],
    ],
    science: [
      ['scientific-practices', 'Plan investigations, analyze data, model systems, evaluate evidence, and construct and revise explanations.'],
      ['physical-science', 'Study matter, chemical and physical change, energy transfer, forces, motion, waves, and interactions.'],
      ['life-science', 'Study cells, body systems, heredity, evolution, ecosystems, populations, and energy and matter in living systems.'],
      ['earth-space', 'Study Earth systems, geologic processes, weather and climate, resources, human impacts, astronomy, and the solar system.'],
      ['engineering', 'Define criteria and constraints, test competing solutions, analyze tradeoffs, and iteratively improve designs.'],
    ],
    'social-studies': [
      ['history', 'Analyze major historical periods, events, causes, consequences, continuity, and change using evidence and chronology.'],
      ['geography', 'Analyze physical and human geography, migration, settlement, regions, resources, and spatial relationships.'],
      ['civics-government', 'Study constitutional principles, government structures, rights, responsibilities, law, and civic participation.'],
      ['economics', 'Analyze markets, incentives, trade, specialization, public policy, personal finance, and economic decision-making.'],
      ['historical-thinking', 'Evaluate primary and secondary sources, compare perspectives, identify context and bias, and support claims with evidence.'],
    ],
  },
  '9-12': {
    math: [
      ['algebra', 'Develop and apply algebraic reasoning with equations, inequalities, expressions, systems, and mathematical models.'],
      ['functions', 'Analyze linear, quadratic, exponential, and other functions using equations, graphs, tables, and transformations.'],
      ['geometry-trigonometry', 'Use geometric reasoning, proof, similarity, congruence, coordinate methods, measurement, and trigonometric relationships.'],
      ['statistics-probability', 'Analyze data, variability, probability, sampling, inference, correlation, and statistical claims.'],
      ['advanced-modeling', 'Model real situations, justify assumptions, compare strategies, and communicate mathematical reasoning clearly.'],
    ],
    'language-arts': [
      ['literature-analysis', 'Analyze complex literature for theme, structure, language, perspective, context, and evidence.'],
      ['rhetoric-informational', 'Analyze informational and argumentative texts for claims, reasoning, rhetoric, evidence quality, and source credibility.'],
      ['argument-writing', 'Write sustained evidence-based arguments with clear claims, reasoning, counterclaims, organization, and revision.'],
      ['informative-writing', 'Write precise explanatory and analytical texts that synthesize evidence from multiple sources.'],
      ['research', 'Conduct independent research, evaluate and integrate sources, document evidence, and communicate findings responsibly.'],
      ['language-speaking', 'Use conventions, vocabulary, style, discussion, and presentation skills appropriate to audience and purpose.'],
    ],
    science: [
      ['scientific-practices', 'Design investigations, analyze uncertainty, use models, evaluate competing explanations, and argue from evidence.'],
      ['physical-science', 'Develop course-appropriate understanding of matter, energy, forces, motion, waves, atomic structure, and chemical interactions.'],
      ['life-science', 'Develop course-appropriate understanding of cells, genetics, evolution, ecology, homeostasis, and biological systems.'],
      ['earth-space', 'Develop course-appropriate understanding of Earth systems, climate, geology, resources, astronomy, and human impacts.'],
      ['engineering', 'Apply quantitative criteria and constraints to design, test, optimize, and communicate engineering solutions.'],
    ],
    'social-studies': [
      ['history', 'Analyze major historical eras, movements, institutions, conflicts, and change over time using contextual evidence.'],
      ['government-civics', 'Analyze constitutional government, law, rights, institutions, public policy, civic participation, and competing interpretations.'],
      ['economics', 'Analyze microeconomic and macroeconomic ideas, markets, institutions, trade, policy, and personal financial decisions.'],
      ['geography-global-studies', 'Analyze spatial, demographic, cultural, environmental, and geopolitical patterns at regional and global scales.'],
      ['historical-inquiry', 'Evaluate primary and secondary sources, corroborate evidence, compare interpretations, and construct defensible historical claims.'],
    ],
  },
})

function clean(value) {
  return String(value ?? '').trim()
}

export function normalizeStarterGrade(value) {
  const raw = clean(value).toUpperCase().replace(/^GRADE\s*/i, '').replace(/(?:ST|ND|RD|TH)$/i, '')
  if (raw === 'K' || raw === 'KG' || raw === 'KINDERGARTEN') return 'K'
  const number = Number.parseInt(raw, 10)
  return Number.isInteger(number) && number >= 1 && number <= 12 ? String(number) : null
}

function gradeBand(grade) {
  const normalized = normalizeStarterGrade(grade)
  if (!normalized) return '3-5'
  if (normalized === 'K') return 'k-2'
  const number = Number(normalized)
  if (number <= 2) return 'k-2'
  if (number <= 5) return '3-5'
  if (number <= 8) return '6-8'
  return '9-12'
}

function canonicalSubject(value) {
  const subject = clean(value).toLocaleLowerCase()
  if (!subject) return null
  if (['math', 'mathematics'].includes(subject)) return 'math'
  if (['language arts', 'english language arts', 'ela', 'english', 'reading', 'writing'].includes(subject)) return 'language-arts'
  if (subject === 'science') return 'science'
  if (['social studies', 'history', 'civics', 'government', 'economics', 'geography'].includes(subject)) return 'social-studies'
  return null
}

function prettyBand(band) {
  return band === 'k-2' ? 'K–2' : band.replace('-', '–')
}

function genericSubjectItems(subject) {
  const cleanSubject = clean(subject)
  if (!cleanSubject) return []
  const slug = cleanSubject.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'subject'
  return [
    [slug + '-foundations', 'Build foundational knowledge, vocabulary, and core skills in ' + cleanSubject + '.'],
    [slug + '-application', 'Apply ' + cleanSubject + ' knowledge through guided practice, explanation, and increasingly independent work.'],
    [slug + '-reasoning', 'Use evidence, reflection, and problem solving to explain understanding in ' + cleanSubject + '.'],
  ]
}

export function buildCurriculumStarterRecommendations({ grade = null, subjects = [] } = {}) {
  const band = gradeBand(grade)
  const gradeLabel = normalizeStarterGrade(grade) || prettyBand(band)
  const subjectList = [...new Set((subjects || []).map(clean).filter(Boolean))]
  const rows = []

  for (const subject of subjectList) {
    const key = canonicalSubject(subject)
    const items = key ? CORE[band][key] : genericSubjectItems(subject)
    for (const [group, statement] of items) {
      const subjectKey = key || subject.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'subject'
      const recommendationKey = [
        'starter',
        CURRICULUM_STARTER_PACK_VERSION,
        gradeLabel,
        subjectKey,
        group,
      ].join(':')
      rows.push({
        id: recommendationKey,
        recommendation_key: recommendationKey,
        recommendation_kind: 'ms_sonoma',
        subject,
        statement,
        planning_group_key: subjectKey + ':' + group,
        framework_id: null,
        code: null,
        external_id: null,
        grade_band: gradeLabel,
        sort_order: rows.length,
        framework: {
          id: null,
          name: 'Ms. Sonoma Core Starter · Grade ' + gradeLabel,
          version_label: CURRICULUM_STARTER_PACK_VERSION,
          jurisdiction: null,
          source_uri: null,
          source_kind: 'system',
        },
        metadata: {
          starter_pack_version: CURRICULUM_STARTER_PACK_VERSION,
          grade_band: band,
          recommendation_kind: 'ms_sonoma',
        },
      })
    }
  }

  return rows
}

export function mergeFrameworkAndStarterRecommendations({
  frameworkItems = [],
  starterItems = [],
  subjects = [],
} = {}) {
  const frameworkBySubject = new Map()
  for (const item of frameworkItems || []) {
    const key = clean(item.subject).toLocaleLowerCase()
    if (!key) continue
    const list = frameworkBySubject.get(key) || []
    list.push(item)
    frameworkBySubject.set(key, list)
  }

  const starterBySubject = new Map()
  for (const item of starterItems || []) {
    const key = clean(item.subject).toLocaleLowerCase()
    if (!key) continue
    const list = starterBySubject.get(key) || []
    list.push(item)
    starterBySubject.set(key, list)
  }

  const result = []
  for (const subject of [...new Set((subjects || []).map(clean).filter(Boolean))]) {
    const key = subject.toLocaleLowerCase()
    const imported = frameworkBySubject.get(key) || []
    if (imported.length) result.push(...imported)
    else result.push(...(starterBySubject.get(key) || []))
  }
  return result
}
