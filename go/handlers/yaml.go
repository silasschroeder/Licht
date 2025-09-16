package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/sessions"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func GetYAML(store *sessions.CookieStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		q := r.URL.Query()
		kind := strings.TrimSpace(q.Get("kind"))
		name := strings.TrimSpace(q.Get("name"))
		ns := strings.TrimSpace(q.Get("namespace"))
		source := strings.TrimSpace(q.Get("source"))
		if source == "" {
			source = "live"
		}
		clean := true
		if v := q.Get("clean"); v != "" {
			if b, err := strconv.ParseBool(v); err == nil {
				clean = b
			}
		}
		mask := true
		if v := q.Get("mask"); v != "" {
			if b, err := strconv.ParseBool(v); err == nil {
				mask = b
			}
		}
		download := false
		if v := q.Get("download"); v != "" {
			if b, err := strconv.ParseBool(v); err == nil {
				download = b
			}
		}

		if kind == "" || name == "" {
			http.Error(w, "missing kind or name", http.StatusBadRequest)
			return
		}

		// Validate namespace requirement for namespaced kinds
		namespacedKinds := map[string]bool{
			"pod": true, "service": true, "deployment": true, "replicaset": true,
			"statefulset": true, "daemonset": true, "job": true, "cronjob": true,
			"configmap": true, "secret": true,
		}
		lk := strings.ToLower(kind)
		if namespacedKinds[lk] && ns == "" {
			http.Error(w, "namespace required for "+kind, http.StatusBadRequest)
			return
		}

		// Fetch the object (use request context)
		obj, err := getObjectYAMLMap(r.Context(), client, lk, ns, name)
		if err != nil {
			http.Error(w, "fetch failed: "+err.Error(), http.StatusNotFound)
			return
		}

		// last-applied source (if available)
		if source == "last-applied" {
			if metadata, ok := obj["metadata"].(map[string]interface{}); ok {
				if ann, ok := metadata["annotations"].(map[string]interface{}); ok {
					if lastraw, ok := ann["kubectl.kubernetes.io/last-applied-configuration"].(string); ok && lastraw != "" {
						yml, err := yaml.JSONToYAML([]byte(lastraw))
						if err == nil {
							writeYAML(w, yml, download, ns, kind, name)
							return
						}
					}
				}
			}
			// fallback to live if not found
		}

		if clean {
			cleanObjectMap(obj)
		}
		if lk == "secret" && mask {
			maskSecret(obj)
		}

		yml, err := yaml.Marshal(obj)
		if err != nil {
			http.Error(w, "marshal failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		writeYAML(w, yml, download, ns, kind, name)
	}
}

func writeYAML(w http.ResponseWriter, yml []byte, download bool, ns, kind, name string) {
	w.Header().Set("Content-Type", "application/x-yaml; charset=utf-8")
	if download {
		filename := name
		if ns != "" {
			filename = ns + "-" + name
		}
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s-%s.yaml", strings.ToLower(kind), filename))
	}
	_, _ = w.Write(yml)
}

func cleanObjectMap(m map[string]interface{}) {
	// remove status
	delete(m, "status")
	// prune metadata noise
	if meta, ok := m["metadata"].(map[string]interface{}); ok {
		delete(meta, "managedFields")
		delete(meta, "resourceVersion")
		delete(meta, "uid")
		delete(meta, "selfLink")
		delete(meta, "generation")
		delete(meta, "creationTimestamp")
		delete(meta, "ownerReferences") // keep if you want relations shown
		// keep labels/annotations/name/namespace
		m["metadata"] = meta
	}
}

func maskSecret(m map[string]interface{}) {
	if data, ok := m["data"].(map[string]interface{}); ok {
		for k := range data {
			data[k] = "<redacted>"
		}
		m["data"] = data
	}
	if sdata, ok := m["stringData"].(map[string]interface{}); ok {
		for k := range sdata {
			sdata[k] = "<redacted>"
		}
		m["stringData"] = sdata
	}
}

// getObjectYAMLMap fetches a resource and converts it into a map[string]interface{} for cleaning and YAML marshaling.
func getObjectYAMLMap(ctx context.Context, client *kubernetes.Clientset, kindLower, ns, name string) (map[string]interface{}, error) {
	var obj interface{}
	var err error

	switch kindLower {
	case "pod":
		obj, err = client.CoreV1().Pods(ns).Get(ctx, name, metav1.GetOptions{})
	case "service":
		obj, err = client.CoreV1().Services(ns).Get(ctx, name, metav1.GetOptions{})
	case "deployment":
		obj, err = client.AppsV1().Deployments(ns).Get(ctx, name, metav1.GetOptions{})
	case "replicaset":
		obj, err = client.AppsV1().ReplicaSets(ns).Get(ctx, name, metav1.GetOptions{})
	case "statefulset":
		obj, err = client.AppsV1().StatefulSets(ns).Get(ctx, name, metav1.GetOptions{})
	case "daemonset":
		obj, err = client.AppsV1().DaemonSets(ns).Get(ctx, name, metav1.GetOptions{})
	case "job":
		obj, err = client.BatchV1().Jobs(ns).Get(ctx, name, metav1.GetOptions{})
	case "cronjob":
		obj, err = client.BatchV1().CronJobs(ns).Get(ctx, name, metav1.GetOptions{})
	case "node":
		obj, err = client.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
	case "namespace":
		obj, err = client.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
	case "configmap":
		obj, err = client.CoreV1().ConfigMaps(ns).Get(ctx, name, metav1.GetOptions{})
	case "secret":
		obj, err = client.CoreV1().Secrets(ns).Get(ctx, name, metav1.GetOptions{})
	default:
		return nil, fmt.Errorf("unsupported kind %q", kindLower)
	}
	if err != nil {
		return nil, err
	}

	// to map
	b, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, err
	}

	// Ensure Kind present if roundtrip omitted it
	if _, ok := m["kind"]; !ok {
		m["kind"] = strings.Title(kindLower)
	}
	return m, nil
}