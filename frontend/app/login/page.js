"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./login.module.css";

// Icons
const LichtLogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const CertificateIcon = () => (
  <svg className={styles.authMethodIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 8h10M7 12h6" />
    <circle cx="16" cy="14" r="2" />
    <path d="M16 16v4" />
  </svg>
);

const TokenIcon = () => (
  <svg className={styles.authMethodIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const ConnectIcon = () => (
  <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const ErrorIcon = () => (
  <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const KubernetesIcon = () => (
  <svg className={styles.footerIcon} viewBox="0 0 24 24" fill="currentColor">
    <path d="M10.204 14.35l.007.01-.999 2.413a5.171 5.171 0 0 1-2.075-2.597l2.578-.437.489.611zm-.714-1.017l-.007-.004-2.374-1.073c.153-.65.45-1.24.862-1.744l1.952 1.652-.433 1.169zm.002-2.166l.007-.007.431-1.164L8.028 8.34a4.56 4.56 0 0 0-.862 1.744l2.379 1.072-.053.01zm.715-1.016l.007.004.999-2.412a5.171 5.171 0 0 0-2.075 2.596l.537.422.532-.61zm2.59 4.699l-.007-.004.489-.611 2.578.437a5.171 5.171 0 0 1-2.075 2.597l-.985-2.418zm.714-1.017l.007.004.532.61.537-.421a5.171 5.171 0 0 0-2.075-2.597l.999 2.412-.001-.008zm-.002-2.166l-.007.007-2.379-1.073a4.56 4.56 0 0 1 .862-1.744l1.952 1.652.572-.841zm-.715-1.016l-.007-.004-1.951-1.652a5.171 5.171 0 0 1 2.075 2.597l-1.116.059z" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();

  const [authMethod, setAuthMethod] = useState("certificate");
  const [serverUrl, setServerUrl] = useState("https://kubernetes:6443");
  const [certificateAuth, setCertificateAuth] = useState({
    clientCert: "",
    clientKey: "",
  });
  const [tokenAuth, setTokenAuth] = useState({ token: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setError(null);
    setLoading(true);
    try {
      const payload =
        authMethod === "certificate"
          ? {
              serverUrl,
              authMethod,
              clientCert: certificateAuth.clientCert.trim(),
              clientKey: certificateAuth.clientKey.trim(),
            }
          : {
              serverUrl,
              authMethod,
              token: tokenAuth.token.trim(),
            };

      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Login failed (${res.status}) ${t}`);
      }

      try {
        localStorage.setItem("licht-server-url", serverUrl);
      } catch {}

      router.push("/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        {/* Branding */}
        <div className={styles.branding}>
          <div className={styles.logoIcon}>
            <LichtLogoIcon />
          </div>
          <h1 className={styles.brandName}>Licht</h1>
          <span className={styles.tagline}>Kubernetes Dashboard</span>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            <ErrorIcon />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.formGroup}>
            <label htmlFor="serverUrl">API Server URL</label>
            <input
              id="serverUrl"
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://kubernetes:6443"
              required
              autoComplete="off"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Authentication Method</label>
            <div className={styles.authMethodToggle}>
              <button
                type="button"
                className={`${styles.authMethodButton} ${
                  authMethod === "certificate" ? styles.authMethodActive : ""
                }`}
                onClick={() => setAuthMethod("certificate")}
              >
                <CertificateIcon />
                Certificate
              </button>
              <button
                type="button"
                className={`${styles.authMethodButton} ${
                  authMethod === "token" ? styles.authMethodActive : ""
                }`}
                onClick={() => setAuthMethod("token")}
              >
                <TokenIcon />
                Token
              </button>
            </div>
          </div>

          {authMethod === "certificate" ? (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="clientCert">
                  Client Certificate (Base64)
                </label>
                <textarea
                  id="clientCert"
                  value={certificateAuth.clientCert}
                  onChange={(e) =>
                    setCertificateAuth({
                      ...certificateAuth,
                      clientCert: e.target.value,
                    })
                  }
                  placeholder="Paste your base64 encoded client certificate..."
                  rows={4}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="clientKey">Client Key (Base64)</label>
                <textarea
                  id="clientKey"
                  value={certificateAuth.clientKey}
                  onChange={(e) =>
                    setCertificateAuth({
                      ...certificateAuth,
                      clientKey: e.target.value,
                    })
                  }
                  placeholder="Paste your base64 encoded client key..."
                  rows={4}
                  required
                />
              </div>
            </>
          ) : (
            <div className={styles.formGroup}>
              <label htmlFor="token">Bearer Token</label>
              <textarea
                id="token"
                value={tokenAuth.token}
                onChange={(e) =>
                  setTokenAuth({ ...tokenAuth, token: e.target.value })
                }
                placeholder="Paste your Kubernetes bearer token..."
                rows={4}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className={styles.loginButton}
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                Connecting...
              </>
            ) : (
              <>
                Connect to Cluster
                <ConnectIcon />
              </>
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <span className={styles.footerText}>
            <KubernetesIcon />
            Kubernetes Dashboard v1.0
          </span>
        </div>
      </div>
    </div>
  );
}
