package handlers

import (
	"context"
	"net/http"

	"k8s.io/client-go/kubernetes"
)

// ResourceFetcher defines how to fetch a specific resource type
type ResourceFetcher func(ctx context.Context, client kubernetes.Interface) (interface{}, error)

// MakeResourceHandler creates a standardized HTTP handler for any K8s resource
func MakeResourceHandler(client kubernetes.Interface, fetcher ResourceFetcher) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, err := fetcher(r.Context(), client)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSONList(w, data)
	}
}
