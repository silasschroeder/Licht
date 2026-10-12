# In-Cluster Licht: Design (in-cluster only)

Status: design agreed. Implementation in progress. Supersedes `IN_CLUSTER_PLAN.md`
(CLI section out of scope) and the earlier two-mode synthesis.

## Decision that shaped everything

In-cluster is the ONLY mode. Session/credential auth is deleted, not kept behind a flag.
This removes the entire reason the design needed a provider interface or a mode switch.
There is one Kubernetes client for the pod lifetime. It is built once at startup from
`rest.InClusterConfig()` and injected into every handler.

Principles applied: Attack the Premise (the two-lifetime problem vanishes with one mode),
Subtract Before You Add (delete session code before building Helm), Model the Domain (one
client, one lifetime, so one value, no abstraction).

## What gets DELETED (dead once session mode is gone)

Go:
- `go/handlers/auth.go` entirely. Login, Logout, CheckAuth, AuthMiddleware, LoginRequest,
  writeJSON/writeError move or go. writeJSON/writeError are used elsewhere, so they move to
  `helpers.go`.
- `go/handlers/helpers.go`: `maybeDecodeBase64OrPEM` deleted (only session cert decoding
  used it). File keeps writeJSON/writeError.
- `go/handlers/k8s.go`: `getK8sClient` deleted. The per-request session reconstruction is
  gone. Keep the pure helpers (countReadyContainers, getExternalIPs, calculateAge,
  writeJSONList).
- `go/config/config.go`: already dead (`CreateClientConfig`/`CreateClientset`/
  `K8sCredentials`). Deleted.
- `go/config/env.go`: drop `SessionSecretKey`, `SessionMaxAge`, `AllowedCORSOrigins`,
  `TLSInsecureSkipVerify`, `CACertPath` requirements. Backend serves frontend same-origin,
  so no CORS. In-cluster TLS is the mounted cluster CA, so no skip-verify. Keep `APIPort`,
  `LogLevel`.
- `go/main.go`: delete FilesystemStore, `./sessions` dir, cors() middleware, all auth
  routes, AuthMiddleware wrapping. Add static-file serving for the built frontend.
- `go/.env.example`: drop SESSION_SECRET_KEY, ALLOWED_CORS_ORIGINS, TLS_INSECURE_SKIP_VERIFY,
  SESSION_MAX_AGE, CA_CERT_PATH.

Frontend:
- `frontend/app/login/` entirely (page.js, login.module.css).
- `frontend/components/AuthCheck.tsx` and its test. No login to gate.
- `frontend/components/__tests__/AuthCheck.test.tsx`.
- `frontend/app/page.tsx`: remove AuthCheck wrapper, the /api/auth/check effect, the
  /login redirects, handleLogout and the Logout button.
- `frontend/lib/api.ts`: `credentials: "include"` no longer needed (no cookies). Keep the
  thin fetch wrappers.
- `frontend/next.config.mjs`: dev rewrite to localhost:8080 kept for local dev only, or
  removed if frontend is always served by the Go binary. Decide in step 3.

## What gets BUILT

Go:
- Client construction at startup in `main.go`: `rest.InClusterConfig()` ->
  `kubernetes.NewForConfig` -> one `kubernetes.Interface`. Fatal-log if it fails (not in a
  pod). This is the fail-fast.
- Handler constructors drop `(store, cfg)` and take `client kubernetes.Interface`:
  - `MakeResourceHandler(client, fetcher)`
  - `WatchPods(client)`, `WatchAll(client)`
  - `GetYAML(client)`, `ApplyYAML(client)`
  The 6 call sites that were `getK8sClient(r, store, cfg)` become the injected `client`.
- Static serving: Go serves the exported frontend under `/`, API under `/api`.

Deploy:
```
deploy/helm/licht/
  Chart.yaml
  values.yaml
  templates/
    serviceaccount.yaml
    clusterrole.yaml         # verbs [get,list,watch] ONLY, the ~10 watched types
    clusterrolebinding.yaml
    deployment.yaml          # replicas 1, serviceAccountName, securityContext hardened
    service.yaml             # ClusterIP
    ingress.yaml             # optional, values.ingress.enabled
Dockerfile                   # repo root, multi-stage: build frontend, build Go, run Go
```

ClusterRole:
```yaml
rules:
- apiGroups: [""]      resources: [pods, nodes, namespaces, services]  verbs: [get, list, watch]
- apiGroups: ["apps"]  resources: [deployments, replicasets, statefulsets, daemonsets]  verbs: [get, list, watch]
- apiGroups: ["batch"] resources: [jobs, cronjobs]  verbs: [get, list, watch]
```

## Access model

No app login. The ServiceAccount is the credential, read-only RBAC plus Service/Ingress
exposure is the boundary. Anyone who can route to the Service sees everything the SA can
read. Read-only, so no mutation is possible. Flagged in values.yaml comments.

## Sequencing (each step ends green)

1. Delete session mode (Go + frontend) and migrate handlers to an injected client built
   from InClusterConfig. Backend compiles, `go test ./handlers` passes (fetcher tests use
   the fake client, unaffected). Frontend builds, dashboard renders with no login.
2. Dockerfile: multi-stage, Go serves static frontend. VERIFY the Next.js static export
   actually works (the one empirical unknown). If export fails, fall back to serving the
   Next server in the same pod.
3. Helm chart: SA, read-only ClusterRole/Binding, Deployment, Service.
4. Optional Ingress + README deploy docs.

## Open empirical unknown

Next.js app-router static export (`output: 'export'`). Verified for real in step 2, not
assumed. If it fails, the image runs `next start` alongside the Go binary instead.
