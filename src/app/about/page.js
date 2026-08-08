import Link from 'next/link';
import styles from './about.module.css';

export const metadata = {
  title: 'About Ms. Sonoma',
  description:
    'How Ms. Sonoma combines mastery-first AI learning facilitation with educator authorship, session evidence, and practical boundaries.',
};

const phases = [
  {
    name: 'Discussion',
    description: 'Open the topic, surface prior knowledge, and give the learner a reason to engage.',
  },
  {
    name: 'Teaching',
    description: 'Explain ideas, vocabulary, and examples in language suited to the lesson.',
  },
  {
    name: 'Comprehension',
    description: 'Ask questions, listen to the learner, and respond to signs of confusion.',
  },
  {
    name: 'Exercise',
    description: 'Move from explanation into guided practice with feedback and another attempt.',
  },
  {
    name: 'Worksheet',
    description: 'Give the learner room for more independent practice while preserving the session record.',
  },
  {
    name: 'Test',
    description: 'Collect assessment responses that the educator can review alongside the rest of the session.',
  },
  {
    name: 'Completion',
    description: 'Close the session, recognize the work, and make the resulting evidence available for review.',
  },
];

const aiReasons = [
  {
    title: 'Patient repetition',
    text: 'An explanation can be repeated or approached another way without social pressure or frustration.',
  },
  {
    title: 'Responsive interaction',
    text: 'The next instructional turn can respond to what the learner just said instead of following a fixed recording.',
  },
  {
    title: 'One-to-one pacing',
    text: 'A session can pause, revisit, or continue around one learner rather than the pace of a whole group.',
  },
  {
    title: 'Useful documentation',
    text: 'The application can preserve the exchanges and responses an educator may want to examine later.',
  },
];

const educatorControls = [
  'Choose from built-in lessons or supply lesson material.',
  'Generate lesson drafts, then review, revise, and approve them before use.',
  'Manage learner settings and the optional AI features available to a learner.',
  'Assign or schedule lessons and decide when a learner should use them.',
  'Review available transcripts, responses, scores, progress, and notes.',
  'Intervene, adapt the next lesson, or make a different educational decision.',
];

const records = [
  {
    title: 'Session snapshots',
    text: 'The application can save the current phase, completed phases, phase data, timer state, and timestamps so a session can resume.',
  },
  {
    title: 'Transcripts and responses',
    text: 'What Ms. Sonoma and the learner said, along with available question responses, can be retained for educator readback.',
  },
  {
    title: 'Local and account-backed persistence',
    text: 'Snapshots are saved locally first and can also be persisted through authenticated account storage when those services are configured.',
  },
];

