"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./login.module.css";

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
        <h1>Kubernetes Cluster Login</h1>

        {error && <div className={styles.errorMessage}>{error}</div>}

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
            <div className={styles.radioGroup}>
              <label>
                <input
                  type="radio"
                  name="authMethod"
                  value="certificate"
                  checked={authMethod === "certificate"}
                  onChange={() => setAuthMethod("certificate")}
                />
                Client Certificate
              </label>
              <label>
                <input
                  type="radio"
                  name="authMethod"
                  value="token"
                  checked={authMethod === "token"}
                  onChange={() => setAuthMethod("token")}
                />
                Token
              </label>
            </div>
          </div>

          {authMethod === "certificate" ? (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="clientCert">
                  Client Certificate (Base64 encoded)
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
                  placeholder="Paste your base64 encoded client certificate"
                  rows={4}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="clientKey">Client Key (Base64 encoded)</label>
                <textarea
                  id="clientKey"
                  value={certificateAuth.clientKey}
                  onChange={(e) =>
                    setCertificateAuth({
                      ...certificateAuth,
                      clientKey: e.target.value,
                    })
                  }
                  placeholder="Paste your base64 encoded client key"
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
                placeholder="Paste your Kubernetes bearer token"
                rows={4}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className={styles.loginButton}
            disabled={loading}
            onClick={handleSubmit} // ensure Safari calls handler even if onSubmit fails
          >
            {loading ? "Connecting..." : "Connect to Cluster"}
          </button>
        </form>
      </div>
    </div>
  );
}
