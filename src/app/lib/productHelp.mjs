const FEATURES = [
  { id:'golden-key', title:'Golden Key', surfaces:['sonoma','webb','mentor'], aliases:['golden key','golden keys','golden key bonus','golden key inventory'], script:'Golden Keys are an optional bonus-time feature. When Golden Keys are enabled, completing at least three tracked work phases within their time limits can earn a key. A key from the learner inventory can be applied to a Ms. Sonoma lesson, and the facilitator sets how much extra play time it adds.' },
  { id:'phase-timers', title:'Phase Timers', surfaces:['sonoma','webb','mentor'], aliases:['timer','phase timer','phase timers','play timer','work timer','lesson timer','lesson timers'], script:'Phase Timers divide timed lesson phases into play time and work time. The facilitator controls the timer settings for the learner, and an applied Golden Key can add bonus play time when that feature is enabled.' },
  { id:'session-flow', title:'Lesson Flow', surfaces:['sonoma','mentor'], aliases:['lesson flow','session flow','lesson phases','session phases','how lessons work'], script:'Ms. Sonoma lessons use application-controlled learning phases such as discussion or teaching, comprehension, exercise, worksheet, test, and closing according to the lesson path. The application, not the model, controls which phase is active and when progression occurs.' },
  { id:'repeat-button', title:'Repeat', surfaces:['sonoma','webb'], aliases:['repeat button','hear that again','say that again','replay that','repeat that'], script:'Repeat plays the current spoken lesson item again without moving you forward. Use it whenever you want to hear the current instruction or question one more time.' },
  { id:'mute-audio', title:'Mute Audio', surfaces:['sonoma','webb','mentor'], aliases:['mute audio','mute button','turn off sound','turn off the sound','turn off voice','unmute'], script:'The mute control turns the teacher or assistant voice off or back on. Muting changes audio playback, not the lesson or conversation itself.' },
  { id:'syllabus', title:'Syllabus', surfaces:['sonoma','webb','mentor'], aliases:['syllabus','my syllabus','active syllabus','syllabus plan'], script:'The Syllabus is the shared learning plan that keeps the learner and facilitator on the same page. It organizes planned lesson occurrences and lets the learner open the instructional experience assigned for that lesson while the facilitator remains in control of the plan.' },
  { id:'mrs-webb', title:'Mrs. Webb', surfaces:['sonoma','webb','mentor'], aliases:['mrs webb','mrs. webb','webb teacher'], script:'Mrs. Webb is the writing-focused instructional teacher. She helps the learner research and understand the lesson ideas, capture their own notes, and then turn those ideas into an ordered piece of writing without writing the learner response for them.' },
  { id:'mr-slate', title:'Mr. Slate', surfaces:['sonoma','webb','mentor'], aliases:['mr slate','mr. slate','slate practice','slate teacher'], script:'Mr. Slate is the mastery practice teacher for drillable work. Learners can use Mr. Slate practice from eligible Syllabus lessons, and facilitators can assign separate Mr. Slate practice occurrences.' },
  { id:'mr-mentor', title:'Mr. Mentor', surfaces:['sonoma','webb','mentor'], aliases:['mr mentor','mr. mentor','mentor assistant'], script:'Mr. Mentor is the facilitator-facing assistant. He helps the responsible adult work with Ms. Sonoma information and planning while the facilitator keeps educational authority and makes the decisions.' },
  { id:'lesson-generation', title:'Lesson Generation', surfaces:['mentor'], aliases:['lesson generation','lesson generator','generate a lesson','generate lessons','create a lesson','custom lesson'], script:'Lesson Generation creates lesson material from the facilitator request and learner context. Ms. Sonoma can generate lessons without requiring a pre-existing curriculum, and facilitator-supplied curriculum or lesson material can also be used as context.' },
  { id:'lesson-library', title:'Lesson Library', surfaces:['mentor'], aliases:['lesson library','my lessons','available lessons','browse lessons'], script:'The Lesson Library is where the facilitator can review lessons available to the account and work with lesson availability, editing, and scheduling controls.' },
  { id:'lesson-scheduling', title:'Lesson Scheduling', surfaces:['mentor'], aliases:['lesson scheduling','schedule a lesson','schedule lessons','lesson calendar'], script:'Lesson Scheduling places a lesson on a specific date for a learner. The Syllabus is the primary shared planning view, while dated lesson occurrences remain application-owned schedule data.' },
  { id:'lesson-editing', title:'Lesson Editing', surfaces:['mentor'], aliases:['lesson editing','lesson editor','edit a lesson','edit lesson','modify a lesson'], script:'Lesson Editing lets the facilitator review and change lesson content before it is used. The facilitator remains the authorizing adult for what the learner is assigned.' },
  { id:'visual-aids', title:'Visual Aids', surfaces:['mentor'], aliases:['visual aids','lesson images','lesson pictures'], script:'Visual Aids are lesson-linked images or other visual material used to make an idea easier to see. They support the learning material rather than replace it.' },
  { id:'goals-notes', title:'Goals and Notes', surfaces:['mentor'], aliases:['goals and notes','goals clipboard','learner goals','learner notes','progress notes'], script:'Goals and Notes let the facilitator keep learner-specific guidance and observations available across planning and support work. They are facilitator context, not automatic proof that a learner has mastered something.' },
  { id:'learner-transcript', title:'Learner Transcript', surfaces:['mentor'], aliases:['learner transcript','learner transcripts','session transcript','lesson transcript'], script:'Learner Transcripts preserve reviewable records of supported learning conversations. They give the facilitator visibility into what happened in a session.' },
  { id:'curriculum-preferences', title:'Curriculum Preferences', surfaces:['mentor'], aliases:['curriculum preferences','focus topics','avoid topics','learning preferences'], script:'Curriculum Preferences are learner-specific facilitator guidance used when planning and generating lessons, including areas to emphasize or avoid. They express facilitator intent and are not a curriculum requirement for lesson generation.' },
  { id:'weekly-pattern', title:'Weekly Pattern', surfaces:['mentor'], aliases:['weekly pattern','weekly subject pattern','schedule template'], script:'The Weekly Pattern is the facilitator-defined subject pattern used to shape the learner plan across the week. It is planning guidance used when building future work.' },
  { id:'custom-subjects', title:'Custom Subjects', surfaces:['mentor'], aliases:['custom subjects','custom subject','add a subject'], script:'Custom Subjects let a facilitator use subject labels beyond the default set when planning learning. They can be used in the same planning workflow as standard subjects.' },
  { id:'no-school-dates', title:'No-School Dates', surfaces:['mentor'], aliases:['no school dates','no-school dates','days off','skip dates'], script:'No-School Dates mark dates that should not receive normal planned school work. They keep days off inside the planning system.' },
  { id:'medals', title:'Medals', surfaces:['sonoma','webb','mentor'], aliases:['lesson medals','medal award','medals'], script:'Medals are learner achievement records tied to completed lesson performance. They summarize recorded results but do not replace the underlying learning evidence.' },
  { id:'pin-security', title:'Facilitator PIN', surfaces:['mentor'], aliases:['facilitator pin','security pin','pin security'], script:'The Facilitator PIN protects facilitator-only areas and actions from learner access. It is an authority boundary between the learner experience and facilitator controls.' },
  { id:'learning-games', title:'Learning Games', surfaces:['sonoma','mentor'], aliases:['learning games','lesson games','play a game','games button'], script:'Learning Games are optional activities available inside supported lesson play time. The session returns to the application-owned learning flow afterward.' },
  { id:'webb-video', title:'Mrs. Webb Video', surfaces:['webb'], aliases:['the video','lesson video','video button','watch video','open video','youtube video'], script:'Mrs. Webb can open a lesson-related video in the session. The video is supporting material for the current learning objective, and Mrs. Webb can use available moments to help the learner investigate the lesson.', action:'open_video' },
  { id:'webb-article', title:'Mrs. Webb Article', surfaces:['webb'], aliases:['the article','lesson article','article button','open article','wikipedia article'], script:'Mrs. Webb can open a lesson-related article inside the session as supporting reading material. She can use it to help the learner investigate the current objective and then return to the learning conversation.', action:'open_article' },
  { id:'webb-key-part', title:'Key Part', surfaces:['webb'], aliases:['key part','key part button','important part of the video','important part of the article'], script:'Key Part helps Mrs. Webb focus the learner on useful parts of an open video or article instead of treating the entire resource as equally important.' },
  { id:'webb-media-move', title:'Move Media', surfaces:['webb'], aliases:['move the video','move the article','switch side','move media'], script:'The move control repositions the open video or article within the Mrs. Webb lesson screen so the learner can keep the resource and conversation visible.' },
  { id:'webb-fullscreen', title:'Full Screen Media', surfaces:['webb'], aliases:['full screen video','fullscreen video','full screen article','fullscreen article','make the video bigger','make the article bigger'], script:'The full-screen control expands the open video or article for a larger view. Leave full screen to return to the normal Mrs. Webb lesson layout.' },
  { id:'webb-refresh-media', title:'Refresh Learning Resource', surfaces:['webb'], aliases:['different video','new video','different article','new article','refresh video','refresh article'], script:'The refresh control asks Mrs. Webb to look for a different supporting video or article for the lesson. The new resource still serves the current learning work.' },
  { id:'webb-close-media', title:'Close Learning Resource', surfaces:['webb'], aliases:['close the video','close video','close the article','close article','hide the video','hide the article'], script:'The close control removes the open video or article from the lesson view. Closing supporting media does not end the Mrs. Webb lesson.' },
  { id:'webb-skip-speech', title:'Skip', surfaces:['webb'], aliases:['skip button','skip speech','skip talking','stop talking'], script:'The Skip button stops Mrs. Webb’s current spoken audio and clears speech that is waiting to play. It does not mark the learning objective complete or skip the learner’s work.' },
]

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s.-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function containsPhrase(text, phrase) {
  if (!text || !phrase) return false
  return (` ${text} `).includes(` ${phrase} `)
}

