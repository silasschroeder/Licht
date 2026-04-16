package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/sessions"
	"github.com/silasschroeder/licht/go/config"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// PodEvent is streamed to clients
type PodEvent struct {
	Type string `json:"type"` // SYNC, ADDED, MODIFIED, DELETED, ERROR, END
	Pod  *v1.Pod `json:"pod,omitempty"`
	Err  string `json:"err,omitempty"`
}

// WatchPods streams pod changes across all namespaces
func WatchPods(store sessions.Store, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store, cfg)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "stream unsupported", http.StatusInternalServerError)
			return
		}

		// Initial list (snapshot)
		list, err := client.CoreV1().Pods("").List(r.Context(), metav1.ListOptions{})
		if err != nil {
			writeSSEError(w, flusher, err)
			return
		}
		for _, p := range list.Items {
			ev := PodEvent{Type: "SYNC", Pod: &p}
			b, _ := json.Marshal(ev)
			fmt.Fprintf(w, "event: pod\ndata: %s\n\n", b)
		}
		flusher.Flush()

		// Start watch from latest resourceVersion
		watcher, err := client.CoreV1().Pods("").Watch(r.Context(), metav1.ListOptions{
			ResourceVersion: list.ResourceVersion,
			Watch:           true,
		})
		if err != nil {
			writeSSEError(w, flusher, err)
			return
		}
		defer watcher.Stop()

		heartbeat := time.NewTicker(25 * time.Second)
		defer heartbeat.Stop()

		for {
			select {
			case evt, ok := <-watcher.ResultChan():
				if !ok {
					fmt.Fprintf(w, "event: pod\ndata: {\"type\":\"END\"}\n\n")
					flusher.Flush()
					return
				}
				pod, _ := evt.Object.(*v1.Pod)
				payload := PodEvent{Type: string(evt.Type), Pod: pod}
				b, _ := json.Marshal(payload)
				fmt.Fprintf(w, "event: pod\ndata: %s\n\n", b)
				flusher.Flush()
			case <-heartbeat.C:
				fmt.Fprintf(w, ": ping\n\n")
				flusher.Flush()
			case <-r.Context().Done():
				return
			}
		}
	}
}

func writeSSEError(w http.ResponseWriter, f http.Flusher, err error) {
	fmt.Fprintf(w, "event: pod\ndata: {\"type\":\"ERROR\",\"err\":%q}\n\n", err.Error())
	f.Flush()
}