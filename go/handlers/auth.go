package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

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

// helper: write JSON consistently (success and errors)
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"message": msg})
}

// Login handles authentication and stores credentials in session
func Login(store sessions.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid request")
			return
		}

		// Create Kubernetes config based on auth method
		var k8sConfig *rest.Config

		switch req.AuthMethod {
		case "certificate":
			clientCertData, err := maybeDecodeBase64OrPEM(req.ClientCert)
			if err != nil {
				writeError(w, http.StatusBadRequest, "Invalid client certificate format")
				return
			}
			clientKeyData, err := maybeDecodeBase64OrPEM(req.ClientKey)
			if err != nil {
				writeError(w, http.StatusBadRequest, "Invalid client key format")
				return
			}

			k8sConfig = &rest.Config{
				Host: req.ServerURL,
				TLSClientConfig: rest.TLSClientConfig{
					Insecure: true, // TODO: Make configurable
					CertData: clientCertData,
					KeyData:  clientKeyData,
				},
			}

		case "token":
			k8sConfig = &rest.Config{
				Host:        req.ServerURL,
				BearerToken: strings.TrimSpace(req.Token),
				TLSClientConfig: rest.TLSClientConfig{
					Insecure: true, // TODO: Make configurable
				},
			}

		default:
			writeError(w, http.StatusBadRequest, "Unsupported authentication method")
			return
		}

		// Test the connection to verify credentials
		clientset, err := kubernetes.NewForConfig(k8sConfig)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Failed to create Kubernetes client: "+err.Error())
			return
		}

		// Try a simple API call to verify credentials
		if _, err = clientset.CoreV1().Namespaces().List(r.Context(), metav1.ListOptions{}); err != nil {
			writeError(w, http.StatusUnauthorized, "Failed to connect to Kubernetes: "+err.Error())
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

		if err := session.Save(r, w); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to save session")
			return
		}

		// Return success
		writeJSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

// Logout clears the session
func Logout(store sessions.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, "k8s-session")
		session.Values["authenticated"] = false
		session.Options.MaxAge = -1 // Delete the cookie

		if err := session.Save(r, w); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to save session")
			return
		}

		writeJSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

// CheckAuth verifies if the user is authenticated
func CheckAuth(store sessions.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, "k8s-session")

		if auth, ok := session.Values["authenticated"].(bool); !ok || !auth {
			// debug
			// log.Printf("CheckAuth 401: no session or not authenticated (values=%v)", session.Values)
			writeError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}

		writeJSON(w, http.StatusOK, map[string]bool{"authenticated": true})
	}
}

// AuthMiddleware protects routes requiring authentication
func AuthMiddleware(store sessions.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			session, err := store.Get(r, "k8s-session")
			if err != nil {
				writeError(w, http.StatusUnauthorized, "Unauthorized: "+err.Error())
				return
			}

			auth, ok := session.Values["authenticated"].(bool)
			if !ok || !auth {
				writeError(w, http.StatusUnauthorized, "Unauthorized")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}