function hasHelpIntent(text, raw) {
  return String(raw || '').includes('?') || /\b(what|whats|how|where|why|which|explain|describe|tell me|show me|can i|can you|could i|could you|do i|does|is there|feature|button|setting|work|works|use|using|about)\b/.test(text)
}

function looksLikeReport(text) {
  return /^(show|list|check|report)\b/.test(text)
    || /\b(how many|remaining|balance|inventory|current settings?|current status|whats scheduled|what is scheduled|learner goals|learner notes)\b/.test(text)
}

function looksLikeMentorAction(text) {
  return /^(please\s+)?(schedule|assign|generate|create|edit|move|reschedule|delete|remove|cancel|approve)\b/.test(text)
    || /^(please\s+)?(can|could|would) you (schedule|assign|generate|create|edit|move|reschedule|delete|remove|cancel|approve)\b/.test(text)
    || /^i (?:want|need|would like) to (schedule|assign|generate|create|edit|move|reschedule|delete|remove|cancel|approve)\b/.test(text)
}


function score(text, raw, feature) {
  const help = hasHelpIntent(text, raw)
  let best = 0
  const title = normalize(feature.title)
  if (text === title) best = 130
  else if (containsPhrase(text, title) && help) best = 112
  for (const rawAlias of feature.aliases || []) {
    const alias = normalize(rawAlias)
    const words = alias.split(' ').filter(Boolean).length
    if (text === alias) best = Math.max(best, words > 1 ? 125 : (help ? 105 : 0))
    else if (containsPhrase(text, alias)) {
      if (words > 1 && help) best = Math.max(best, 100 + Math.min(alias.length, 20) / 10)
      else if (words > 1) best = Math.max(best, 82)
      else if (help && alias.length >= 5) best = Math.max(best, 98)
    }
  }
  return best
}

