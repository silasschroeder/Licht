package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/sessions"
	"github.com/silasschroeder/licht/go/config"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
)

// MultiEvent represents a generic resource watch event
type MultiEvent struct {
	Kind   string      `json:"kind"`
	Type   string      `json:"type"` // SYNC, ADDED, MODIFIED, DELETED, ERROR, END
	Object interface{} `json:"object,omitempty"`
	Err    string      `json:"err,omitempty"`
}

// WatchAll streams changes for multiple resources
func WatchAll(store sessions.Store, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		client, err := getK8sClient(r, store, cfg)
		if err != nil {
			http.Error(w, fmt.Sprintf("auth: %v", err), http.StatusUnauthorized)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		// Helpful with proxies (dev)
		w.Header().Set("X-Accel-Buffering", "no")
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}

		var mu sync.Mutex
		write := func(ev MultiEvent) {
			mu.Lock()
			defer mu.Unlock()
			b, _ := json.Marshal(ev)
			fmt.Fprint(w, "event: multi\n")
			fmt.Fprint(w, "data: ")
			w.Write(b)
			fmt.Fprint(w, "\n\n")
			flusher.Flush()
		}

		// Heartbeat (prevents idle timeouts)
		tick := time.NewTicker(20 * time.Second)
		defer tick.Stop()
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case <-tick.C:
					mu.Lock()
					fmt.Fprintf(w, ": ping %d\n\n", time.Now().Unix())
					flusher.Flush()
					mu.Unlock()
				}
			}
		}()

		type rvs struct {
			Pods, Services, Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, CronJobs, Nodes, Namespaces string
		}
		var rv rvs

		// Initial SYNC + capture resourceVersion
		if list, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{}); err == nil {
			rv.Pods = list.ResourceVersion
			for i := range list.Items {
				write(MultiEvent{Kind: "Pod", Type: "SYNC", Object: list.Items[i]})
			}
		}
		if list, err := client.CoreV1().Services("").List(ctx, metav1.ListOptions{}); err == nil {
			rv.Services = list.ResourceVersion
			for i := range list.Items {
				write(MultiEvent{Kind: "Service", Type: "SYNC", Object: list.Items[i]})
			}
		}
		if list, err := client.AppsV1().Deployments("").List(ctx, metav1.ListOptions{}); err == nil {
			rv.Deployments = list.ResourceVersion
			for i := range list.Items {
				write(MultiEvent{Kind: "Deployment", Type: "SYNC", Object: list.Items[i]})
			}
		}
		if list, err := client.AppsV1().ReplicaSets("").List(ctx, metav1.ListOptions{}); err == nil {
			rv.ReplicaSets = list.ResourceVersion
			for i := range list.Items {
				write(MultiEvent{Kind: "ReplicaSet", Type: "SYNC", Object: list.Items[i]})
			}
		}
		if list, err := client.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{}); err == nil {
			rv.StatefulSets = list.ResourceVersion
			for i := range list.Items {
				write(MultiEvent{Kind: "StatefulSet", Type: "SYNC", Object: list.Items[i]})
			}
		}
		if list, err := client.AppsV1().DaemonSets("").List(ctx, metav1.ListOptions{}); err == nil {
			rv.DaemonSets = list.ResourceVersion
			for i := range list.Items {
				write(MultiEvent{Kind: "DaemonSet", Type: "SYNC", Object: list.Items[i]})
			}
		}
		if list, err := client.BatchV1().Jobs("").List(ctx, metav1.ListOptions{}); err == nil {
			rv.Jobs = list.ResourceVersion
			for i := range list.Items {
				write(MultiEvent{Kind: "Job", Type: "SYNC", Object: list.Items[i]})
			}
		}
		if list, err := client.BatchV1().CronJobs("").List(ctx, metav1.ListOptions{}); err == nil {
			rv.CronJobs = list.ResourceVersion
			for i := range list.Items {
				write(MultiEvent{Kind: "CronJob", Type: "SYNC", Object: list.Items[i]})
			}
		}
		if list, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{}); err == nil {
			rv.Nodes = list.ResourceVersion
			for i := range list.Items {
				write(MultiEvent{Kind: "Node", Type: "SYNC", Object: list.Items[i]})
			}
		}
		if list, err := client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{}); err == nil {
			rv.Namespaces = list.ResourceVersion
			for i := range list.Items {
				write(MultiEvent{Kind: "Namespace", Type: "SYNC", Object: list.Items[i]})
			}
		}

		type stopper interface{ Stop() }
		var stops []stopper
		stopAll := func() {
			for _, s := range stops {
				if s != nil {
					s.Stop()
				}
			}
		}

		startWatch := func(kind string, start func(metav1.ListOptions) (watch.Interface, error), resourceVersion string) {
			opts := metav1.ListOptions{
				Watch:               true,
				ResourceVersion:     resourceVersion,
				AllowWatchBookmarks: true,
			}
			w, err := start(opts)
			if err != nil {
				write(MultiEvent{Kind: kind, Type: "ERROR", Err: err.Error()})
				return
			}
			stops = append(stops, w)

			go func() {
				for {
					select {
					case <-ctx.Done():
						return
					case ev, ok := <-w.ResultChan():
						if !ok {
							write(MultiEvent{Kind: kind, Type: "END"})
							return
						}
						var t string
						switch ev.Type {
						case watch.Added:
							t = "ADDED"
						case watch.Modified:
							t = "MODIFIED"
						case watch.Deleted:
							t = "DELETED"
						case watch.Bookmark:
							continue
						default:
							t = string(ev.Type)
						}
						write(MultiEvent{Kind: kind, Type: t, Object: ev.Object})
					}
				}
			}()
		}

		// Start watches
		startWatch("Pod", func(o metav1.ListOptions) (watch.Interface, error) {
			return client.CoreV1().Pods("").Watch(ctx, o)
		}, rv.Pods)
		startWatch("Service", func(o metav1.ListOptions) (watch.Interface, error) {
			return client.CoreV1().Services("").Watch(ctx, o)
		}, rv.Services)
		startWatch("Deployment", func(o metav1.ListOptions) (watch.Interface, error) {
			return client.AppsV1().Deployments("").Watch(ctx, o)
		}, rv.Deployments)
		startWatch("ReplicaSet", func(o metav1.ListOptions) (watch.Interface, error) {
			return client.AppsV1().ReplicaSets("").Watch(ctx, o)
		}, rv.ReplicaSets)
		startWatch("StatefulSet", func(o metav1.ListOptions) (watch.Interface, error) {
			return client.AppsV1().StatefulSets("").Watch(ctx, o)
		}, rv.StatefulSets)
		startWatch("DaemonSet", func(o metav1.ListOptions) (watch.Interface, error) {
			return client.AppsV1().DaemonSets("").Watch(ctx, o)
		}, rv.DaemonSets)
		startWatch("Job", func(o metav1.ListOptions) (watch.Interface, error) {
			return client.BatchV1().Jobs("").Watch(ctx, o)
		}, rv.Jobs)
		startWatch("CronJob", func(o metav1.ListOptions) (watch.Interface, error) {
			return client.BatchV1().CronJobs("").Watch(ctx, o)
		}, rv.CronJobs)
		startWatch("Node", func(o metav1.ListOptions) (watch.Interface, error) {
			return client.CoreV1().Nodes().Watch(ctx, o)
		}, rv.Nodes)
		startWatch("Namespace", func(o metav1.ListOptions) (watch.Interface, error) {
			return client.CoreV1().Namespaces().Watch(ctx, o)
		}, rv.Namespaces)

		<-ctx.Done()
		stopAll()
	}
}