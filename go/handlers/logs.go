package handlers

import (
	"bufio"
	"fmt"
	"net/http"
	"strings"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// StreamPodLogs follows a pod container's logs and streams them as SSE.
// GET /api/pods/logs?namespace=<ns>&name=<pod>&container=<name>
// If container is omitted, the pod's first container is used.
func StreamPodLogs(client kubernetes.Interface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		q := r.URL.Query()
		ns := strings.TrimSpace(q.Get("namespace"))
		name := strings.TrimSpace(q.Get("name"))
		container := strings.TrimSpace(q.Get("container"))
		if ns == "" || name == "" {
			http.Error(w, "missing namespace or name", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}

		tailLines := int64(500)
		req := client.CoreV1().Pods(ns).GetLogs(name, &v1.PodLogOptions{
			Container: container, // "" = first container, which is what we want
			Follow:    true,
			TailLines: &tailLines,
		})

		stream, err := req.Stream(ctx)
		if err != nil {
			// Surface the reason (e.g. RBAC forbidden) as an SSE error event.
			fmt.Fprintf(w, "event: error\ndata: %s\n\n", jsonString(err.Error()))
			flusher.Flush()
			return
		}
		defer stream.Close()

		// Each log line becomes one SSE "log" event. The stream ends when the
		// context is cancelled (client disconnect) or the pod stops.
		scanner := bufio.NewScanner(stream)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			if ctx.Err() != nil {
				return
			}
			fmt.Fprintf(w, "event: log\ndata: %s\n\n", jsonString(scanner.Text()))
			flusher.Flush()
		}
	}
}

// ListPodContainers returns the container names of a pod, for the log viewer's
// container selector. GET /api/pods/containers?namespace=<ns>&name=<pod>
func ListPodContainers(client kubernetes.Interface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		ns := strings.TrimSpace(q.Get("namespace"))
		name := strings.TrimSpace(q.Get("name"))
		if ns == "" || name == "" {
			writeError(w, http.StatusBadRequest, "missing namespace or name")
			return
		}
		pod, err := client.CoreV1().Pods(ns).Get(r.Context(), name, metav1.GetOptions{})
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		names := make([]string, 0, len(pod.Spec.Containers))
		for _, c := range pod.Spec.Containers {
			names = append(names, c.Name)
		}
		writeJSONList(w, names)
	}
}

// jsonString escapes a string for safe embedding in an SSE data line.
func jsonString(s string) string {
	// Replace the only characters that break SSE framing or JSON string safety.
	// SSE data must not contain raw newlines; the scanner already strips them,
	// but guard anyway. Quote via a minimal escape of backslash and quote.
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.ReplaceAll(s, "\r", " ")
	return "\"" + s + "\""
}
