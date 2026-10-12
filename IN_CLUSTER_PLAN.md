# Licht In-Cluster Deployment: Architecture Plan

Status: draft / proposal. No code changed yet.

## Goal

Make Licht a dashboard that **runs inside the Kubernetes cluster it monitors**, so it
becomes an always-on, shared, monitorable resource rather than a tool each user starts
locally and feeds credentials to by hand.

Today Licht runs on the user's machine and builds a Kubernetes client from credentials
the user pastes into a login form (client cert + key, or a bearer token). The in-cluster
approach flips this: Licht authenticates to the API server using its own ServiceAccount,
and users just open a URL.

## Why in-cluster

Running inside the cluster removes the three hard problems that exist only because Licht
currently runs outside it:

- **TLS / CA trust.** A pod talks to the API server at `https://kubernetes.default.svc`
  with the cluster CA mounted at a known path. Verification works out of the box. No
  `TLS_INSECURE_SKIP_VERIFY` shortcut needed.
- **Credentials.** In-cluster, Kubernetes mounts a ServiceAccount token automatically.
  There is no kubeconfig to parse, no cloud exec-plugins (EKS/GKE/OIDC) to resolve, and
  no cert/token to store in a session.
- **Access.** Users reach the dashboard through an Ingress, Service, or port-forward.
  No per-user login handoff.

The trade is that RBAC becomes the security boundary and the deployment surface grows
(see Risks below).

## Architecture

```
                    Kubernetes Cluster
  ┌───────────────────────────────────────────────────────┐
  │                                                        │
  │   ┌──────────────────── Licht Pod ───────────────────┐ │
  │   │                                                   │ │
  │   │   Next.js frontend  ◄──►  Go backend             │ │
  │   │   (static / SSR)          (in-cluster client)    │ │
  │   │                                   │               │ │
  │   └───────────────────────────────────┼───────────────┘ │
  │                                        │ ServiceAccount   │
  │                                        │ token + cluster  │
  │                                        ▼ CA (auto-mounted)│
  │                              Kubernetes API Server        │
  │                           (https://kubernetes.default.svc)│
  └───────────────────────────────────────────────────────┘
            ▲
            │ Ingress / Service / port-forward
            │
         Browser
```

### Auth model change (the core work)

Add an **in-cluster auth mode** to the backend. When Licht detects it is running inside
a pod, it builds its Kubernetes client from the in-cluster config (ServiceAccount token
and cluster CA that `client-go` reads automatically) instead of from pasted credentials.

- `client-go` provides `rest.InClusterConfig()` for exactly this.
- The existing credential-based login path (`/go/handlers/auth.go`, session store,
  `getK8sClient()` reconstruction in `/go/handlers/k8s.go`) stays for the local/CLI case.
  The two modes should be selectable, not mutually exclusive.
- Detection options: an explicit env flag (e.g. `LICHT_AUTH_MODE=in-cluster`), or presence
  of the mounted ServiceAccount token. An explicit flag is clearer and testable.

Open question: in in-cluster mode, is the dashboard itself still gated by a login, or is
it open to anyone who can reach the URL? Two directions:

1. **No app login.** Licht uses the ServiceAccount for all reads; access is controlled
   entirely by how the Service/Ingress is exposed (and any Ingress-level auth).
2. **Keep an app login** that maps to the viewer, so the dashboard isn't wide open to
   anyone on the network. More work, more secure for shared clusters.

This decision drives how much of the current session/auth code is reused.

### RBAC

Licht is read-only, so it needs a read-only **ClusterRole** granting `get`/`list`/`watch`
on the resource types the dashboard already watches (pods, nodes, deployments, services,
etc. — the 10 resource types in `/go/handlers/watch_multi.go`). Bind it to the Licht
ServiceAccount with a ClusterRoleBinding.

Keeping this ClusterRole tight and auditable is the main security surface of the whole
approach. It should grant nothing beyond read verbs on the watched resources.

### Packaging: Helm chart

Ship a Helm chart so teams can deploy Licht as a standard workload. Rough contents:

- **Deployment** — Licht pod (frontend + backend; one image or two containers, TBD).
- **ServiceAccount** — the identity Licht authenticates as.
- **ClusterRole + ClusterRoleBinding** — the read-only permissions above.
- **Service** — in-cluster reachability.
- **Ingress** (optional, values-gated) — external reachability.
- **values.yaml** — image tag, resource limits, auth-mode toggle, Ingress on/off,
  which resource types to watch.

### Container image

The current dev setup runs frontend (`:3000`) and backend (`:8080`) as separate
processes, and `next.config.mjs` hardcodes the backend at `localhost:8080` while CORS
is pinned to `http://localhost:3000`. For a single pod these can co-locate, but the
hardcoded ports/origins need to become configurable (or the two containers share a pod
network so `localhost` still works). This is a known cleanup item, not a blocker.

## Rough sequencing

1. **In-cluster auth mode** in the Go backend (`rest.InClusterConfig()`, mode selection,
   keep the existing credential path intact). This is the foundation.
2. **Decide the in-cluster login question** (open vs app-gated) — shapes step 1's scope.
3. **Helm chart** with Deployment, ServiceAccount, read-only ClusterRole/Binding, Service.
4. **Image build** and config cleanup (ports/CORS/origins configurable).
5. **Optional Ingress** and docs for exposing the dashboard.

## Risks and costs

- **RBAC is the security boundary.** A cluster-wide read grant must be reviewed and
  approved by whoever owns the cluster. "It can list all namespaces" is a real grant.
- **Exposure.** Reaching the dashboard from a browser needs an Ingress/Service/port-forward;
  that is one more thing to configure and secure.
- **Auth model inversion.** The backend is currently built around user-supplied
  credentials. In-cluster mode is a genuine change to the auth path, though `client-go`
  makes the client construction itself a one-liner.
- **Heavier to ship.** A Helm chart is substantially more surface area (several YAML
  resources + values) than the current two-process local run.
- **One dashboard per cluster.** In-cluster means Licht is deployed ahead of time for a
  specific cluster, unlike a local tool that can point anywhere on demand.

## Alternative / complement: a CLI

A small local CLI is a **complementary** option, not a replacement, and is noted here only
briefly. It would read the user's kubeconfig, start Licht locally, and open the browser
already authenticated — a five-second way to look at any cluster in your kubeconfig with
nothing installed on the cluster. It fits the laptop-debugging case; the in-cluster
deployment fits the always-on, shared-dashboard case. The two can coexist: in-cluster as
the deployable product, the CLI as a convenience on top. The CLI is intentionally left
unspecified here.