export function getProductHelpFeature(id) { return FEATURES.find(f => f.id === String(id || '').trim()) || null }
export function getProductHelpScript(id) { return getProductHelpFeature(id)?.script || '' }

export function detectProductHelp(userInput, { surface = 'mentor', allowReports = false } = {}) {
  const text = normalize(userInput)
  if (!text) return null
  if (!allowReports && looksLikeReport(text)) return null
  if (surface === 'mentor' && looksLikeMentorAction(text)) return null
  const scored = FEATURES.filter(f => f.surfaces.includes(surface)).map(feature => ({ feature, score: score(text, userInput, feature) })).filter(x => x.score >= 78).sort((a,b) => b.score - a.score || b.feature.title.length - a.feature.title.length)
  if (!scored.length) return null
  const top = scored[0], second = scored[1]
  if (top.score >= 118 && (!second || top.score - second.score >= 12)) return { kind:'certain', feature:top.feature, features:[top.feature], score:top.score }
  const candidates = scored.filter(x => top.score - x.score <= 8).slice(0,3).map(x => x.feature)
  if (candidates.length === 1 && top.score >= 96) return { kind:'probable', feature:top.feature, features:candidates, score:top.score }
  if (candidates.length > 1 && top.score >= 90) return { kind:'ambiguous', feature:null, features:candidates, score:top.score }
  return null
}

export function productHelpHistoryMessage(role, content, featureId) {
  return { role, content:String(content || ''), kind:'product_help', featureId:featureId || null }
}

export const PRODUCT_HELP_IDS = Object.freeze(FEATURES.map(f => f.id))
