# Licht

A modern, web-based frontend for your Kubernetes cluster. Licht provides an intuitive dashboard to visualize and monitor your Kubernetes resources in real-time.

> **Current Status**: Licht is currently in **read-only mode**, providing comprehensive visualization and monitoring of your Kubernetes cluster. The goal is to expand Licht to support full cluster interaction capabilities, including resource management, editing, and deployment operations.

## 🏗️ Architecture

Licht consists of two main components:

- **Go Backend** (`/go`): RESTful API server that communicates with the Kubernetes API
- **Next.js Frontend** (`/frontend`): Modern React-based web dashboard

```
┌─────────────────┐    HTTP/SSE     ┌─────────────────┐    Kubernetes    ┌─────────────────┐
│   Next.js       │ ◄─────────────► │   Go Backend    │ ◄──────────────► │   K8s Cluster   │
│   Frontend      │                 │   (API Server)  │                  │                 │
│   (Port 3000)   │                 │   (Port 8080)   │                  │                 │
└─────────────────┘                 └─────────────────┘                  └─────────────────┘
```

## ✨ Current Features (Read-Only)

- 🔐 **Secure Authentication**: Certificate and token-based Kubernetes authentication
- 📊 **Resource Dashboard**: View pods, nodes, services, deployments, and more
- 🔄 **Real-time Updates**: Server-Sent Events (SSE) for live cluster monitoring
- 🎯 **Namespace Filtering**: Focus on specific namespaces
- 🎨 **Visual Pod Status**: Color-coded pod states (Running, Pending, Failed, etc.)
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices

### Supported Kubernetes Resources

- Pods
- Nodes
- Namespaces
- Services
- Deployments
- ReplicaSets
- StatefulSets
- DaemonSets
- Jobs
- CronJobs

## 🚀 Future Roadmap

Licht aims to evolve from a read-only dashboard to a full-featured Kubernetes management platform:

- ⚡ **Resource Management**: Create, update, and delete Kubernetes resources
- 📝 **YAML Editor**: In-browser editing of resource configurations
- 🚀 **Application Deployment**: Streamlined deployment workflows
- 📈 **Advanced Monitoring**: Metrics integration and alerting
- 🔧 **Cluster Operations**: Node management and cluster maintenance tools
- 👥 **Multi-user Support**: Role-based access control

## 🛠️ Tech Stack

**Backend:**

- Go 1.25+
- Gorilla Mux (HTTP router)
- Kubernetes client-go library
- Server-Sent Events for real-time updates

**Frontend:**

- Next.js 15.5+
- React 19.1+
- Turbopack for fast builds
- CSS Modules for styling

## 📋 Prerequisites

- Go 1.25 or later
- Node.js 18+ and npm
- Access to a Kubernetes cluster
- Valid Kubernetes credentials (certificate or token)

## 🏃‍♂️ Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/silasschroeder/Licht.git
cd Licht
```

### 2. Setup Backend

```bash
cd go
go mod tidy
go run main.go
```

The API server will start on `http://localhost:8080`

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

The web interface will be available at `http://localhost:3000`

### 4. Configure Kubernetes Access

Ensure you have access to your Kubernetes cluster. For K3s users:

```bash
# View your kubeconfig
cat /etc/rancher/k3s/k3s.yaml

# Or copy it to the standard location
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config
```

For other Kubernetes distributions, follow the [official client-go setup documentation](https://kubernetes.io/docs/tasks/access-application-cluster/access-cluster/).

## 🔧 Development

### Backend Development

```bash
cd go
go mod tidy
go run main.go
```

### Frontend Development

```bash
cd frontend
npm run dev
```

The frontend uses Turbopack for fast development builds and hot reloading.

## 🤝 Contributing

Licht is under active development. Contributions are welcome as we work towards making it a comprehensive Kubernetes management platform.

## 📄 License

This project is open source. Please check the repository for license details.

## 🔗 References

- [Go Documentation](https://go.dev/doc/code) - For Go setup and development
- [Kubernetes Client Access](https://kubernetes.io/docs/tasks/access-application-cluster/access-cluster/) - For client-go setup
- [Next.js Documentation](https://nextjs.org/docs) - For frontend development


```sh
kubectl config view --raw --minify
```