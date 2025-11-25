'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './about.module.css';

export default function AboutPage() {
  const [activeSection, setActiveSection] = useState('ai-safety');

  return (
    <main className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>About Ms. Sonoma</h1>
        <p className={styles.subtitle}>
          Understanding AI safety and how to use the app effectively
        </p>
      </div>

      <nav className={styles.nav}>
        <button 
          className={activeSection === 'ai-safety' ? styles.navActive : styles.navButton}
          onClick={() => setActiveSection('ai-safety')}
        >
          AI Safety First
        </button>
        <button 
          className={activeSection === 'how-to-use' ? styles.navActive : styles.navButton}
          onClick={() => setActiveSection('how-to-use')}
        >
          How to Use
        </button>
      </nav>

      <div className={styles.content}>
        {activeSection === 'ai-safety' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>AI Safety & Protection</h2>
            
            <div className={styles.safetyCard}>
              <h3 className={styles.cardTitle}>Learner-Facing AI: Tightly Safeguarded</h3>
              <p className={styles.cardText}>
                The only AI feature learners interact with is the <strong>"Ask"</strong> button 
                during lessons. This feature has six layers of protection:
              </p>
              
              <div className={styles.layersList}>
                <div className={styles.layer}>
                  <div className={styles.layerNumber}>1</div>
                  <div className={styles.layerContent}>
                    <h4>Input Validation & Keyword Filtering</h4>
                    <p>
                      All learner inputs are scanned for banned keywords including violence, 
                      weapons, sexual content, drugs, profanity, hate speech, and personal 
                      information requests. Inputs containing these are blocked immediately.
                    </p>
                  </div>
                </div>

                <div className={styles.layer}>
                  <div className={styles.layerNumber}>2</div>
                  <div className={styles.layerContent}>
                    <h4>Prompt Injection Detection</h4>
                    <p>
                      Advanced pattern matching detects attempts to manipulate the AI 
                      (e.g., &quot;ignore previous instructions&quot;, &quot;pretend you are&quot;, &quot;forget everything&quot;). 
                      These are blocked before reaching the AI.
                    </p>
                  </div>
                </div>

                <div className={styles.layer}>
                  <div className={styles.layerNumber}>3</div>
                  <div className={styles.layerContent}>
                    <h4>AI Moderation API</h4>
                    <p>
                      Before any question reaches Ms. Sonoma, it passes through OpenAI&apos;s 
                      Moderation API, which uses machine learning to detect harmful content 
                      across multiple categories.
                    </p>
                  </div>
                </div>

                <div className={styles.layer}>
                  <div className={styles.layerNumber}>4</div>
                  <div className={styles.layerContent}>
                    <h4>System Instruction Hardening</h4>
                    <p>
                      Every request to Ms. Sonoma includes strict safety rules that cannot be 
                      overridden. She is instructed to only discuss the current lesson vocabulary 
                      and to refuse all &quot;forbidden&quot; topics with a preset response.
                    </p>
                  </div>
                </div>

                <div className={styles.layer}>
                  <div className={styles.layerNumber}>5</div>
                  <div className={styles.layerContent}>
                    <h4>Output Validation</h4>
                    <p>
                      After Ms. Sonoma generates a response, it is validated again through 
                      keyword filtering and the Moderation API before being shown to the learner.
                    </p>
                  </div>
                </div>

                <div className={styles.layer}>
                  <div className={styles.layerNumber}>6</div>
                  <div className={styles.layerContent}>
                    <h4>Lesson Scope Enforcement</h4>
                    <p>
                      Ms. Sonoma only has access to the current lesson&apos;s vocabulary and teaching 
                      notes. She cannot access other lessons, user data, or external information.
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.highlight}>
                <strong>Technical Implementation:</strong> All safety code is located in 
                <code>src/lib/contentSafety.js</code> and enforced in <code>src/app/api/sonoma/route.js</code>. 
                The system "fails closed" - if any safety check encounters an error, the content is blocked.
              </div>
            </div>

            <div className={styles.safetyCard}>
              <h3 className={styles.cardTitle}>Facilitator-Only AI: PIN Protected</h3>
              <p className={styles.cardText}>
                Generative AI features that create new content are <strong>exclusively for facilitators</strong> 
                and are protected by PIN authentication:
              </p>
              
              <ul className={styles.featureList}>
                <li>
                  <strong>Lesson Rewriting:</strong> Uses AI to adapt lesson difficulty or reading level. 
                  Requires PIN to access (&quot;Rewrite Lesson&quot; button).
                </li>
                <li>
                  <strong>Visual Aid Generation:</strong> Creates images for lessons using DALL-E. 
                  Requires PIN to access.
                </li>
                <li>
                  <strong>Comprehension Item Creation:</strong> Generates practice questions. 
                  Requires PIN to access.
                </li>
              </ul>

              <p className={styles.cardText}>
                <strong>How PIN Protection Works:</strong> The first time a facilitator attempts to 
                access any AI feature, they must create a 4-digit PIN. This PIN is stored securely 
                (hashed) and required for all subsequent AI interactions. Learners cannot access 
                these features even if they navigate to facilitator pages.
              </p>

              <div className={styles.highlight}>
                <strong>Technical Implementation:</strong> PIN validation is enforced in 
                <code>src/app/lib/pinGate.js</code> with server-side verification.
              </div>
            </div>

            <div className={styles.safetyCard}>
              <h3 className={styles.cardTitle}>You Can Avoid AI Entirely</h3>
              <p className={styles.cardText}>
                The app is fully functional without using any AI features:
              </p>
              
              <ul className={styles.featureList}>
                <li>All pre-written lessons work without AI</li>
                <li>Comprehension questions can be written manually</li>
                <li>Visual aids can be uploaded from your own files</li>
                <li id="ai-features">
                  <strong>All four learner-facing AI features can be disabled individually per learner:</strong>
                  <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
                    <li><strong>Ask</strong> - Questions about lesson vocabulary</li>
                    <li><strong>Poem</strong> - Generate creative silly poems</li>
                    <li><strong>Story</strong> - Generate creative short stories</li>
                    <li><strong>Fill-in-Fun</strong> - Mad libs style creative game</li>
                  </ul>
                  Simply toggle any feature off in the Learner management page, and that button will be 
                  greyed out and non-functional for that learner across all lessons.
                </li>
                <li>Don&apos;t set a PIN and all facilitator AI features remain locked</li>
              </ul>

              <p className={styles.cardText}>
                <strong>Complete control over AI access:</strong> You can disable all four learner-facing 
                AI features (Ask, Poem, Story, Fill-in-Fun) for each individual learner. This ensures 
                they cannot interact with AI even if they click the buttons. Control is entirely in the 
                facilitator&apos;s hands, not the learner&apos;s.
              </p>
            </div>

            <div className={styles.safetyCard}>
              <h3 className={styles.cardTitle}>Data Privacy</h3>
              <ul className={styles.featureList}>
                <li>
                  <strong>No training data:</strong> Learner questions are never used to train AI models
                </li>
                <li>
                  <strong>No data sharing:</strong> Conversations are not shared with third parties 
                  beyond the AI provider (OpenAI) necessary to generate responses
                </li>
                <li>
                  <strong>Session isolation:</strong> Each lesson is a separate session; 
                  no conversation history is retained across lessons
                </li>
                <li>
                  <strong>Local control:</strong> All lesson content and learner progress 
                  is stored in your account, under your control
                </li>
              </ul>
            </div>
          </section>
        )}

        {activeSection === 'how-to-use' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>How to Use Ms. Sonoma</h2>
            
            <div className={styles.guideCard}>
              <h3 className={styles.cardTitle}>Getting Started</h3>
              <ol className={styles.stepList}>
                <li>
                  <strong>Create an account:</strong> Sign up with email or Google OAuth
                </li>
                <li>
                  <strong>Create learner profiles:</strong> Add each child/student with their name and grade
                </li>
                <li>
                  <strong>Browse lessons:</strong> Navigate to Learn → [Grade Level] → [Subject]
                </li>
                <li>
                  <strong>Select a lesson:</strong> Choose from pre-written curriculum aligned to standards
                </li>
                <li>
                  <strong>Start teaching:</strong> Click &quot;Teach This Lesson&quot; to begin
                </li>
              </ol>
            </div>

            <div className={styles.guideCard}>
              <h3 className={styles.cardTitle}>During a Lesson</h3>
              
              <div className={styles.featureExplain}>
                <h4>Teaching Phase</h4>
                <p>
                  Ms. Sonoma introduces vocabulary with definitions and examples. 
                  The learner can click &quot;Repeat Vocab&quot; to hear definitions again, 
                  or &quot;Next&quot; to move forward.
                </p>
              </div>

              <div className={styles.featureExplain} id="ai-features">
                <h4>Learner-Facing AI Features (All Content-Safety Protected)</h4>
                <p>
                  During lessons, learners have access to four optional AI features, each with 
                  six layers of safety protection (see AI Safety section). All can be disabled 
                  individually per learner in the Learner management page:
                </p>
                <ul className={styles.featureList}>
                  <li>
                    <strong>Ask</strong> - Type questions about lesson vocabulary. Questions must 
                    relate to the lesson topic and are filtered, moderated, and validated.
                  </li>
                  <li>
                    <strong>Poem</strong> - Generate creative silly poems.
                  </li>
                  <li>
                    <strong>Story</strong> - Generate creative short stories.
                  </li>
                  <li>
                    <strong>Fill-in-Fun</strong> - Mad libs style creative game.
                  </li>
                </ul>
                <p className={styles.protectionNote}>
                  <strong>Protection:</strong> All four features share the same 6-layer safety system. 
                  Each can be disabled per learner via toggle in Learner management.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Comprehension Phase</h4>
                <p>
                  After teaching, Ms. Sonoma asks practice questions. The learner 
                  responds by speaking (voice) or typing. Correct answers advance; 
                  incorrect answers receive hints.
                </p>
                <p className={styles.protectionNote}>
                  <strong>Getting Unstuck:</strong> If a learner is stuck on a problem, they can 
                  ask Ms. Sonoma for the answer in Comprehension, Exercise, and Worksheet phases. 
                  Test phase does not allow answers to maintain assessment integrity. Facilitators 
                  can access all answers through the Lesson Editor or the Facilitator&apos;s Answer Key 
                  if the Ask feature is disabled.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Notes Feature</h4>
                <p>
                  Facilitators can click &quot;Notes&quot; at any time to record observations 
                  about the learner&apos;s progress, struggles, or insights. Notes are 
                  timestamped and saved to the session report.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Session Report</h4>
                <p>
                  After the lesson, facilitators complete a brief survey about the 
                  learning environment and student engagement. This unlocks a detailed 
                  report with transcript, notes, and mastery summary.
                </p>
              </div>
            </div>

            <div className={styles.guideCard}>
              <h3 className={styles.cardTitle}>Facilitator Tools (PIN Protected AI)</h3>
              
              <p className={styles.cardText}>
                Access these from the Facilitator dashboard. First-time use requires 
                creating a 4-digit PIN.
              </p>

              <div className={styles.featureExplain}>
                <h4>Mr. Mentor (AI Assistant for Facilitators)</h4>
                <p>
                  Your all-in-one AI assistant for facilitator tasks. Mr. Mentor helps with 
                  lesson creation, editing, scheduling, comprehension question building, and 
                  provides guidance on curriculum planning and teaching strategies.
                </p>
                <p className={styles.protectionNote}>
                  <strong>Protection:</strong> PIN required. Full content safety guardrails apply. 
                  All generated content can be reviewed and approved before use.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Lesson Generator</h4>
                <p>
                  Create new custom lessons from scratch by providing a topic, grade level, 
                  and vocabulary words. AI generates a complete lesson with definitions and examples.
                </p>
                <p className={styles.protectionNote}>
                  <strong>Protection:</strong> PIN required. Review and approve before use.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Lesson Editor</h4>
                <p>
                  Edit existing lessons - adjust difficulty, reading level, or focus. 
                  Modify vocabulary, definitions, examples, or teaching notes.
                </p>
                <p className={styles.protectionNote}>
                  <strong>Protection:</strong> PIN required. Changes saved to your custom lesson library.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Lesson Scheduler</h4>
                <p>
                  Plan ahead by scheduling lessons for specific dates. View your lesson calendar 
                  and send scheduled lessons to your learner&apos;s portal for independent work.
                </p>
                <p className={styles.protectionNote}>
                  <strong>Organization:</strong> Keep track of curriculum progress and upcoming lessons.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Learner Portal Push</h4>
                <p>
                  Assign lessons directly to a learner&apos;s portal where they can access and complete 
                  them independently. Monitor progress and review completed work.
                </p>
                <p className={styles.protectionNote}>
                  <strong>Independence:</strong> Learners work at their own pace with automatic progress tracking.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Visual Aids</h4>
                <p>
                  Generate lesson illustrations using DALL-E or upload your own images. 
                  AI-generated images can be reviewed and approved before adding to lessons.
                </p>
                <p className={styles.protectionNote}>
                  <strong>Protection:</strong> PIN required. Generation prompts are pre-validated.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Comprehension Builder</h4>
                <p>
                  Create practice questions automatically based on lesson vocabulary. 
                  Review and edit before adding to lessons.
                </p>
                <p className={styles.protectionNote}>
                  <strong>Protection:</strong> PIN required. Questions reviewed before learner exposure.
                </p>
              </div>
            </div>

            <div className={styles.guideCard}>
              <h3 className={styles.cardTitle}>Managing Learners</h3>
              <ul className={styles.featureList}>
                <li>View all learner profiles from Facilitator → Learners</li>
                <li>Edit names, grades, and archived status</li>
                <li>View session history and progress reports per learner</li>
                <li>Archive learners who are no longer active (preserves data)</li>
              </ul>
            </div>

            <div className={styles.guideCard}>
              <h3 className={styles.cardTitle}>Session Reports & Evidence</h3>
              <p className={styles.cardText}>
                Each lesson session generates a comprehensive report for homeschool 
                or classroom documentation:
              </p>
              <ul className={styles.featureList}>
                <li><strong>Transcript:</strong> Full conversation between learner and Ms. Sonoma</li>
                <li><strong>Timestamped notes:</strong> Facilitator observations during the lesson</li>
                <li><strong>Mastery summary:</strong> Which concepts were mastered, which need review</li>
                <li><strong>Comprehension answers:</strong> What the learner got right/wrong</li>
                <li><strong>Duration:</strong> How long the lesson took</li>
                <li><strong>Environment survey:</strong> Context about learning conditions</li>
              </ul>
            </div>

            <div className={styles.guideCard}>
              <h3 className={styles.cardTitle}>Best Practices</h3>
              <ul className={styles.featureList}>
                <li>
                  <strong>Be present:</strong> Facilitators should supervise lessons, 
                  especially when learners might use the Ask feature
                </li>
                <li>
                  <strong>Take notes:</strong> Use the Notes feature to capture insights 
                  in real-time
                </li>
                <li>
                  <strong>Review reports:</strong> Use session reports to track progress 
                  and identify patterns
                </li>
                <li>
                  <strong>Customize lessons:</strong> Use the rewriter tool to adapt 
                  content to individual learning needs
                </li>
                <li>
                  <strong>Limit Ask usage:</strong> Encourage learners to think first, 
                  then ask if truly stuck
                </li>
                <li>
                  <strong>Keep PIN secure:</strong> Don&apos;t share your facilitator PIN 
                  with learners
                </li>
              </ul>
            </div>

            <div className={styles.guideCard}>
              <h3 className={styles.cardTitle}>Troubleshooting</h3>
              
              <div className={styles.featureExplain}>
                <h4>Voice not working?</h4>
                <p>
                  Check browser permissions for microphone access. For best overall experience, 
                  use Firefox.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Ask feature blocked?</h4>
                <p>
                  The question may have triggered safety filters. Try rephrasing to 
                  focus specifically on lesson vocabulary.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Forgot PIN?</h4>
                <p>
                  Contact support to reset. For security, PINs cannot be recovered, 
                  only reset.
                </p>
              </div>

              <div className={styles.featureExplain}>
                <h4>Lesson not loading?</h4>
                <p>
                  Check internet connection. Lessons require active connection to 
                  load content and sync progress.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className={styles.footer}>
        <Link href="/" className={styles.backButton}>← Back to Home</Link>
      </div>
    </main>
  );
}