export default function AboutPage() {
  return (
    <main className={styles.container}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>About Ms. Sonoma</p>
        <h1 className={styles.title}>
          Can AI facilitate learning better than humans while empowering educators?
        </h1>
        <p className={styles.subtitle}>
          Ms. Sonoma is a mastery-first AI learning facilitator. That question is the
          hypothesis we are building and testing—not a proven comparison.
        </p>
        <p className={styles.heroStatement}>
          The learner&apos;s understanding is the purpose. AI can take greater responsibility
          for the work of teaching without taking authority over the education.
        </p>
      </header>

      <nav className={styles.sectionNav} aria-label="About page sections">
        <a href="#what-it-is">What it is</a>
        <a href="#learning">During learning</a>
        <a href="#why-ai">Why AI</a>
        <a href="#educator-control">Educator control</a>
        <a href="#records">Records</a>
        <a href="#ai-features">Safety &amp; privacy</a>
      </nav>

      <article className={styles.content}>
        <section className={styles.section} id="what-it-is">
          <div className={styles.sectionHeading}>
            <p className={styles.sectionKicker}>01 · What Ms. Sonoma is</p>
            <h2>A learning facilitator, not a chatbot beside a lesson</h2>
          </div>
          <div className={styles.twoColumn}>
            <p className={styles.lead}>
              Ms. Sonoma actively participates in the instructional session. The application
              supplies lesson material, keeps track of the current step and progression, and
              preserves session state. AI performs meaningful teaching interactions using the
              current instructional prompt and the learner&apos;s input.
            </p>
            <aside className={styles.principleCard}>
              <span>Mastery first</span>
              <p>
                The goal is not to keep a learner occupied for a set amount of time. The goal is
                to move learning forward, notice uncertainty, provide practice, and create
                evidence an educator can interpret.
              </p>
            </aside>
          </div>
        </section>

        <section className={styles.section} id="learning">
          <div className={styles.sectionHeading}>
            <p className={styles.sectionKicker}>02 · What happens during learning</p>
            <h2>A structured path from conversation to assessment</h2>
            <p>
              A full session can include the stages below. The exact starting point and path can
              vary by lesson, resume state, and session configuration; stages may be skipped or
              combined when the experience calls for it.
            </p>
          </div>
          <ol className={styles.phaseGrid}>
            {phases.map((phase, index) => (
              <li className={styles.phaseCard} key={phase.name}>
                <span className={styles.phaseNumber}>{String(index + 1).padStart(2, '0')}</span>
                <h3>{phase.name}</h3>
                <p>{phase.description}</p>
              </li>
            ))}
          </ol>
          <p className={styles.flowNote}>
            Progression is organized around explanation, comprehension, practice, and evidence—not
            merely elapsed time.
          </p>
        </section>

        <section className={styles.section} id="why-ai">
          <div className={styles.sectionHeading}>
            <p className={styles.sectionKicker}>03 · Why AI</p>
            <h2>Capabilities worth testing, not outcomes to assume</h2>
            <p>
              AI may be well suited to parts of facilitation that benefit from responsiveness and
              repetition. Those capabilities motivate the product; they do not prove that AI
              teaches better than a person or that one session creates durable mastery.
            </p>
          </div>
          <div className={styles.cardGrid}>
            {aiReasons.map((reason) => (
              <article className={styles.compactCard} key={reason.title}>
                <h3>{reason.title}</h3>
                <p>{reason.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} id="educator-control">
          <div className={styles.sectionHeading}>
            <p className={styles.sectionKicker}>04 · What the educator controls</p>
            <h2>Educational authorship stays with the educator</h2>
            <p>
              Educators decide what should be taught, what material is acceptable, who receives a
              lesson, and what to do with the evidence afterward. AI can carry more of the
              instructional workload without becoming the educational authority.
            </p>
          </div>
          <ul className={styles.controlList}>
            {educatorControls.map((control) => (
              <li key={control}>{control}</li>
            ))}
          </ul>
          <div className={styles.authNote}>
            <strong>Access is layered.</strong> Account authentication and owner-scoped data checks
            protect supported facilitator records and actions. Some facilitator navigation can add
            a user-configured PIN as an in-app boundary; that PIN is not presented here as a
            substitute for account authorization.
          </div>
        </section>

        <section className={styles.section} id="records">
          <div className={styles.sectionHeading}>
            <p className={styles.sectionKicker}>05 · How the product handles records</p>
            <h2>Preserve what happened, then interpret it carefully</h2>
          </div>
          <div className={styles.recordGrid}>
            {records.map((record) => (
              <article className={styles.recordCard} key={record.title}>
                <h3>{record.title}</h3>
                <p>{record.text}</p>
              </article>
            ))}
          </div>
          <p className={styles.evidenceNote}>
            Transcripts, responses, scores, timing, and facilitator notes can show what happened
            during a session. They do not by themselves prove long-term retention, durable mastery,
            or superiority to human teaching.
          </p>
        </section>

        <section className={styles.section} id="ai-features">
          <div className={styles.sectionHeading}>
            <p className={styles.sectionKicker}>06 · Safety, boundaries, and privacy</p>
            <h2>Practical safeguards, described without guarantees</h2>
            <p>
              Ms. Sonoma uses application and prompt-level boundaries intended to keep learner
              interactions tied to an age-appropriate learning experience. We continue to test and
              improve those safeguards.
            </p>
          </div>

          <div className={styles.boundaryGrid}>
            <article className={styles.boundaryCard}>
              <h3>Current safeguards</h3>
              <ul>
                <li>Checks on learner input supplied to the main Sonoma instructional route.</li>
                <li>Prompt guidance intended to keep responses age-appropriate and lesson-focused.</li>
                <li>Lightweight checks on generated text before a response is returned.</li>
                <li>Authenticated, owner-scoped routes for supported account records and lesson actions.</li>
              </ul>
              <p>
                Safeguards vary by feature and route. They reduce risk; they do not make AI output
                infallible or remove the need for adult judgment and supervision.
              </p>
            </article>

            <article className={styles.boundaryCard}>
              <h3>Optional learner features</h3>
              <p>
                The instructional experience itself includes active AI-guided turns. Depending on
                lesson and learner settings, optional features such as Ask, Poem, Story, and
                Fill-in-Fun may also be available. Educators can configure access to those optional
                features for a learner.
              </p>
            </article>

            <article className={styles.boundaryCard}>
              <h3>Providers and model memory</h3>
              <p>
                The main Sonoma route can use Anthropic or OpenAI, depending on deployment
                configuration. It sends the content supplied for the current turn rather than
                maintaining a hidden, durable model conversation in that route.
              </p>
              <p>
                When AI is used, the request data needed to generate a response is sent to the
                configured provider. Provider and deployment terms govern that processing; this
                page does not make a categorical model-training promise.
              </p>
            </article>

            <article className={styles.boundaryCard}>
              <h3>Application records are different</h3>
              <p>
                A stateless model request does not mean the learning application retains nothing.
                Ms. Sonoma may keep local snapshots and, for authenticated accounts where services
                are configured, persist progress, phase data, transcripts, and related records for
                resume and educator readback.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.closing}>
          <p className={styles.sectionKicker}>The standard we are choosing</p>
          <h2>Evidence should outrank the story we hope is true.</h2>
          <p>
            Ms. Sonoma is an experiment in giving AI more responsibility for the work of teaching
            while increasing, not diminishing, educator authority. Calm supports that work by
            making correction, repetition, and another attempt easier. Calm is the method; learning
            is the mission.
          </p>
          <div className={styles.actions}>
            <Link href="/learn" className={styles.primaryAction}>Explore learning</Link>
            <Link href="/facilitator" className={styles.secondaryAction}>Open facilitator tools</Link>
          </div>
        </section>
      </article>

      <aside className={styles.domainNote}>
        <p>
          <strong>About this site:</strong> mssonoma.app is the learning application. Visit{' '}
          <a href="https://mssonoma.com" target="_blank" rel="noopener noreferrer">
            mssonoma.com
          </a>{' '}
          for the broader educational thesis and project updates.
        </p>
      </aside>
    </main>
  );
}
