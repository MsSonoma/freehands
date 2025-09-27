"use client";
import { useEffect, useState } from "react";

export default function BillingStatusDev() {
  const [envStatus, setEnvStatus] = useState(null);
  const [error, setError] = useState("");

  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const mode = pk?.startsWith("pk_live_") ? "live" : pk?.startsWith("pk_test_") ? "test" : "unknown";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/health?detail=1", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Health check failed");
        if (cancelled) return;
        setEnvStatus(json?.env || null);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Health check error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (process.env.NODE_ENV === "production") return null;

  const missing = envStatus
    ? Object.entries(envStatus)
        .filter(([, v]) => v !== "present")
        .map(([k]) => k)
    : [];

  return (
    <div style={{
      margin: "12px 0",
      padding: "10px 12px",
      border: "1px dashed #ddd",
      borderRadius: 10,
      background: "#fcfcfc"
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Billing dev status</div>
      <div style={{ fontSize: 13, color: "#222" }}>
        Mode: <strong>{mode}</strong>
      </div>
      {error ? (
        <div style={{ color: "#b00020", marginTop: 6 }}>{error}</div>
      ) : envStatus ? (
        <div style={{ marginTop: 6, fontSize: 12, color: "#333" }}>
          Missing: {missing.length ? missing.join(", ") : "none"}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>Checking…</div>
      )}
    </div>
  );
}
