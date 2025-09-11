package handlers

// filepath: /Users/i588313/Documents/GitHub/Licht/go/handlers/auth.go

import (
	"encoding/base64"
	"encoding/json"
	"net/http"

	"github.com/gorilla/sessions"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

type LoginRequest struct {
    ServerURL  string `json:"serverUrl"`
    AuthMethod string `json:"authMethod"`
    ClientCert string `json:"clientCert"`
    ClientKey  string `json:"clientKey"`
    Token      string `json:"token"`
}

// Login handles authentication and stores credentials in session
func Login(store *sessions.CookieStore) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        var req LoginRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
            http.Error(w, "Invalid request", http.StatusBadRequest)
            return
        }
        
        // Create Kubernetes config based on auth method
        var k8sConfig *rest.Config
        var err error
        
        if req.AuthMethod == "certificate" {
            // Decode client certificate and key from base64
            clientCertData, err := base64.StdEncoding.DecodeString(req.ClientCert)
            if err != nil {
                http.Error(w, "Invalid client certificate", http.StatusBadRequest)
                return
            }
            
            clientKeyData, err := base64.StdEncoding.DecodeString(req.ClientKey)
            if err != nil {
                http.Error(w, "Invalid client key", http.StatusBadRequest)
                return
            }
            
            k8sConfig = &rest.Config{
                Host: req.ServerURL,
                TLSClientConfig: rest.TLSClientConfig{
                    Insecure: true, // TODO: Make this configurable
                    CertData: clientCertData,
                    KeyData:  clientKeyData,
                },
            }
        } else if req.AuthMethod == "token" {
            k8sConfig = &rest.Config{
                Host:        req.ServerURL,
                BearerToken: req.Token,
                TLSClientConfig: rest.TLSClientConfig{
                    Insecure: true, // TODO: Make this configurable
                },
            }
        } else {
            http.Error(w, "Unsupported authentication method", http.StatusBadRequest)
            return
        }
        
        // Test the connection to verify credentials
        clientset, err := kubernetes.NewForConfig(k8sConfig)
        if err != nil {
            http.Error(w, "Failed to create Kubernetes client: "+err.Error(), http.StatusUnauthorized)
            return
        }
        
        // Try a simple API call to verify credentials
        _, err = clientset.CoreV1().Namespaces().List(r.Context(), metav1.ListOptions{})
        if err != nil {
            http.Error(w, "Failed to connect to Kubernetes: "+err.Error(), http.StatusUnauthorized)
            return
        }
        
        // Store the credentials in the session
        session, _ := store.Get(r, "k8s-session")
        session.Values["authenticated"] = true
        session.Values["server_url"] = req.ServerURL
        session.Values["auth_method"] = req.AuthMethod
        
        if req.AuthMethod == "certificate" {
            session.Values["client_cert"] = req.ClientCert
            session.Values["client_key"] = req.ClientKey
        } else {
            session.Values["token"] = req.Token
        }
        
        err = session.Save(r, w)
        if err != nil {
            http.Error(w, "Failed to save session", http.StatusInternalServerError)
            return
        }
        
        // Return success
        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]bool{"success": true})
    }
}

// Logout clears the session
func Logout(store *sessions.CookieStore) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        session, _ := store.Get(r, "k8s-session")
        session.Values["authenticated"] = false
        session.Options.MaxAge = -1 // Delete the cookie
        
        err := session.Save(r, w)
        if err != nil {
            http.Error(w, "Failed to save session", http.StatusInternalServerError)
            return
        }
        
        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]bool{"success": true})
    }
}

// CheckAuth verifies if the user is authenticated
func CheckAuth(store *sessions.CookieStore) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        session, _ := store.Get(r, "k8s-session")
        
        // Check if user is authenticated
        if auth, ok := session.Values["authenticated"].(bool); !ok || !auth {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }
        
        w.WriteHeader(http.StatusOK)
        json.NewEncoder(w).Encode(map[string]bool{"authenticated": true})
    }
}

// AuthMiddleware protects routes requiring authentication
func AuthMiddleware(store *sessions.CookieStore) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            session, err := store.Get(r, "k8s-session")
            if err != nil {
                http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
                return
            }
            
            // Check if user is authenticated
            auth, ok := session.Values["authenticated"].(bool)
            if !ok || !auth {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }
            
            // Continue to the protected handler
            next.ServeHTTP(w, r)
        })
    }
}