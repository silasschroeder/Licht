"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "../lib/api";

export default function AuthCheck({ children }) {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet("/api/auth/check");
        if (res.ok) {
          if (!cancelled) setState({ loading: false, ok: true });
        } else if (res.status === 401) {
          if (!cancelled) {
            setState({ loading: false, ok: false });
            router.replace("/login");
          }
        } else {
          console.error("Auth check unexpected status:", res.status);
          if (!cancelled) router.replace("/login");
        }
      } catch (e) {
        console.error("Auth check error:", e);
        if (!cancelled) router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state.loading)
    return <div style={{ padding: 30 }}>Checking session…</div>;
  if (!state.ok) return null;
  return children;
}
