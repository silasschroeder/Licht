# Licht

A modern, real-time Kubernetes dashboard with an intuitive visual interface.

![Licht Dashboard](https://img.shields.io/badge/version-1.0-blue)
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
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js       │     │   Go API        │     │   Kubernetes    │
│   Frontend      │◄───►│   Server        │◄───►│   API Server    │
│   (Port 3000)   │     │   (Port 8080)   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **Frontend**: Next.js 15 with React 19, Framer Motion animations, CSS Modules
- **Backend**: Go with Gorilla Mux, session-based auth, Kubernetes client-go
- **Communication**: REST API + SSE for real-time streaming

## Getting Started

### Prerequisites

- Go 1.21+
- Node.js 18+
- Access to a Kubernetes cluster
- Valid kubeconfig or service account credentials

### Backend Setup

```bash
cd go

# Copy environment template
cp .env.example .env

# Configure your environment
# Edit .env with your settings:
# - SESSION_SECRET_KEY (min 32 chars)
# - ALLOWED_CORS_ORIGINS
# - TLS_INSECURE_SKIP_VERIFY (true for local dev)

# Run the server
go run main.go
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Authentication

Licht supports two authentication methods:

1. **Client Certificate**: Provide base64-encoded client certificate and key
2. **Bearer Token**: Provide a Kubernetes service account token

## Project Structure

```
licht/
├── go/                     # Go backend
│   ├── config/             # Environment configuration
│   ├── handlers/           # HTTP handlers (factory pattern)
│   │   ├── auth.go         # Authentication endpoints
│   │   ├── factory.go      # Generic handler factory
│   │   ├── fetchers.go     # K8s resource fetchers
│   │   ├── watch_multi.go  # SSE multi-resource streaming
│   │   └── yaml.go         # YAML operations
│   └── main.go             # Router setup
│
├── frontend/               # Next.js frontend
│   ├── app/                # Next.js app router
│   │   ├── page.tsx        # Main dashboard
│   │   └── login/          # Login page
│   ├── components/         # React components
│   │   ├── NamespaceCanvas/    # Namespace visualization
│   │   ├── ResourceExplorer/   # Grid/Table/Topology views
│   │   ├── ResourceDrawer/     # Detail slide-in panel
│   │   └── QuickFilter/        # Cmd+K search
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities & animations
│   ├── styles/             # Design tokens
│   └── types/              # TypeScript definitions
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

| Variable | Description | Required |
|----------|-------------|----------|
| `SESSION_SECRET_KEY` | Secret for session encryption (min 32 chars) | Yes |
| `ALLOWED_CORS_ORIGINS` | Comma-separated allowed origins | Yes |
| `TLS_INSECURE_SKIP_VERIFY` | Skip TLS verification (dev only) | No |
| `CA_CERT_PATH` | Path to custom CA certificate | No |

### Frontend Configuration

The frontend proxies API requests to the backend via Next.js rewrites configured in `next.config.mjs`.

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

```bash
# Backend
cd go
go build -o licht

# Frontend
cd frontend
npm run build
npm start
```

## Security Considerations

- Sessions are stored on the filesystem in `./sessions/` with 0700 permissions
- TLS verification is enabled by default in production
- CORS origins must be explicitly configured
- Credentials are never logged or exposed in responses

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Backend powered by [Go](https://golang.org/)
- Kubernetes client via [client-go](https://github.com/kubernetes/client-go)
- Animations by [Framer Motion](https://www.framer.com/motion/)
