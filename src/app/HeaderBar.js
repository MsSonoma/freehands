"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';

export default function HeaderBar() {
	const pathname = usePathname() || '/';
	const router = useRouter();
	const NAV_WIDTH = 240;

	// Facilitator name for header label (falls back to literal 'Facilitator')
	const [facilitatorName, setFacilitatorName] = useState('');

	useEffect(() => {
		let cancelled = false;
		let authSub = null;
		(async () => {
			try {
				const supabase = getSupabaseClient();
				if (!supabase || !hasSupabaseEnv()) return;
				const { data: { session } } = await supabase.auth.getSession();
				const user = session?.user;
				if (user) {
					// Use auth metadata only to avoid profile schema 400s
					const meta = user?.user_metadata || {};
					const profName = (meta.display_name || meta.full_name || meta.name || '').trim();
					if (!cancelled && profName) setFacilitatorName(profName);
				}
				// Subscribe to auth changes to keep header in sync
				const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
					const u = s?.user;
					if (!u) { if (!cancelled) setFacilitatorName(''); return; }
					// Try quick metadata label first
					const meta = u.user_metadata || {};
					const metaName = (meta.display_name || meta.full_name || meta.name || '').trim();
					if (metaName && !cancelled) setFacilitatorName(metaName);
				});
				authSub = sub?.subscription;
			} catch {}
		})();
		return () => {
			cancelled = true;
			try { authSub?.unsubscribe?.(); } catch {}
		};
	}, []);

	// Compute back destination based on defined navigation chains.
	const backHref = useMemo(() => {
		if (pathname === '/') return null; // Home has no back button

		// Learner chain: / -> /learn -> /learn/lessons -> /session
		if (pathname.startsWith('/session')) return '/learn/lessons';
		if (pathname.startsWith('/learn/lessons')) return '/learn';
		if (pathname.startsWith('/learn')) return '/';

		// Billing (embedded checkout): return to plan selection
		if (pathname.startsWith('/billing/element/checkout')) return '/facilitator/plan';

		// Billing manage page (client-managed billing portal): return to facilitator overview
		if (pathname.startsWith('/billing/manage')) return '/facilitator';

		// Facilitator chain: / -> /facilitator -> /facilitator/(learners|plan|settings|tools)
		if (
			pathname.startsWith('/facilitator/learners') ||
			pathname.startsWith('/facilitator/plan') ||
			pathname.startsWith('/facilitator/settings') ||
			pathname.startsWith('/facilitator/tools') ||
			pathname.startsWith('/facilitator/account')
		) {
			return '/facilitator';
		}
		if (pathname === '/facilitator') return '/';
		if (pathname.startsWith('/facilitator/login')) return '/';

		return null; // No explicit mapping => hide back
	}, [pathname]);

	const handleBack = useCallback(() => {
		if (backHref) router.push(backHref);
		else router.back();
	}, [backHref, router]);

		// Branded back button style (match Session button color)
		const BRAND_ACCENT = '#c7442e';
		const BRAND_ACCENT_HOVER = '#b23b2a';
		const fancyButtonStyle = {
			background: BRAND_ACCENT,
			border: `1px solid ${BRAND_ACCENT}`,
			color: '#fff',
			fontSize: 14,
			fontWeight: 600,
			letterSpacing: '.25px',
			padding: '8px 18px',
			borderRadius: 999,
			cursor: 'pointer',
			display: 'inline-flex',
			alignItems: 'center',
			gap: 8,
			boxShadow: '0 2px 4px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
			transition: 'background .2s, transform .15s, box-shadow .2s, border-color .2s',
			position: 'relative'
		};

		return (
			<header style={{
				position:'sticky', top:0, zIndex:50,
				display:'flex', alignItems:'center',
				height:64, padding:'0 20px',
				background:'rgba(255,255,255,0.85)',
				backdropFilter:'blur(6px)',
				WebkitBackdropFilter:'blur(6px)',
				borderBottom:'1px solid #e5e7eb',
				boxShadow:'0 4px 12px -2px rgba(0,0,0,0.06)'
			}}>
				{/* Left area mirrors right nav width to keep center truly centered */}
				<div style={{ width: NAV_WIDTH, display:'flex', alignItems:'center' }}>
					<Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:10, textDecoration:'none', color:'inherit' }}>
						<Image src="/ms-sonoma.png" alt="Ms. Sonoma logo" width={40} height={40} priority style={{ borderRadius:10 }} />
						<span style={{ fontWeight:700, fontSize:19, whiteSpace:'nowrap' }}>Ms. Sonoma</span>
					</Link>
				</div>

				{/* Center back button */}
				<div style={{ flex:1, display:'flex', justifyContent:'center' }}>
					{backHref && (
						<button
							onClick={handleBack}
							aria-label="Go back"
							style={fancyButtonStyle}
							onMouseEnter={(e)=>{ e.currentTarget.style.background=BRAND_ACCENT_HOVER; e.currentTarget.style.borderColor=BRAND_ACCENT_HOVER; e.currentTarget.style.boxShadow='0 4px 10px rgba(0,0,0,0.25)'; }}
							onMouseLeave={(e)=>{ e.currentTarget.style.background=BRAND_ACCENT; e.currentTarget.style.borderColor=BRAND_ACCENT; e.currentTarget.style.boxShadow='0 2px 4px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)'; }}
							onMouseDown={(e)=>{ e.currentTarget.style.transform='translateY(1px)'; }}
							onMouseUp={(e)=>{ e.currentTarget.style.transform='translateY(0)'; }}
						>
							<span style={{ fontSize:18, lineHeight:1, transform:'translateY(-1px)' }}>←</span>
							<span style={{ position:'relative', top:1 }}>Back</span>
						</button>
					)}
				</div>

				{/* Right navigation */}
				<nav style={{ width: NAV_WIDTH, display:'flex', gap:16, justifyContent:'flex-end', alignItems:'center' }}>
					<Link href="/learn" style={{ textDecoration:'none', color:'#111', fontWeight:500 }}>Learn</Link>
					<Link href="/facilitator" style={{ textDecoration:'none', color:'#111', fontWeight:500 }}>
						{facilitatorName || 'Facilitator'}
					</Link>
				</nav>
			</header>
		);
}
