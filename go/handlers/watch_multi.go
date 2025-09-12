package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/sessions"
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

// WatchAll streams multiple Kubernetes resource events via SSE
func WatchAll(store *sessions.CookieStore) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        client, err := getK8sClient(r, store)
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

        type starter struct {
            kind     string
            listFn   func() (string, []interface{}, error)          // returns resourceVersion + objects
            watchFn  func(rv string) (watch.Interface, error)
            enabled  bool
        }

        resources := []starter{
            {
                kind: "Pod",
                listFn: func() (string, []interface{}, error) {
                    l, err := client.CoreV1().Pods("").List(r.Context(), metav1.ListOptions{})
                    if err != nil { return "", nil, err }
                    arr := make([]interface{}, 0, len(l.Items))
                    for i := range l.Items { arr = append(arr, &l.Items[i]) }
                    return l.ResourceVersion, arr, nil
                },
                watchFn: func(rv string) (watch.Interface, error) {
                    return client.CoreV1().Pods("").Watch(r.Context(), metav1.ListOptions{ResourceVersion: rv, Watch: true})
                },
                enabled: true,
            },
            {
                kind: "Service",
                listFn: func() (string, []interface{}, error) {
                    l, err := client.CoreV1().Services("").List(r.Context(), metav1.ListOptions{})
                    if err != nil { return "", nil, err }
                    arr := make([]interface{}, 0, len(l.Items))
                    for i := range l.Items { arr = append(arr, &l.Items[i]) }
                    return l.ResourceVersion, arr, nil
                },
                watchFn: func(rv string) (watch.Interface, error) {
                    return client.CoreV1().Services("").Watch(r.Context(), metav1.ListOptions{ResourceVersion: rv, Watch: true})
                },
                enabled: true,
            },
            {
                kind: "Deployment",
                listFn: func() (string, []interface{}, error) {
                    l, err := client.AppsV1().Deployments("").List(r.Context(), metav1.ListOptions{})
                    if err != nil { return "", nil, err }
                    arr := make([]interface{}, 0, len(l.Items))
                    for i := range l.Items { arr = append(arr, &l.Items[i]) }
                    return l.ResourceVersion, arr, nil
                },
                watchFn: func(rv string) (watch.Interface, error) {
                    return client.AppsV1().Deployments("").Watch(r.Context(), metav1.ListOptions{ResourceVersion: rv, Watch: true})
                },
                enabled: true,
            },
            {
                kind: "ReplicaSet",
                listFn: func() (string, []interface{}, error) {
                    l, err := client.AppsV1().ReplicaSets("").List(r.Context(), metav1.ListOptions{})
                    if err != nil { return "", nil, err }
                    arr := make([]interface{}, 0, len(l.Items))
                    for i := range l.Items { arr = append(arr, &l.Items[i]) }
                    return l.ResourceVersion, arr, nil
                },
                watchFn: func(rv string) (watch.Interface, error) {
                    return client.AppsV1().ReplicaSets("").Watch(r.Context(), metav1.ListOptions{ResourceVersion: rv, Watch: true})
                },
                enabled: true,
            },
            {
                kind: "StatefulSet",
                listFn: func() (string, []interface{}, error) {
                    l, err := client.AppsV1().StatefulSets("").List(r.Context(), metav1.ListOptions{})
                    if err != nil { return "", nil, err }
                    arr := make([]interface{}, 0, len(l.Items))
                    for i := range l.Items { arr = append(arr, &l.Items[i]) }
                    return l.ResourceVersion, arr, nil
                },
                watchFn: func(rv string) (watch.Interface, error) {
                    return client.AppsV1().StatefulSets("").Watch(r.Context(), metav1.ListOptions{ResourceVersion: rv, Watch: true})
                },
                enabled: true,
            },
            {
                kind: "DaemonSet",
                listFn: func() (string, []interface{}, error) {
                    l, err := client.AppsV1().DaemonSets("").List(r.Context(), metav1.ListOptions{})
                    if err != nil { return "", nil, err }
                    arr := make([]interface{}, 0, len(l.Items))
                    for i := range l.Items { arr = append(arr, &l.Items[i]) }
                    return l.ResourceVersion, arr, nil
                },
                watchFn: func(rv string) (watch.Interface, error) {
                    return client.AppsV1().DaemonSets("").Watch(r.Context(), metav1.ListOptions{ResourceVersion: rv, Watch: true})
                },
                enabled: true,
            },
            {
                kind: "Job",
                listFn: func() (string, []interface{}, error) {
                    l, err := client.BatchV1().Jobs("").List(r.Context(), metav1.ListOptions{})
                    if err != nil { return "", nil, err }
                    arr := make([]interface{}, 0, len(l.Items))
                    for i := range l.Items { arr = append(arr, &l.Items[i]) }
                    return l.ResourceVersion, arr, nil
                },
                watchFn: func(rv string) (watch.Interface, error) {
                    return client.BatchV1().Jobs("").Watch(r.Context(), metav1.ListOptions{ResourceVersion: rv, Watch: true})
                },
                enabled: true,
            },
            {
                kind: "CronJob",
                listFn: func() (string, []interface{}, error) {
                    l, err := client.BatchV1().CronJobs("").List(r.Context(), metav1.ListOptions{})
                    if err != nil { return "", nil, err }
                    arr := make([]interface{}, 0, len(l.Items))
                    for i := range l.Items { arr = append(arr, &l.Items[i]) }
                    return l.ResourceVersion, arr, nil
                },
                watchFn: func(rv string) (watch.Interface, error) {
                    return client.BatchV1().CronJobs("").Watch(r.Context(), metav1.ListOptions{ResourceVersion: rv, Watch: true})
                },
                enabled: true,
            },
            {
                kind: "Node",
                listFn: func() (string, []interface{}, error) {
                    l, err := client.CoreV1().Nodes().List(r.Context(), metav1.ListOptions{})
                    if err != nil { return "", nil, err }
                    arr := make([]interface{}, 0, len(l.Items))
                    for i := range l.Items { arr = append(arr, &l.Items[i]) }
                    return l.ResourceVersion, arr, nil
                },
                watchFn: func(rv string) (watch.Interface, error) {
                    return client.CoreV1().Nodes().Watch(r.Context(), metav1.ListOptions{ResourceVersion: rv, Watch: true})
                },
                enabled: true,
            },
            {
                kind: "Namespace",
                listFn: func() (string, []interface{}, error) {
                    l, err := client.CoreV1().Namespaces().List(r.Context(), metav1.ListOptions{})
                    if err != nil { return "", nil, err }
                    arr := make([]interface{}, 0, len(l.Items))
                    for i := range l.Items { arr = append(arr, &l.Items[i]) }
                    return l.ResourceVersion, arr, nil
                },
                watchFn: func(rv string) (watch.Interface, error) {
                    return client.CoreV1().Namespaces().Watch(r.Context(), metav1.ListOptions{ResourceVersion: rv, Watch: true})
                },
                enabled: true,
            },
        }

        type watchBundle struct {
            kind  string
            w     watch.Interface
        }

        eventCh := make(chan MultiEvent, 256)
        var wg sync.WaitGroup

        // Initial SYNC
        for _, res := range resources {
            if !res.enabled { continue }
            rv, objs, err := res.listFn()
            if err != nil {
                eventCh <- MultiEvent{Kind: res.kind, Type: "ERROR", Err: err.Error()}
                continue
            }
            for _, o := range objs {
                eventCh <- MultiEvent{Kind: res.kind, Type: "SYNC", Object: o}
            }

            wInt, err := res.watchFn(rv)
            if err != nil {
                eventCh <- MultiEvent{Kind: res.kind, Type: "ERROR", Err: err.Error()}
                continue
            }

            wg.Add(1)
            go func(kind string, wi watch.Interface) {
                defer wg.Done()
                defer wi.Stop()
                for ev := range wi.ResultChan() {
                    eventCh <- MultiEvent{
                        Kind:   kind,
                        Type:   string(ev.Type),
                        Object: ev.Object,
                    }
                }
                eventCh <- MultiEvent{Kind: kind, Type: "END"}
            }(res.kind, wInt)
        }

        heartbeat := time.NewTicker(25 * time.Second)
        defer heartbeat.Stop()

        go func() {
            wg.Wait()
            close(eventCh)
        }()

        for {
            select {
            case evt, ok := <-eventCh:
                if !ok {
                    fmt.Fprintf(w, "event: multi\ndata: {\"type\":\"STREAM_END\"}\n\n")
                    flusher.Flush()
                    return
                }
                b, _ := json.Marshal(evt)
                fmt.Fprintf(w, "event: multi\ndata: %s\n\n", b)
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