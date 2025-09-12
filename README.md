# Licht

A minimal web UI for exploring and interacting with a Kubernetes cluster.

## Overview

Licht consists of:

- Go backend (`/go`): REST + session handling (Gorilla Mux/Sessions) and Kubernetes API (client-go).
- Next.js frontend (`/frontend`): App Router UI that calls the backend.
- Goal: Lightweight, local-first dashboard for rapid cluster introspection.

## Features (current / planned)

- Session-based auth scaffolding
- Kubernetes resource listing & watch (using informers / manual watches)
- Multi-watch abstraction (`handlers/watch_multi.go`)
- Simple login flow placeholder (see `frontend/app/login/`)
- Extensible handler structure (`/go/handlers`)

## Tech Stack

| Layer    | Tech                                                |
| -------- | --------------------------------------------------- |
| Backend  | Go 1.25, Gorilla Mux, client-go                     |
| Frontend | Next.js (App Router), React                         |
| Cluster  | Any kubeconfig-accessible cluster (k3s, kind, etc.) |

## Prerequisites

- Go 1.25+
- Node.js 18+ (for Next.js)
- A valid `KUBECONFIG` (or default in `~/.kube/config`)
- Access rights to list/watch desired resources

## Quick Start

### 1. Clone

```sh
git clone https://github.com/silasschroeder/licht.git
cd licht
```

### 2. Backend

```sh
cd go
go mod tidy
export KUBECONFIG=</path/to/your/kubeconfig>   # if not default
go run ./...
```

Server defaults (adjust in `main.go` or config layer when extended):

- Port: 8080
- Cookie session store (in-memory secret placeholder)

### 3. Frontend

```sh
cd ../frontend
npm install
npm run dev
```

Access UI at http://localhost:3000 (frontend) calling backend at (adjust CORS if needed).

## Development Notes

Backend middleware (logging, recovery, CORS) lives in [`main.go`](go/main.go).  
Handlers organized under [`/go/handlers`](go/handlers/):

- `auth.go`: session + auth scaffolding
- `k8s.go`: Kubernetes interactions
- `watch.go` / `watch_multi.go`: resource watch patterns
- `helpers.go`: shared utilities

Add new resource handlers alongside existing ones; wire them in the router in `main.go`.

## Kubernetes Access

Typical kubeconfig discovery order (client-go):

1. Explicit `KUBECONFIG`
2. `~/.kube/config`
3. In-cluster (future use case)

Test connectivity:

```sh
kubectl get nodes
```

## Scripts / Common Commands

```sh
# Backend
go fmt ./...
go vet ./...
go test ./...    # (add tests)

# Frontend
npm run lint
npm run build
```

## Security / Hardening To-Do

- Replace static cookie secret with env-based secret
- Add CSRF protection
- Enforce HTTPS / secure cookie flags
- Implement real auth (OIDC / Kubernetes tokens)
- RBAC-aware filtering of API results

## Folder Structure (high-level)

```
go/
  main.go
  handlers/
  config/
frontend/
  app/
  components/
  lib/
```

## Roadmap (short)

- Pod / Deployment detail views
- Log streaming
- Exec into pod (backend proxy)
- Namespace switcher
- RBAC-aware UI pruning
- Dark mode toggle

## Contributing

PRs welcome. Keep changes small and focused. Add comments for Kubernetes interactions.

## License

(Choose a license: MIT / Apache-2.0 / etc.)

## Troubleshooting

| Issue                | Fix                                               |
| -------------------- | ------------------------------------------------- |
| 401 / session lost   | Check cookie domain / browser blocking            |
| Empty resource lists | Verify KUBECONFIG context & RBAC                  |
| CORS errors          | Confirm allowed origin in backend CORS middleware |

Minimal, focused, extensible. Build
