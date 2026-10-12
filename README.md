# Licht

A modern, real-time Kubernetes dashboard with an intuitive visual interface.

![Licht Dashboard](https://img.shields.io/badge/version-1.0.1-blue)
![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

## Overview

Licht ("light" in German) is a lightweight Kubernetes dashboard that provides real-time visibility into your cluster resources. It features a unique namespace visualization with pod status squares, an interactive topology graph, and a clean modern UI.

### Key Features

- **Real-time Updates**: Live resource monitoring via Server-Sent Events (SSE)
- **Namespace Visualization**: Interactive namespace cards with pod status squares
- **Resource Topology**: Force-directed graph showing relationships between Pods, Deployments, and Services
- **Multiple View Modes**: Switch between Grid, Table, and Topology views
- **Quick Search**: Cmd+K spotlight search across all resources
- **Resource Details**: Slide-in drawer with YAML viewer and resource overview
- **Secure Authentication**: Certificate or token-based Kubernetes authentication

## Architecture

```
                 Licht Pod (one container, port 8080)
┌─────────────────────────────────────────────┐     ┌─────────────────┐
│   Go binary                                  │     │   Kubernetes    │
│   serves static Next.js frontend  +  REST/SSE│◄───►│   API Server    │
│   (authenticates via its ServiceAccount)     │     │                 │
└─────────────────────────────────────────────┘     └─────────────────┘
         ▲
         │ Service / Ingress / port-forward
       Browser
```

- **Frontend**: Next.js 15 with React 19, Framer Motion animations, CSS Modules, built as
  a static export and served by the Go binary
- **Backend**: Go with Gorilla Mux and Kubernetes client-go, authenticating in-cluster via
  its ServiceAccount
- **Communication**: REST API + SSE for real-time streaming

## Getting Started

Licht runs **inside** the cluster it monitors. It authenticates with its own
ServiceAccount, so there is no login and no credentials to paste. Deploy it with Helm and
open the dashboard.

### Prerequisites

- A Kubernetes cluster and `kubectl` access to it
- Helm 3+
- A built Licht image (see [Building the image](#building-the-image)), or the published
  `ghcr.io/silasschroeder/licht` image

### Deploy with Helm

```bash
helm install licht ./deploy/helm/licht --namespace licht --create-namespace
```

This installs a Deployment, a Service, a ServiceAccount, and a ClusterRole (and binding)
granting read and write on the resource types Licht manages. To run read-only, set
`rbac.verbs` to `[get, list, watch]` (see [Security](#security-considerations)).

Reach the dashboard with a port-forward:

```bash
kubectl -n licht port-forward svc/licht 8080:80
```

Then open [http://localhost:8080](http://localhost:8080).

To expose it outside the cluster, enable the Ingress:

```bash
helm upgrade licht ./deploy/helm/licht --namespace licht \
  --set ingress.enabled=true --set ingress.host=licht.example.com
```

> **Security.** Licht has no application login, and by default its ServiceAccount can read
> and modify cluster resources (including Secrets). Anyone who can reach the Service can do
> the same. Expose it only behind authentication you trust (Ingress auth, a VPN, or an auth
> proxy), and see [Security Considerations](#security-considerations) for the read-only
> option.

### Building the image

```bash
docker build -t ghcr.io/silasschroeder/licht:latest .
docker push ghcr.io/silasschroeder/licht:latest
```

The image is a single container: a multi-stage build compiles the Next.js frontend to a
static export and the Go backend to a binary, and the binary serves both the API and the
static frontend on port 8080.

### Local development

The backend requires an in-cluster ServiceAccount, so it does not run standalone on your
machine. For frontend work, run the Next.js dev server and point `/api` at a running
backend (for example a `kubectl port-forward` to an in-cluster Licht):

```bash
cd frontend
npm install
npm run dev
```


## Project Structure

```
licht/
├── go/                     # Go backend
│   ├── config/             # Environment configuration
│   ├── handlers/           # HTTP handlers (factory pattern)
│   │   ├── factory.go      # Generic handler factory
│   │   ├── fetchers.go     # K8s resource fetchers
│   │   ├── watch_multi.go  # SSE multi-resource streaming
│   │   └── yaml.go         # YAML operations
│   └── main.go             # Router, in-cluster client, static serving
│
├── frontend/               # Next.js frontend
│   ├── app/                # Next.js app router
│   │   └── page.tsx        # Main dashboard
│   ├── components/         # React components
│   │   ├── NamespaceCanvas/    # Namespace visualization
│   │   ├── ResourceExplorer/   # Grid/Table/Topology views
│   │   ├── ResourceDrawer/     # Detail slide-in panel
│   │   └── QuickFilter/        # Cmd+K search
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities & animations
│   ├── styles/             # Design tokens
│   └── types/              # TypeScript definitions
│
├── deploy/helm/licht/      # Helm chart
└── Dockerfile              # Single-image multi-stage build
```

## Supported Resources

| Resource | List | Watch | YAML View |
|----------|------|-------|-----------|
| Pods | ✓ | ✓ | ✓ |
| Deployments | ✓ | ✓ | ✓ |
| Services | ✓ | ✓ | ✓ |
| ReplicaSets | ✓ | ✓ | ✓ |
| StatefulSets | ✓ | ✓ | ✓ |
| DaemonSets | ✓ | ✓ | ✓ |
| Jobs | ✓ | ✓ | ✓ |
| CronJobs | ✓ | ✓ | ✓ |
| Namespaces | ✓ | ✓ | - |
| Nodes | ✓ | ✓ | - |

## Configuration

### Backend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | Port the server listens on | `8080` |
| `LOG_LEVEL` | Log verbosity | `info` |
| `FRONTEND_DIR` | Directory of the built static frontend | `./static` |

In-cluster authentication (the ServiceAccount token and cluster CA) is mounted by
Kubernetes automatically. There is nothing to configure for it.

Helm values (image, replicas, Service type, Ingress, resources, RBAC) are in
`deploy/helm/licht/values.yaml`.


## Development

### Running Tests

```bash
# Backend tests
cd go
go test ./handlers -v

# Frontend tests
cd frontend
npm test
```

### Building for Production

Build the container image (see [Building the image](#building-the-image)):

```bash
docker build -t ghcr.io/silasschroeder/licht:latest .
```

## Security Considerations

- Licht authenticates as its own ServiceAccount. By default its ClusterRole grants
  **read and write** (`get`/`list`/`watch`/`create`/`update`/`patch`/`delete`) on the
  resource types it manages, **including Secrets**, cluster-wide.
- There is no application login. Anyone who can reach the Service can read and modify
  those resources. Only expose Licht behind authentication you trust (Ingress auth, a VPN,
  or an auth proxy), and scope access with network policy.
- To run Licht read-only, set `rbac.verbs` to `[get, list, watch]` in the Helm values.
- The pod runs as non-root with a read-only root filesystem and all capabilities dropped.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Backend powered by [Go](https://golang.org/)
- Kubernetes client via [client-go](https://github.com/kubernetes/client-go)
- Animations by [Framer Motion](https://www.framer.com/motion/)
