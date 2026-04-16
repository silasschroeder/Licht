package handlers

import (
	"context"
	"net/http"

	"github.com/gorilla/sessions"
	"github.com/silasschroeder/licht/go/config"
	"k8s.io/client-go/kubernetes"
)

// ResourceFetcher defines how to fetch a specific resource type
type ResourceFetcher func(ctx context.Context, client kubernetes.Interface) (interface{}, error)

// MakeResourceHandler creates a standardized HTTP handler for any K8s resource
func MakeResourceHandler(store sessions.Store, cfg *config.Config, fetcher ResourceFetcher) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get K8s client from session
		client, err := getK8sClient(r, store, cfg)
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}

		// Fetch resources
		data, err := fetcher(r.Context(), client)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Return JSON
		writeJSONList(w, data)
	}
}
