package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"
	"github.com/silasschroeder/licht/go/config"
	"github.com/silasschroeder/licht/go/handlers"
)

// Use FilesystemStore to handle large session data (like certificates)
var (
	store  *sessions.FilesystemStore
	appCfg *config.Config
)

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

// CORS middleware (allow localhost:3000)
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowed := appCfg.AllowedCORSOrigins
		origin := r.Header.Get("Origin")
		for _, o := range allowed {
			if origin == o {
				w.Header().Set("Access-Control-Allow-Origin", o)
			}
		}
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization")
		// Add PUT for editing
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	// Load configuration
	var err error
	appCfg, err = config.Load()
	if err != nil {
		log.Fatalf("Configuration error: %v", err)
	}

	store = sessions.NewFilesystemStore("./sessions", appCfg.SessionSecretKey)
	// Increase MaxLength to handle large certificate data
	store.MaxLength(8192)

	// Ensure sessions directory exists
	if err := os.MkdirAll("./sessions", 0700); err != nil {
		log.Fatal("Failed to create sessions directory:", err)
	}

	store.Options.Path = "/"
	store.Options.HttpOnly = true
	store.Options.MaxAge = appCfg.SessionMaxAge
	store.Options.SameSite = http.SameSiteLaxMode
	// Workaround: secure cookies often require HTTPS. For localhost dev, false is safer unless using https://
	store.Options.Secure = false

	r := mux.NewRouter()

	// Middlewares
	r.Use(recovery)
	r.Use(cors)
	r.Use(logging)

	// Auth routes (public)
	r.HandleFunc("/api/auth/login", handlers.Login(store, appCfg)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/logout", handlers.Logout(store)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/check", handlers.CheckAuth(store)).Methods("GET", "OPTIONS")

	// Protected resource routes
	auth := handlers.AuthMiddleware(store)

	r.Handle("/api/pods", auth(handlers.MakeResourceHandler(store, appCfg, handlers.FetchPods))).Methods("GET")
	r.Handle("/api/nodes", auth(handlers.MakeResourceHandler(store, appCfg, handlers.FetchNodes))).Methods("GET")
	r.Handle("/api/namespaces", auth(handlers.MakeResourceHandler(store, appCfg, handlers.FetchNamespaces))).Methods("GET")
	r.Handle("/api/services", auth(handlers.MakeResourceHandler(store, appCfg, handlers.FetchServices))).Methods("GET")
	r.Handle("/api/deployments", auth(handlers.MakeResourceHandler(store, appCfg, handlers.FetchDeployments))).Methods("GET")
	r.Handle("/api/replicasets", auth(handlers.MakeResourceHandler(store, appCfg, handlers.FetchReplicaSets))).Methods("GET")
	r.Handle("/api/statefulsets", auth(handlers.MakeResourceHandler(store, appCfg, handlers.FetchStatefulSets))).Methods("GET")
	r.Handle("/api/daemonsets", auth(handlers.MakeResourceHandler(store, appCfg, handlers.FetchDaemonSets))).Methods("GET")
	r.Handle("/api/jobs", auth(handlers.MakeResourceHandler(store, appCfg, handlers.FetchJobs))).Methods("GET")
	r.Handle("/api/cronjobs", auth(handlers.MakeResourceHandler(store, appCfg, handlers.FetchCronJobs))).Methods("GET")

	// YAML inspect route
	r.Handle("/api/yaml", auth(handlers.GetYAML(store, appCfg))).Methods("GET")
	// YAML edit/apply route
	r.Handle("/api/yaml", auth(handlers.ApplyYAML(store, appCfg))).Methods("PUT")

	// SSE watch route
	r.Handle("/api/watch/pods", auth(handlers.WatchPods(store, appCfg))).Methods("GET")
	// NEW: multi-resource stream
	r.Handle("/api/watch/stream", auth(handlers.WatchAll(store, appCfg))).Methods("GET")

	// 404 fallback (ensures CORS still returned)
	r.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"message":"not found"}`, http.StatusNotFound)
	})

	port := appCfg.APIPort
	log.Printf("API listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}