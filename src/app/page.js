'use client';
import styles from './home-hero.module.css';
import Image from 'next/image';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          // Not signed in — go straight to demo lessons
          try {
            localStorage.setItem('learner_id', 'demo');
            localStorage.setItem('learner_name', 'Demo Learner');
            localStorage.setItem('learner_grade', '4');
          } catch {}
          router.replace('/learn/lessons');
        }
      } catch {}
    })();
  }, [router]);

  return (
    <main style={{
      display: 'grid',
      alignItems: 'start',
      justifyItems: 'center',
      maxWidth: 1200,
      margin: '0 auto',
      padding: 0,
      paddingBottom: 'clamp(56px, 12vh, 160px)', // add generous bottom whitespace
      overflowX: 'hidden'
    }}>
      <div className={styles.homeHero}>
        <div className={styles.heroVisual}>
          {/* Larger, responsive hero image using Next/Image for better LCP */}
          <Image
            className={styles.heroImg}
            src="/ms-sonoma.png"
            alt="Ms. Sonoma"
            priority
            width={340}
            height={340}
            sizes="(min-width: 900px) 340px, 28vw"
            style={{ height: 'auto' }}
          />
        </div>
        <div className={styles.heroCopy}>
          <h1 className={styles.heroTitle}>Ms. Sonoma</h1>
          <p className={styles.heroSub}>Guided learning with a caring Facilitator.</p>
          <div className={styles.ctaRow}>
            <a href="/learn" className={`${styles.cta} ${styles.ctaSecondary}`}>Learn</a>
            <a href="/facilitator" className={`${styles.cta} ${styles.ctaPrimary}`}>Facilitator</a>
          </div>
          <div className={styles.aboutRow}>
            <a href="/about" className={styles.aboutLink}>
              How AI Works & Safety Protections →
            </a>
          </div>
          <div className={styles.externalRow}>
            <a
              href="https://mssonoma.com"
              className={styles.aboutLink}
              target="_blank"
              rel="noreferrer"
            >
              Learn about Ms. Sonoma at mssonoma.com →
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
