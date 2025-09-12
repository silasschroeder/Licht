package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"
	"github.com/silasschroeder/licht/go/handlers"
)

var store = sessions.NewCookieStore([]byte("super-secret-key"))

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
	allowed := []string{"http://localhost:3000"}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		for _, o := range allowed {
			if origin == o {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	store.Options.Path = "/"
	store.Options.HttpOnly = true
	store.Options.MaxAge = 3600 * 8
	store.Options.SameSite = http.SameSiteLaxMode

	r := mux.NewRouter()

	// Middlewares
	r.Use(recovery)
	r.Use(cors)
	r.Use(logging)

	// Auth routes (public)
	r.HandleFunc("/api/auth/login", handlers.Login(store)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/logout", handlers.Logout(store)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/check", handlers.CheckAuth(store)).Methods("GET", "OPTIONS")

	// Protected resource routes
	auth := handlers.AuthMiddleware(store)

	r.Handle("/api/pods", auth(handlers.GetPods(store))).Methods("GET")
	r.Handle("/api/nodes", auth(handlers.GetNodes(store))).Methods("GET")
	r.Handle("/api/namespaces", auth(handlers.GetNamespaces(store))).Methods("GET")
	r.Handle("/api/services", auth(handlers.GetServices(store))).Methods("GET")
	r.Handle("/api/deployments", auth(handlers.GetDeployments(store))).Methods("GET")
	r.Handle("/api/replicasets", auth(handlers.GetReplicaSets(store))).Methods("GET")
	r.Handle("/api/statefulsets", auth(handlers.GetStatefulSets(store))).Methods("GET")
	r.Handle("/api/daemonsets", auth(handlers.GetDaemonSets(store))).Methods("GET")
	r.Handle("/api/jobs", auth(handlers.GetJobs(store))).Methods("GET")
	r.Handle("/api/cronjobs", auth(handlers.GetCronJobs(store))).Methods("GET")

	// SSE watch route
	r.Handle("/api/watch/pods", auth(handlers.WatchPods(store))).Methods("GET")
	// NEW: multi-resource stream
	r.Handle("/api/watch/stream", auth(handlers.WatchAll(store))).Methods("GET")

	// 404 fallback (ensures CORS still returned)
	r.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"message":"not found"}`, http.StatusNotFound)
	})

	port := os.Getenv("API_PORT")
	if strings.TrimSpace(port) == "" {
		port = "8080"
	}
	log.Printf("API listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}