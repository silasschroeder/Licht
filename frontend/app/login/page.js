"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE, apiPost } from "../../lib/api";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [authMethod, setAuthMethod] = useState("certificate");
  const [serverUrl, setServerUrl] = useState("https://141.72.13.88:6443");
  const [certificateAuth, setCertificateAuth] = useState({
    clientCert: "",
    clientKey: "",
  });
  const [tokenAuth, setTokenAuth] = useState({ token: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const credentials = {
        serverUrl: serverUrl.trim(),
        authMethod,
        ...(authMethod === "certificate" ? certificateAuth : tokenAuth),
      };

      const response = await apiPost("/api/auth/login", credentials);

      if (!response.ok) {
        let message = "Login failed";
        try {
          const data = await response.json();
          if (data?.message) message = data.message;
        } catch {
          try {
            const text = await response.text();
            if (text) message = text;
          } catch {}
        }
        throw new Error(message);
      }

      router.push("/");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <h1>Kubernetes Cluster Login</h1>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="serverUrl">API Server URL</label>
            <input
              id="serverUrl"
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://kubernetes:6443"
              required
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
          >
            {loading ? "Connecting..." : "Connect to Cluster"}
          </button>
        </form>
      </div>
    </div>
  );
}
