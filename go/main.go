package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gorilla/mux"
	"github.com/silasschroeder/licht/go/config"
	"github.com/silasschroeder/licht/go/handlers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var appCfg *config.Config

// Middleware: recover panics -> 500 JSON
func recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func(start time.Time) {
			if rec := recover(); rec != nil {
				log.Printf("[PANIC] %s %s %v", r.Method, r.URL.Path, rec)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(`{"message":"internal server error"}`))
			}
		}(time.Now())
		next.ServeHTTP(w, r)
	})
}

// Basic request logging
func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, r.RemoteAddr)
	})
}

func main() {
	var err error
	appCfg, err = config.Load()
	if err != nil {
		log.Fatalf("Configuration error: %v", err)
	}

	// In-cluster auth: build one client for the pod lifetime from the mounted
	// ServiceAccount token and cluster CA. Fails fast if not running in a pod.
	restCfg, err := rest.InClusterConfig()
	if err != nil {
		log.Fatalf("Failed to load in-cluster config (is Licht running inside the cluster?): %v", err)
	}
	client, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		log.Fatalf("Failed to create Kubernetes client: %v", err)
	}

	r := mux.NewRouter()
	r.Use(recovery)
	r.Use(logging)

	api := r.PathPrefix("/api").Subrouter()

	api.Handle("/pods", handlers.MakeResourceHandler(client, handlers.FetchPods)).Methods("GET")
	api.Handle("/nodes", handlers.MakeResourceHandler(client, handlers.FetchNodes)).Methods("GET")
	api.Handle("/namespaces", handlers.MakeResourceHandler(client, handlers.FetchNamespaces)).Methods("GET")
	api.Handle("/services", handlers.MakeResourceHandler(client, handlers.FetchServices)).Methods("GET")
	api.Handle("/deployments", handlers.MakeResourceHandler(client, handlers.FetchDeployments)).Methods("GET")
	api.Handle("/replicasets", handlers.MakeResourceHandler(client, handlers.FetchReplicaSets)).Methods("GET")
	api.Handle("/statefulsets", handlers.MakeResourceHandler(client, handlers.FetchStatefulSets)).Methods("GET")
	api.Handle("/daemonsets", handlers.MakeResourceHandler(client, handlers.FetchDaemonSets)).Methods("GET")
	api.Handle("/jobs", handlers.MakeResourceHandler(client, handlers.FetchJobs)).Methods("GET")
	api.Handle("/cronjobs", handlers.MakeResourceHandler(client, handlers.FetchCronJobs)).Methods("GET")

	api.Handle("/yaml", handlers.GetYAML(client)).Methods("GET")
	api.Handle("/yaml", handlers.ApplyYAML(client)).Methods("PUT")

	api.Handle("/watch/pods", handlers.WatchPods(client)).Methods("GET")
	api.Handle("/watch/stream", handlers.WatchAll(client)).Methods("GET")

	api.Handle("/pods/logs", handlers.StreamPodLogs(client)).Methods("GET")
	api.Handle("/pods/containers", handlers.ListPodContainers(client)).Methods("GET")

	// Serve the built frontend (static export) for everything that is not /api.
	// FRONTEND_DIR defaults to ./static in the container image.
	frontendDir := os.Getenv("FRONTEND_DIR")
	if frontendDir == "" {
		frontendDir = "./static"
	}
	r.PathPrefix("/").Handler(spaFileServer(frontendDir))

	port := appCfg.APIPort
	log.Printf("Licht listening on :%s (in-cluster mode)", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

// spaFileServer serves static files from dir, falling back to index.html for
// paths that do not map to a file (client-side routing).
func spaFileServer(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(dir, filepath.Clean(r.URL.Path))
		if _, err := os.Stat(path); os.IsNotExist(err) {
			http.ServeFile(w, r, filepath.Join(dir, "index.html"))
			return
		}
		fs.ServeHTTP(w, r)
	})
}

