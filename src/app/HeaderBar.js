"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';

export default function HeaderBar() {
	const pathname = usePathname() || '/';
	const router = useRouter();
	// Responsive widths so center area keeps space for the back button on small screens
	const NAV_WIDTH = 'clamp(120px, 28vw, 240px)';
	// Let the left padding breathe based on viewport so branding does not get pushed too far right
	const PAD_LEFT = 'clamp(4px, 1vw, 6px)';
	const PAD_RIGHT = 'clamp(8px, 3vw, 20px)';
	// Responsive brand text sizing so it scales down on small screens
	const BRAND_FONT = 'clamp(18px, 3vw, 22px)';
	const BRAND_MIN = 14; // px, emergency shrink if space is tight
	const BRAND_MAX = 22; // px, visual cap
	const BRAND_GAP = 'clamp(6px, 2vw, 10px)';

	// Refs to fit the brand text within the left nav width without clipping or overlap
	const brandContainerRef = useRef(null);
	const brandLinkRef = useRef(null);
	const brandImgRef = useRef(null);
	const brandTextRef = useRef(null);
	const [brandFitSize, setBrandFitSize] = useState(null);
	const [printMenuOpen, setPrintMenuOpen] = useState(false);
	const printMenuRef = useRef(null);

	const [sessionTitle, setSessionTitle] = useState('');
	const [isMobileLandscape, setIsMobileLandscape] = useState(false);
	// Header sizing: default 64px, compact 52px for session mobile landscape
	const DEFAULT_HEADER_HEIGHT = 64;
	const COMPACT_HEADER_HEIGHT = 52;
	const headerHeight = (pathname.startsWith('/session') && isMobileLandscape) ? COMPACT_HEADER_HEIGHT : DEFAULT_HEADER_HEIGHT;

	useEffect(() => {
		function fitBrand() {
			const container = brandContainerRef.current;
			const link = brandLinkRef.current;
			const img = brandImgRef.current;
			const text = brandTextRef.current;
			if (!container || !link || !text) return;

			// Available width = container width - current logo width - current gap
			const cs = typeof window !== 'undefined' ? window.getComputedStyle(link) : null;
			const gapPx = cs ? parseFloat(cs.gap || cs.columnGap || '0') : 0;
			const imgW = img ? img.getBoundingClientRect().width : 40;
			const available = container.clientWidth - imgW - gapPx - 2; // small safety pad
			if (available <= 0) return;

			// Measure natural width at BRAND_MAX, then scale if needed
			const prev = text.style.fontSize;
			text.style.fontSize = BRAND_MAX + 'px';
			// Force a reflow before reading scrollWidth without eslint noise
			void text.offsetHeight;
			const natural = text.scrollWidth;
			let size = BRAND_MAX;
			if (natural > available) {
				const ratio = available / natural;
				size = Math.max(BRAND_MIN, Math.floor(BRAND_MAX * ratio));
			}
			text.style.fontSize = prev;
			setBrandFitSize(size);
		}

		fitBrand();
		if (typeof ResizeObserver !== 'undefined') {
			const ro = new ResizeObserver(() => fitBrand());
			if (brandContainerRef.current) ro.observe(brandContainerRef.current);
			if (brandImgRef.current) ro.observe(brandImgRef.current);
			return () => { try { ro.disconnect(); } catch {} };
		} else {
			const onResize = () => fitBrand();
			window.addEventListener('resize', onResize);
			return () => window.removeEventListener('resize', onResize);
		}
	}, []);

	// Track mobile landscape so we only show the in-header session title in that mode
	useEffect(() => {
		const check = () => {
			try {
				const w = window.innerWidth;
				const h = window.innerHeight;
				const isLandscape = w > h;
				const isMobile = Math.min(w, h) <= 820;
				setIsMobileLandscape(isMobile && isLandscape);
			} catch {}
		};
		check();
		window.addEventListener('resize', check);
		window.addEventListener('orientationchange', check);
		return () => {
			window.removeEventListener('resize', check);
			window.removeEventListener('orientationchange', check);
		};
	}, []);

	// Receive the session page title from the session page
	useEffect(() => {
		if (!pathname.startsWith('/session')) { setSessionTitle(''); return; }
		const onTitle = (e) => {
			try { setSessionTitle((e && e.detail) || ''); } catch { setSessionTitle(''); }
		};
		window.addEventListener('ms:session:title', onTitle);
		return () => window.removeEventListener('ms:session:title', onTitle);
	}, [pathname]);

	// Close the print menu on outside click or Escape
	useEffect(() => {
		if (!printMenuOpen) return;
		const onDocDown = (e) => {
			try {
				if (!printMenuRef.current) return;
				if (!printMenuRef.current.contains(e.target)) setPrintMenuOpen(false);
			} catch {}
		};
		const onKey = (e) => { if (e.key === 'Escape') setPrintMenuOpen(false); };
		document.addEventListener('mousedown', onDocDown);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDocDown);
			document.removeEventListener('keydown', onKey);
		};
	}, [printMenuOpen]);

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

	// Lock body scroll on the Session page so nothing scrolls under the header
	useEffect(() => {
		const lock = pathname.startsWith('/session');
		const html = typeof document !== 'undefined' ? document.documentElement : null;
		const body = typeof document !== 'undefined' ? document.body : null;
		if (!html || !body) return;
		const prev = {
			htmlOverflow: html.style.overflow,
			htmlHeight: html.style.height,
			bodyOverflow: body.style.overflow,
			bodyHeight: body.style.height,
		};
		if (lock) {
			html.style.overflow = 'hidden';
			html.style.height = '100svh';
			body.style.overflow = 'hidden';
			body.style.height = '100svh';
		} else {
			// Ensure defaults when not on session
			html.style.overflow = prev.htmlOverflow || '';
			html.style.height = prev.htmlHeight || '';
			body.style.overflow = prev.bodyOverflow || '';
			body.style.height = prev.bodyHeight || '';
		}
		return () => {
			// On unmount or route change, restore
			html.style.overflow = prev.htmlOverflow || '';
			html.style.height = prev.htmlHeight || '';
			body.style.overflow = prev.bodyOverflow || '';
			body.style.height = prev.bodyHeight || '';
		};
	}, [pathname]);

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
			<>
			<header style={{
				position:'fixed', top:0, left:0, right:0, zIndex:1000,
				display:'flex', alignItems:'center',
				height: headerHeight,
				paddingLeft: PAD_LEFT,
				paddingRight: PAD_RIGHT,
				background:'rgba(255,255,255,0.85)',
				backdropFilter:'blur(6px)',
				WebkitBackdropFilter:'blur(6px)',
				borderBottom:'1px solid #e5e7eb',
				boxShadow:'0 4px 12px -2px rgba(0,0,0,0.06)'
			}}>
				{/* Left area mirrors right nav width to keep center truly centered */}
				<div ref={brandContainerRef} style={{ width: NAV_WIDTH, display:'flex', alignItems:'center' }}>
					<Link ref={brandLinkRef} href="/" style={{ display:'inline-flex', alignItems:'center', gap:BRAND_GAP, textDecoration:'none', color:'inherit' }}>
						<Image
							ref={brandImgRef}
							src="/ms-sonoma.png"
							alt="Ms. Sonoma logo"
							width={40}
							height={40}
							priority
							style={{
								borderRadius:10,
								flexShrink:0,
								width:'clamp(28px, 5vw, 40px)',
								height:'clamp(28px, 5vw, 40px)'
							}}
						/>
						<span
							ref={brandTextRef}
							style={{
								fontWeight:700,
								fontSize: brandFitSize ? brandFitSize : BRAND_FONT,
								lineHeight:1.1,
								whiteSpace:'nowrap'
							}}
						>
							Ms. Sonoma
						</span>
					</Link>
				</div>

				{/* Center area: show lesson title on Session in mobile landscape; else show Back */}
				<div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', minWidth:0 }}>
					{(pathname.startsWith('/session') && isMobileLandscape && sessionTitle) ? (
						<div style={{ display:'flex', alignItems:'center', gap:8, maxWidth:'min(70vw, 700px)', overflow:'hidden' }}>
							<button
								onClick={handleBack}
								aria-label="Go back"
								style={{ background:'transparent', color:'#111', border:'1px solid #e5e7eb', padding:'6px 10px', borderRadius:999, cursor:'pointer' }}
							>
								<span style={{ fontSize:16, lineHeight:1 }}>←</span>
							</button>
							<div title={sessionTitle} style={{ fontWeight:800, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden' }}>
								{sessionTitle}
							</div>
						</div>
					) : backHref && (
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
				<nav style={{ width: NAV_WIDTH, display:'flex', gap:16, justifyContent:'flex-end', alignItems:'center', position:'relative' }}>
					{/* Session-only print dropdown to the left of Learn */}
					{pathname.startsWith('/session') && (
						<div ref={printMenuRef} style={{ position:'relative', display:'flex', alignItems:'center', gap:8 }}>
							<button
								aria-label="Print menu"
								onClick={() => setPrintMenuOpen((v) => !v)}
								style={{
									background:'#1f2937', color:'#fff', border:'none', width:36, height:36,
									display:'inline-flex', alignItems:'center', justifyContent:'center', borderRadius:8, cursor:'pointer',
									boxShadow:'0 2px 6px rgba(0,0,0,0.25)'
								}}
							>
								{/* Printer icon */}
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M6 9V2h12v7"/>
									<path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
									<path d="M6 14h12v8H6z"/>
									<path d="M18 7H6"/>
								</svg>
							</button>
							{printMenuOpen && (
								<div style={{ position:'absolute', right:0, top:44, background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', minWidth:160, overflow:'hidden', zIndex:1200 }}>
									<button
										type="button"
										style={{ display:'flex', width:'100%', alignItems:'center', gap:8, padding:'10px 12px', background:'transparent', border:'none', cursor:'pointer', fontWeight:600, color:'#111' }}
										onClick={() => { try { window.dispatchEvent(new Event('ms:print:worksheet')); } catch {}; setPrintMenuOpen(false); }}
									>
										worksheet
									</button>
									<button
										type="button"
										style={{ display:'flex', width:'100%', alignItems:'center', gap:8, padding:'10px 12px', background:'transparent', border:'none', cursor:'pointer', fontWeight:600, color:'#111', borderTop:'1px solid #f3f4f6' }}
										onClick={() => { try { window.dispatchEvent(new Event('ms:print:test')); } catch {}; setPrintMenuOpen(false); }}
									>
										test
									</button>
									<button
										type="button"
										style={{ display:'flex', width:'100%', alignItems:'center', gap:8, padding:'10px 12px', background:'transparent', border:'none', cursor:'pointer', fontWeight:700, color:'#c7442e', borderTop:'1px solid #f3f4f6' }}
										onClick={() => { try { window.dispatchEvent(new Event('ms:print:refresh')); } catch {}; setPrintMenuOpen(false); }}
									>
										refresh
									</button>
								</div>
							)}
						</div>
					)}
					<Link href="/learn" style={{ textDecoration:'none', color:'#111', fontWeight:500 }}>Learn</Link>
					<Link href="/facilitator" style={{ textDecoration:'none', color:'#111', fontWeight:500 }}>
						{facilitatorName || 'Facilitator'}
					</Link>
				</nav>
			</header>
			{/* Spacer to offset fixed header height so content below is never covered */}
			<div aria-hidden="true" style={{ height: headerHeight }} />
			</>
		);
}
