package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"
	"github.com/silasschroeder/licht/go/handlers"
)

// Global session store
var store = sessions.NewCookieStore([]byte("super-secret-key-change-this-in-production"))

func main() {
    // Initialize session store settings
    store.Options = &sessions.Options{
        Path:     "/",
        MaxAge:   3600 * 8, // 8 hours
        HttpOnly: true,
    }

    // Initialize router
    r := mux.NewRouter()
    
    // Auth routes
    r.HandleFunc("/api/auth/login", handlers.Login(store)).Methods("POST", "OPTIONS")
    r.HandleFunc("/api/auth/logout", handlers.Logout(store)).Methods("POST", "OPTIONS")
    r.HandleFunc("/api/auth/check", handlers.CheckAuth(store)).Methods("GET", "OPTIONS")
    
    // K8s API routes - all protected by auth middleware
    apiRouter := r.PathPrefix("/api").Subrouter()
    apiRouter.Use(handlers.AuthMiddleware(store))
    
    apiRouter.HandleFunc("/pods", handlers.GetPods(store)).Methods("GET", "OPTIONS")
    apiRouter.HandleFunc("/nodes", handlers.GetNodes(store)).Methods("GET", "OPTIONS")
    apiRouter.HandleFunc("/namespaces", handlers.GetNamespaces(store)).Methods("GET", "OPTIONS")
    
    // CORS middleware
    r.Use(func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
            w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
            w.Header().Set("Access-Control-Allow-Credentials", "true") // Wichtig!
            
            if r.Method == "OPTIONS" {
                w.WriteHeader(http.StatusOK)
                return
            }
            
            next.ServeHTTP(w, r)
        })
    })
    
    // Start server
    fmt.Println("Starting server on :8080")
    log.Fatal(http.ListenAndServe(":8080", r))
}