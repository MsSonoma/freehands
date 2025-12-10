"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function FacilitatorSettingsPage() {
	const router = useRouter()

	useEffect(() => {
		// Redirect to unified account page
		router.push('/facilitator/account')
	}, [router])

	return (
		<main style={{ padding: 12 }}>
			<div style={{ width:'100%', maxWidth: 760, margin: '0 auto', textAlign:'center' }}>
				<h1 style={{ fontSize:24, fontWeight:800, margin:'0 0 8px 0' }}>Redirecting…</h1>
				<p style={{ color:'#6b7280' }}>Settings have moved to the Account page.</p>
			</div>
		</main>
	)
}
