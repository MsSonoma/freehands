"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';
import { ensurePinAllowed, setInFacilitatorSection } from '@/app/lib/pinGate';

export default function HeaderBar() {
	const pathname = usePathname() || '/';
	const router = useRouter();
	// Reserved left/right widths; keep smaller on session so center gets more space
	const navWidth = useMemo(() => {
		// On the session page, especially in portrait, reclaim width for the title
		if (pathname.startsWith('/session')) {
			return 'clamp(64px, 12vw, 120px)';
		}
		return 'clamp(84px, 14vw, 160px)';
	}, [pathname]);
	// Let the left padding breathe based on viewport so branding does not get pushed too far right
	const PAD_LEFT = 'clamp(4px, 1vw, 6px)';
	const PAD_RIGHT = 'clamp(8px, 3vw, 20px)';
	// Responsive brand text sizing in rem/vw (no px)
	const BRAND_FONT = 'clamp(1.125rem, 3vw, 1.375rem)';
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
	const [facilitatorMenuOpen, setFacilitatorMenuOpen] = useState(false);
	const facilitatorMenuCloseTimerRef = useRef(null);
	// Mobile menu (hamburger) state and refs
	const [navOpen, setNavOpen] = useState(false);
	const [isNarrow, setIsNarrow] = useState(false);
	const navMenuRef = useRef(null);
	const navToggleRef = useRef(null);

	const [sessionTitle, setSessionTitle] = useState('');
	const [isMobileLandscape, setIsMobileLandscape] = useState(false);
	const [isSmallWidth, setIsSmallWidth] = useState(false); // <= 600px viewport width/height min
	const [viewportWidth, setViewportWidth] = useState(1024); // track width explicitly for brand visibility
	// Collapse header navigation into hamburger menu on mobile portrait (all pages)
	const showHamburger = useMemo(() => isSmallWidth, [isSmallWidth]);
	// Header sizing: responsive heights using clamp so it scales by screen size
	const DEFAULT_HEADER_HEIGHT = 'clamp(56px, 9svh, 72px)';
	const COMPACT_HEADER_HEIGHT = 'clamp(48px, 8svh, 60px)';
	const TALL_HEADER_HEIGHT = 'clamp(72px, 12svh, 104px)'; // for stacked brand/title on very small screens
	const headerHeight = useMemo(() => {
		if (pathname.startsWith('/session')) {
			if (isMobileLandscape) return COMPACT_HEADER_HEIGHT;
			if (isSmallWidth && sessionTitle) return TALL_HEADER_HEIGHT;
		}
		return DEFAULT_HEADER_HEIGHT;
	}, [pathname, isMobileLandscape, isSmallWidth, sessionTitle]);

	// Use video-aligned gutters on Session in portrait
	const headerPadLeft = useMemo(() => (
		pathname.startsWith('/session') && !isMobileLandscape ? '4%' : PAD_LEFT
	), [pathname, isMobileLandscape]);
	const headerPadRight = useMemo(() => (
		pathname.startsWith('/session') && !isMobileLandscape ? '4%' : PAD_RIGHT
	), [pathname, isMobileLandscape]);

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
				// Also track narrow width for hamburger visibility (≤600)
				setIsNarrow(Math.min(w, h) <= 600);
				setIsSmallWidth(Math.min(w, h) <= 600);
				setViewportWidth(w);
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

	// Close print menu when switching to narrow layout to avoid hidden overlays
	useEffect(() => {
		if (isNarrow && printMenuOpen) setPrintMenuOpen(false);
	}, [isNarrow, printMenuOpen]);

	// Receive the session page title from the session page, counselor page, or calendar page
	useEffect(() => {
		if (!pathname.startsWith('/session') && !pathname.startsWith('/facilitator/mr-mentor') && !pathname.startsWith('/facilitator/calendar')) { setSessionTitle(''); return; }
		const onTitle = (e) => {
			try { setSessionTitle((e && e.detail) || ''); } catch { setSessionTitle(''); }
		};
		window.addEventListener('ms:session:title', onTitle);
		return () => window.removeEventListener('ms:session:title', onTitle);
	}, [pathname]);

	// Close the print menu on outside click or Escape
	useEffect(() => {
		if (!printMenuOpen) return;
		// Add a small delay before attaching listeners to prevent immediate close on touch
		const timeoutId = setTimeout(() => {
			const onDocDown = (e) => {
				try {
					if (!printMenuRef.current) return;
					if (!printMenuRef.current.contains(e.target)) setPrintMenuOpen(false);
				} catch {}
			};
			const onKey = (e) => { if (e.key === 'Escape') setPrintMenuOpen(false); };
			// Use both mousedown and touchstart for mobile compatibility
			document.addEventListener('mousedown', onDocDown);
			document.addEventListener('touchstart', onDocDown);
			document.addEventListener('keydown', onKey);
			
			// Store cleanup in a way we can access it
			printMenuRef.current._cleanup = () => {
				document.removeEventListener('mousedown', onDocDown);
				document.removeEventListener('touchstart', onDocDown);
				document.removeEventListener('keydown', onKey);
			};
		}, 100);
		
		return () => {
			clearTimeout(timeoutId);
			if (printMenuRef.current?._cleanup) {
				printMenuRef.current._cleanup();
				printMenuRef.current._cleanup = null;
			}
		};
	}, [printMenuOpen]);

	// Close the nav menu on outside click or Escape
	useEffect(() => {
		if (!navOpen) return;
		const onDocDown = (e) => {
			try {
				const menuEl = navMenuRef.current;
				const toggleEl = navToggleRef.current;
				if (!menuEl || !toggleEl) return;
				if (!menuEl.contains(e.target) && !toggleEl.contains(e.target)) setNavOpen(false);
			} catch {}
		};
		const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false); };
		document.addEventListener('mousedown', onDocDown);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDocDown);
			document.removeEventListener('keydown', onKey);
		};
	}, [navOpen]);

	// Close the nav menu on route change
	useEffect(() => { setNavOpen(false); }, [pathname]);
	useEffect(() => {
		setFacilitatorMenuOpen(false);
		try {
			if (facilitatorMenuCloseTimerRef.current) {
				clearTimeout(facilitatorMenuCloseTimerRef.current);
				facilitatorMenuCloseTimerRef.current = null;
			}
		} catch {}
	}, [pathname]);

	const cancelFacilitatorMenuClose = useCallback(() => {
		try {
			if (facilitatorMenuCloseTimerRef.current) {
				clearTimeout(facilitatorMenuCloseTimerRef.current);
				facilitatorMenuCloseTimerRef.current = null;
			}
		} catch {}
	}, []);

	const openFacilitatorMenu = useCallback(() => {
		cancelFacilitatorMenuClose();
		setFacilitatorMenuOpen(true);
	}, [cancelFacilitatorMenuClose]);

	const closeFacilitatorMenuSoon = useCallback(() => {
		cancelFacilitatorMenuClose();
		try {
			facilitatorMenuCloseTimerRef.current = setTimeout(() => {
				setFacilitatorMenuOpen(false);
				facilitatorMenuCloseTimerRef.current = null;
			}, 220);
		} catch {
			setFacilitatorMenuOpen(false);
		}
	}, [cancelFacilitatorMenuClose]);

	useEffect(() => {
		return () => {
			try {
				if (facilitatorMenuCloseTimerRef.current) {
					clearTimeout(facilitatorMenuCloseTimerRef.current);
					facilitatorMenuCloseTimerRef.current = null;
				}
			} catch {}
		};
	}, []);

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
					// Prefer profiles.full_name; fallback to auth metadata
					let name = '';
					try {
						const { data: prof } = await supabase
							.from('profiles')
							.select('full_name')
							.eq('id', user.id)
							.maybeSingle();
						if (prof && typeof prof.full_name === 'string' && prof.full_name.trim()) {
							name = prof.full_name.trim();
						}
					} catch {}
					if (!name) {
						const meta = user?.user_metadata || {};
						name = (meta.full_name || meta.display_name || meta.name || '').trim();
					}
					if (!cancelled && name) setFacilitatorName(name);
				}
				// Subscribe to auth changes to keep header in sync
				const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
					const u = s?.user;
					if (!u) { if (!cancelled) setFacilitatorName(''); return; }
					(async () => {
						let name = '';
						try {
							const { data: prof } = await supabase
								.from('profiles')
								.select('full_name')
								.eq('id', u.id)
								.maybeSingle();
							if (prof && typeof prof.full_name === 'string' && prof.full_name.trim()) {
								name = prof.full_name.trim();
							}
						} catch {}
						if (!name) {
							const meta = u.user_metadata || {};
							name = (meta.full_name || meta.display_name || meta.name || '').trim();
						}
						if (!cancelled) setFacilitatorName(name);
					})();
				});
				authSub = sub?.subscription;
			} catch {}
		})();
		return () => {
			cancelled = true;
			try { authSub?.unsubscribe?.(); } catch {}
		};
	}, []);

	// React to cross-page profile name updates
	useEffect(() => {
		const onNameUpdate = (e) => {
			try {
				const detail = e?.detail || {};
				if (detail?.name) setFacilitatorName(String(detail.name));
			} catch {}
		};
		window.addEventListener('ms:profile:name:updated', onNameUpdate);
		return () => window.removeEventListener('ms:profile:name:updated', onNameUpdate);
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
		
		// About page returns to home
		if (pathname === '/about') return '/';

		// Learner chain: / -> /learn -> /learn/lessons -> /session
		// Awards viewer returns to learn page
		if (pathname.startsWith('/session')) return '/learn/lessons';
		if (pathname.startsWith('/learn/awards')) return '/learn';
		if (pathname.startsWith('/learn/lessons')) return '/learn';
		if (pathname.startsWith('/learn')) return '/';

		// Billing (embedded checkout): return to plan selection
		if (pathname.startsWith('/billing/element/checkout')) return '/facilitator/account/plan';

		// Billing manage page (client-managed billing portal): return to facilitator overview
		if (pathname.startsWith('/billing/manage')) return '/facilitator';

		// Facilitator Hotkeys page should return to Settings
		if (pathname.startsWith('/facilitator/hotkeys')) return '/facilitator/account/settings';

		// Mr. Mentor (counselor) should return to facilitator main page
		if (pathname.startsWith('/facilitator/mr-mentor')) return '/facilitator';

		// Facilitator Generator sub-pages should return to Generator page
		if (pathname.startsWith('/facilitator/generator/')) return '/facilitator/generator';

		// Facilitator Account sub-pages should return to Account page
		if (pathname.startsWith('/facilitator/account/') && pathname !== '/facilitator/account') return '/facilitator/account';

		// Facilitator chain: / -> /facilitator -> /facilitator/(learners|lessons|account|generator)
		if (
			pathname.startsWith('/facilitator/learners') ||
			pathname.startsWith('/facilitator/lessons') ||
			pathname.startsWith('/facilitator/generator') ||
			pathname.startsWith('/facilitator/account') ||
			pathname.startsWith('/facilitator/calendar')
		) {
			return '/facilitator';
		}
		if (pathname === '/facilitator') return '/';
		if (pathname.startsWith('/facilitator/login')) return '/';

		return null; // No explicit mapping => hide back
	}, [pathname]);

	const goWithPin = useCallback(async (pushHref) => {
		if (pathname.startsWith('/session')) {
			const allowed = await ensurePinAllowed('session-exit');
			if (!allowed) return false;
			// If navigating to a facilitator page after successful PIN validation,
			// set the facilitator section flag to prevent double PIN prompt
			if (pushHref && pushHref.startsWith('/facilitator')) {
				setInFacilitatorSection(true);
			}
		}
		if (pushHref) {
			router.push(pushHref);
		} else {
			router.back();
		}
		return true;
	}, [pathname, router]);

	const handleBack = useCallback(async () => {
		if (backHref) {
			await goWithPin(backHref);
		} else {
			await goWithPin(null);
		}
	}, [backHref, goWithPin]);

		// Branded back button style (match Session button color)
		const BRAND_ACCENT = '#c7442e';
		const BRAND_ACCENT_HOVER = '#b23b2a';
		const fancyButtonStyle = {
			background: BRAND_ACCENT,
			border: `1px solid ${BRAND_ACCENT}`,
			color: '#fff',
			fontSize: 'clamp(0.95rem, 1.4vw, 1.125rem)',
			fontWeight: 600,
			letterSpacing: '.25px',
			padding: 'clamp(6px, 0.9vw, 8px) clamp(12px, 1.8vw, 18px)',
			borderRadius: 999,
			cursor: 'pointer',
			display: 'inline-flex',
			alignItems: 'center',
			gap: 'clamp(6px, 1vw, 8px)',
			boxShadow: '0 2px 4px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
			transition: 'background .2s, transform .15s, box-shadow .2s, border-color .2s',
			position: 'relative'
		};

		// Standardized sizing for all hamburger dropdown items (buttons and links)
		const MOBILE_MENU_ITEM_STYLE = {
			display: 'flex',
			alignItems: 'center',
			width: '100%',
			textAlign: 'left',
			height: 44,
			padding: '0 16px',
			fontSize: '14px',
			lineHeight: '20px',
			textDecoration: 'none',
			background: 'transparent',
			border: 'none',
			cursor: 'pointer',
			fontWeight: 600,
			color: '#111'
		};

		return (
			<>
			<header style={{
				position:'fixed', top:0, left:0, right:0, zIndex:1000,
				display:'flex', alignItems:'center',
				height: headerHeight,
				paddingLeft: headerPadLeft,
				paddingRight: headerPadRight,
				background:'rgba(255,255,255,0.85)',
				backdropFilter:'blur(6px)',
				WebkitBackdropFilter:'blur(6px)',
				borderBottom:'1px solid #e5e7eb',
				boxShadow:'0 4px 12px -2px rgba(0,0,0,0.06)'
			}}>
				{/* Left area mirrors right nav width to keep center truly centered */}
				<div ref={brandContainerRef} style={{ width: navWidth, display:'flex', alignItems:'center' }}>
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
								whiteSpace:'nowrap',
								// Only hide the brand text when on the Session page at small widths.
								display: (pathname.startsWith('/session') && viewportWidth < 500) ? 'none' : 'inline'
							}}
						>
							Ms. Sonoma
						</span>
					</Link>
				</div>

				{/* Center area: show lesson title on Session/Counselor/Calendar; else show Back */}
				<div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center', minWidth:0 }}>
					{((pathname.startsWith('/session') || pathname.startsWith('/facilitator/mr-mentor') || pathname.startsWith('/facilitator/calendar')) && sessionTitle) ? (
						isSmallWidth ? (
							<div style={{ position:'relative', width:'100%', maxWidth:'min(98vw, 1300px)', height:'100%' }}>
								<div style={{ position:'absolute', left:0, right:0, top:'50%', transform:'translateY(-50%)', display:'flex', justifyContent:'center', alignItems:'center', padding:'0 4px' }}>
									<div style={{ display:'inline-flex', alignItems:'center', gap:6, maxWidth:'100%' }}>
										<button
											onClick={handleBack}
											aria-label="Go back"
											style={{ background:'transparent', color:'#111', border:'1px solid #e5e7eb', padding:'6px 10px', borderRadius:999, cursor:'pointer' }}
										>
											<span style={{ fontSize:'clamp(0.95rem, 4vw, 1.1rem)', lineHeight:1 }}>←</span>
										</button>
										<div title={sessionTitle} style={{ fontWeight:800, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden', textAlign:'left' }}>
											{sessionTitle}
										</div>
									</div>
								</div>
							</div>
						) : (
								<div style={{ position:'relative', width:'100%', maxWidth:'min(96vw, 1600px)', height:'100%' }}>
									<div style={{ position:'absolute', left:0, right:0, top:'50%', transform:'translateY(-50%)', display:'flex', justifyContent:'center', alignItems:'center' }}>
										<div style={{ display:'inline-flex', alignItems:'center', gap:6, maxWidth:'100%' }}>
											<button
												onClick={handleBack}
												aria-label="Go back"
												style={{ background:'transparent', color:'#111', border:'1px solid #e5e7eb', padding:'6px 10px', borderRadius:999, cursor:'pointer' }}
											>
												<span style={{ fontSize:'clamp(0.95rem, 1.4vw, 1.05rem)', lineHeight:1 }}>←</span>
											</button>
											<div title={sessionTitle} style={{ fontWeight:800, whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden' }}>
												{sessionTitle}
											</div>
										</div>
									</div>
								</div>
						)
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
							<span style={{ fontSize:'clamp(1rem, 1.8vw, 1.125rem)', lineHeight:1, transform:'translateY(-1px)' }}>←</span>
							<span style={{ position:'relative', top:1 }}>Back</span>
						</button>
					)}
				</div>

				{/* Right navigation */}
				<nav style={{ width: navWidth, display:'flex', gap:16, justifyContent:'flex-end', alignItems:'center', position:'relative' }}>
					{showHamburger ? (
						<>
							<button
								ref={navToggleRef}
								aria-label={navOpen ? 'Close menu' : 'Open menu'}
								aria-expanded={navOpen}
								aria-controls="mobile-nav-menu"
								onClick={() => setNavOpen(v => !v)}
								style={{
									background:'#111827', color:'#fff', border:'none', width:36, height:36,
									display:'inline-flex', alignItems:'center', justifyContent:'center', borderRadius:10, cursor:'pointer',
									boxShadow:'0 2px 6px rgba(0,0,0,0.25)'
								}}
							>
								{/* Hamburger / Close icon */}
								{!navOpen ? (
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M3 6h18"/>
										<path d="M3 12h18"/>
										<path d="M3 18h18"/>
									</svg>
								) : (
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M18 6L6 18"/>
										<path d="M6 6l12 12"/>
									</svg>
								)}
							</button>
							{navOpen && (
								<div
									id="mobile-nav-menu"
									ref={navMenuRef}
									role="menu"
									style={{ position:'fixed', right: (pathname.startsWith('/session') && !isMobileLandscape) ? '4%' : 8, top: `calc(${headerHeight} + 8px)`, background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, boxShadow:'0 10px 30px rgba(0,0,0,0.15)', minWidth:200, zIndex:1300, overflow:'hidden' }}
								>
									{/* Always available links first so they appear at the top of the hamburger */}
									<div style={{ display:'flex', flexDirection:'column', borderBottom: pathname.startsWith('/session') ? '1px solid #f3f4f6' : 'none' }}>
										<Link
											href="/about"
											role="menuitem"
											onClick={async (e) => {
												if (pathname.startsWith('/session')) {
													e.preventDefault();
													const ok = await goWithPin('/about');
													if (ok) setNavOpen(false);
												} else {
													setNavOpen(false);
												}
											}}
											style={MOBILE_MENU_ITEM_STYLE}
										>
											About
										</Link>
										<Link
											href="/learn"
											role="menuitem"
											onClick={async (e) => {
												if (pathname.startsWith('/session')) {
													e.preventDefault();
													const ok = await goWithPin('/learn');
													if (ok) setNavOpen(false);
												} else {
													setNavOpen(false);
												}
											}}
											style={{ ...MOBILE_MENU_ITEM_STYLE, borderTop:'1px solid #f3f4f6' }}
										>
											Learn
										</Link>
										<Link
											href="/facilitator"
											role="menuitem"
											onClick={async (e) => {
												if (pathname.startsWith('/session')) {
													e.preventDefault();
													const ok = await goWithPin('/facilitator');
													if (ok) setNavOpen(false);
												} else {
													setNavOpen(false);
												}
											}}
											style={{ ...MOBILE_MENU_ITEM_STYLE, borderTop:'1px solid #f3f4f6', whiteSpace:'nowrap' }}
								>
									{facilitatorName || 'Facilitator'}
										</Link>
									</div>

									{/* Session print actions, if applicable (moved below the Learn/Facilitator links) */}
									{pathname.startsWith('/session') && (
										<div style={{ display:'flex', flexDirection:'column', borderTop: '1px solid #f3f4f6' }}>
											<button type="button" role="menuitem" style={MOBILE_MENU_ITEM_STYLE} onClick={() => { try { window.dispatchEvent(new Event('ms:print:worksheet')); } catch {}; setNavOpen(false); }}>Worksheet</button>
											<button type="button" role="menuitem" style={{ ...MOBILE_MENU_ITEM_STYLE, borderTop:'1px solid #f3f4f6' }} onClick={() => { try { window.dispatchEvent(new Event('ms:print:test')); } catch {}; setNavOpen(false); }}>Test</button>
											<button type="button" role="menuitem" style={{ ...MOBILE_MENU_ITEM_STYLE, borderTop:'1px solid #f3f4f6' }} onClick={() => { try { window.dispatchEvent(new Event('ms:print:combined')); } catch {}; setNavOpen(false); }}>Facilitator Key</button>
											<button type="button" role="menuitem" style={{ ...MOBILE_MENU_ITEM_STYLE, color:'#c7442e', borderTop:'1px solid #f3f4f6' }} onClick={() => { try { window.dispatchEvent(new Event('ms:print:refresh')); } catch {}; setNavOpen(false); }}>Refresh</button>
										</div>
									)}

									{/* Mr. Mentor actions, if applicable */}
									{pathname.startsWith('/facilitator/mr-mentor') && (
										<div style={{ display:'flex', flexDirection:'column', borderTop: '1px solid #f3f4f6' }}>
											<button type="button" role="menuitem" style={MOBILE_MENU_ITEM_STYLE} onClick={() => { try { window.dispatchEvent(new Event('ms:mentor:export')); } catch {}; setNavOpen(false); }}>Export Conversation</button>
											<button type="button" role="menuitem" style={{ ...MOBILE_MENU_ITEM_STYLE, color:'#c7442e', borderTop:'1px solid #f3f4f6' }} onClick={() => { try { window.dispatchEvent(new Event('ms:mentor:new-session')); } catch {}; setNavOpen(false); }}>New Session</button>
										</div>
									)}
								</div>
							)}
						</>
					) : (
						<>
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
												Worksheet
												</button>
												<button
												type="button"
												style={{ display:'flex', width:'100%', alignItems:'center', gap:8, padding:'10px 12px', background:'transparent', border:'none', cursor:'pointer', fontWeight:600, color:'#111', borderTop:'1px solid #f3f4f6' }}
												onClick={() => { try { window.dispatchEvent(new Event('ms:print:test')); } catch {}; setPrintMenuOpen(false); }}
											>
												Test
												</button>
												<button
												type="button"
												style={{ display:'flex', width:'100%', alignItems:'center', gap:8, padding:'10px 12px', background:'transparent', border:'none', cursor:'pointer', fontWeight:600, color:'#111', borderTop:'1px solid #f3f4f6' }}
												onClick={() => { try { window.dispatchEvent(new Event('ms:print:combined')); } catch {}; setPrintMenuOpen(false); }}
											>
												Facilitator Key
												</button>
												<button
												type="button"
												style={{ display:'flex', width:'100%', alignItems:'center', gap:8, padding:'10px 12px', background:'transparent', border:'none', cursor:'pointer', fontWeight:700, color:'#c7442e', borderTop:'1px solid #f3f4f6' }}
												onClick={() => { try { window.dispatchEvent(new Event('ms:print:refresh')); } catch {}; setPrintMenuOpen(false); }}
											>
												Refresh
												</button>
											</div>
										)}
								</div>
							)}
							<Link
								href="/about"
								onClick={(e) => {
									if (pathname.startsWith('/session')) {
										e.preventDefault();
										goWithPin('/about');
									}
								}}
								style={{ textDecoration:'none', color:'#111', fontWeight:500 }}
							>
								About
							</Link>
							<Link
								href="/learn"
								onClick={(e) => {
									if (pathname.startsWith('/session')) {
										e.preventDefault();
										goWithPin('/learn');
									}
								}}
								style={{ textDecoration:'none', color:'#111', fontWeight:500 }}
							>
								Learn
							</Link>
							<div
								style={{ position:'relative', display:'inline-flex', alignItems:'center' }}
								onMouseEnter={openFacilitatorMenu}
								onMouseLeave={closeFacilitatorMenuSoon}
							>
								<Link
									href="/facilitator"
									onMouseEnter={openFacilitatorMenu}
									onFocus={openFacilitatorMenu}
									onClick={async (e) => {
										if (pathname.startsWith('/session')) {
											e.preventDefault();
											const ok = await goWithPin('/facilitator');
											if (ok) setFacilitatorMenuOpen(false);
											return;
										}
										setFacilitatorMenuOpen(false);
									}}
									style={{ textDecoration:'none', color:'#111', fontWeight:500, whiteSpace:'nowrap' }}
								>
									{facilitatorName || 'Facilitator'}
								</Link>
								{facilitatorMenuOpen && (
									<div
										role="menu"
										onMouseEnter={cancelFacilitatorMenuClose}
										onMouseLeave={closeFacilitatorMenuSoon}
										style={{ position:'absolute', right:0, top:'100%', background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', minWidth:160, overflow:'hidden', zIndex:1400 }}
									>
										<Link
											href="/facilitator/account"
											role="menuitem"
											onClick={async (e) => {
												if (pathname.startsWith('/session')) {
													e.preventDefault();
													const ok = await goWithPin('/facilitator/account');
													if (ok) setFacilitatorMenuOpen(false);
													return;
												}
												setFacilitatorMenuOpen(false);
											}}
											style={{ display:'flex', width:'100%', alignItems:'center', gap:8, padding:'10px 12px', textDecoration:'none', fontWeight:600, color:'#111' }}
										>
											<span aria-hidden="true">⚙️</span>
											Account
										</Link>
										<Link
											href="/facilitator/learners"
											role="menuitem"
											onClick={async (e) => {
												if (pathname.startsWith('/session')) {
													e.preventDefault();
													const ok = await goWithPin('/facilitator/learners');
													if (ok) setFacilitatorMenuOpen(false);
													return;
												}
												setFacilitatorMenuOpen(false);
											}}
											style={{ display:'flex', width:'100%', alignItems:'center', gap:8, padding:'10px 12px', textDecoration:'none', fontWeight:600, color:'#111', borderTop:'1px solid #f3f4f6' }}
										>
											<span aria-hidden="true">👥</span>
											Learners
										</Link>
										<Link
											href="/facilitator/lessons"
											role="menuitem"
											onClick={async (e) => {
												if (pathname.startsWith('/session')) {
													e.preventDefault();
													const ok = await goWithPin('/facilitator/lessons');
													if (ok) setFacilitatorMenuOpen(false);
													return;
												}
												setFacilitatorMenuOpen(false);
											}}
											style={{ display:'flex', width:'100%', alignItems:'center', gap:8, padding:'10px 12px', textDecoration:'none', fontWeight:600, color:'#111', borderTop:'1px solid #f3f4f6' }}
										>
											<span aria-hidden="true">📚</span>
											Lessons
										</Link>
										<Link
											href="/facilitator/calendar"
											role="menuitem"
											onClick={async (e) => {
												if (pathname.startsWith('/session')) {
													e.preventDefault();
													const ok = await goWithPin('/facilitator/calendar');
													if (ok) setFacilitatorMenuOpen(false);
													return;
												}
												setFacilitatorMenuOpen(false);
											}}
											style={{ display:'flex', width:'100%', alignItems:'center', gap:8, padding:'10px 12px', textDecoration:'none', fontWeight:600, color:'#111', borderTop:'1px solid #f3f4f6' }}
										>
											<span aria-hidden="true">📅</span>
											Calendar
										</Link>
									</div>
								)}
							</div>
						</>
					)}
				</nav>
			</header>
			{/* Spacer to offset fixed header height so content below is never covered */}
			<div aria-hidden="true" style={{ height: headerHeight }} />
			</>
		);
}

