package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/sessions"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// getK8sClient creates a Kubernetes client from session credentials
func getK8sClient(r *http.Request, store *sessions.CookieStore) (*kubernetes.Clientset, error) {
	session, _ := store.Get(r, "k8s-session")

	serverURL, ok := session.Values["server_url"].(string)
	if !ok {
		return nil, fmt.Errorf("server URL not found in session")
	}

	authMethod, ok := session.Values["auth_method"].(string)
	if !ok {
		return nil, fmt.Errorf("auth method not found in session")
	}

	var cfg *rest.Config

	switch authMethod {
	case "certificate":
		clientCert, ok := session.Values["client_cert"].(string)
		if !ok {
			return nil, fmt.Errorf("client certificate not found in session")
		}
		clientKey, ok := session.Values["client_key"].(string)
		if !ok {
			return nil, fmt.Errorf("client key not found in session")
		}
		certData, err := maybeDecodeBase64OrPEM(clientCert)
		if err != nil {
			return nil, fmt.Errorf("invalid client certificate format")
		}
		keyData, err := maybeDecodeBase64OrPEM(clientKey)
		if err != nil {
			return nil, fmt.Errorf("invalid client key format")
		}
		cfg = &rest.Config{
			Host: serverURL,
			TLSClientConfig: rest.TLSClientConfig{
				Insecure: true,
				CertData: certData,
				KeyData:  keyData,
			},
		}
	case "token":
		token, ok := session.Values["token"].(string)
		if !ok {
			return nil, fmt.Errorf("token not found in session")
		}
		cfg = &rest.Config{
			Host:        serverURL,
			BearerToken: strings.TrimSpace(token),
			TLSClientConfig: rest.TLSClientConfig{
				Insecure: true,
			},
		}
	default:
		return nil, fmt.Errorf("unsupported auth method")
	}

	return kubernetes.NewForConfig(cfg)
}

// GetPods returns all pods
func GetPods(store *sessions.CookieStore) http.HandlerFunc {
	type PodInfo struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
		Ready     string `json:"ready"`
		Status    string `json:"status"`
		Restart   int32  `json:"restart"`
		Age       string `json:"age"`
		IP        string `json:"ip"`
		Node      string `json:"node"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		pods, err := client.CoreV1().Pods("").List(r.Context(), metav1.ListOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := make([]PodInfo, 0, len(pods.Items))
		for _, p := range pods.Items {
			ready := fmt.Sprintf("%d/%d", countReadyContainers(p.Status.ContainerStatuses), len(p.Spec.Containers))
			restarts := int32(0)
			for _, cs := range p.Status.ContainerStatuses {
				restarts += cs.RestartCount
			}
			out = append(out, PodInfo{
				Name:      p.Name,
				Namespace: p.Namespace,
				Ready:     ready,
				Status:    string(p.Status.Phase),
				Restart:   restarts,
				Age:       calculateAge(p.CreationTimestamp.Time),
				IP:        p.Status.PodIP,
				Node:      p.Spec.NodeName,
			})
		}
		writeJSONList(w, out)
	}
}

// GetNodes returns all nodes
func GetNodes(store *sessions.CookieStore) http.HandlerFunc {
	type NodeInfo struct {
		Name   string `json:"name"`
		Status string `json:"status"`
		Age    string `json:"age"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		nodes, err := client.CoreV1().Nodes().List(r.Context(), metav1.ListOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := []NodeInfo{}
		for _, n := range nodes.Items {
			status := "Unknown"
			for _, c := range n.Status.Conditions {
				if c.Type == v1.NodeReady {
					if c.Status == v1.ConditionTrue {
						status = "Ready"
					} else {
						status = "NotReady"
					}
					break
				}
			}
			out = append(out, NodeInfo{
				Name:   n.Name,
				Status: status,
				Age:    calculateAge(n.CreationTimestamp.Time),
			})
		}
		writeJSONList(w, out)
	}
}

// GetNamespaces returns all namespaces
func GetNamespaces(store *sessions.CookieStore) http.HandlerFunc {
	type NsInfo struct {
		Name string `json:"name"`
		Age  string `json:"age"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		namespaces, err := client.CoreV1().Namespaces().List(r.Context(), metav1.ListOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := []NsInfo{}
		for _, ns := range namespaces.Items {
			out = append(out, NsInfo{Name: ns.Name, Age: calculateAge(ns.CreationTimestamp.Time)})
		}
		writeJSONList(w, out)
	}
}

// GetServices returns all services
func GetServices(store *sessions.CookieStore) http.HandlerFunc {
	type SvcInfo struct {
		Name        string   `json:"name"`
		Namespace   string   `json:"namespace"`
		Type        string   `json:"type"`
		ClusterIP   string   `json:"clusterIP"`
		ExternalIPs []string `json:"externalIPs"`
		Ports       string   `json:"ports"`
		Age         string   `json:"age"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		list, err := client.CoreV1().Services("").List(r.Context(), metav1.ListOptions{})
		if err != nil {
			log.Printf("[SERVICES] list error: %v", err)
			http.Error(w, "services list failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		out := []SvcInfo{}
		for _, svc := range list.Items {
			ports := []string{}
			for _, p := range svc.Spec.Ports {
				if p.NodePort > 0 {
					ports = append(ports, fmt.Sprintf("%d:%d/%s", p.Port, p.NodePort, strings.ToLower(string(p.Protocol))))
				} else {
					ports = append(ports, fmt.Sprintf("%d/%s", p.Port, strings.ToLower(string(p.Protocol))))
				}
			}
			out = append(out, SvcInfo{
				Name:        svc.Name,
				Namespace:   svc.Namespace,
				Type:        string(svc.Spec.Type),
				ClusterIP:   svc.Spec.ClusterIP,
				ExternalIPs: getExternalIPs(svc),
				Ports:       strings.Join(ports, ","),
				Age:         calculateAge(svc.CreationTimestamp.Time),
			})
		}
		writeJSONList(w, out)
	}
}

// GetDeployments returns all deployments
func GetDeployments(store *sessions.CookieStore) http.HandlerFunc {
	type DeployInfo struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
		Ready     string `json:"ready"`
		UpToDate  int32  `json:"upToDate"`
		Available int32  `json:"available"`
		Age       string `json:"age"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		deps, err := client.AppsV1().Deployments("").List(r.Context(), metav1.ListOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := []DeployInfo{}
		for _, d := range deps.Items {
			var desired int32
			if d.Spec.Replicas != nil {
				desired = *d.Spec.Replicas
			}
			out = append(out, DeployInfo{
				Name:      d.Name,
				Namespace: d.Namespace,
				Ready:     fmt.Sprintf("%d/%d", d.Status.ReadyReplicas, desired),
				UpToDate:  d.Status.UpdatedReplicas,
				Available: d.Status.AvailableReplicas,
				Age:       calculateAge(d.CreationTimestamp.Time),
			})
		}
		writeJSONList(w, out)
	}
}

// GetReplicaSets returns all replicasets
func GetReplicaSets(store *sessions.CookieStore) http.HandlerFunc {
	type RSInfo struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
		Desired   int32  `json:"desired"`
		Current   int32  `json:"current"`
		Ready     int32  `json:"ready"`
		Age       string `json:"age"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		rsList, err := client.AppsV1().ReplicaSets("").List(r.Context(), metav1.ListOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := []RSInfo{}
		for _, rs := range rsList.Items {
			var desired int32
			if rs.Spec.Replicas != nil {
				desired = *rs.Spec.Replicas
			}
			out = append(out, RSInfo{
				Name:      rs.Name,
				Namespace: rs.Namespace,
				Desired:   desired,
				Current:   rs.Status.Replicas,
				Ready:     rs.Status.ReadyReplicas,
				Age:       calculateAge(rs.CreationTimestamp.Time),
			})
		}
		writeJSONList(w, out)
	}
}

// GetStatefulSets returns all statefulsets
func GetStatefulSets(store *sessions.CookieStore) http.HandlerFunc {
	type SSInfo struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
		Ready     string `json:"ready"`
		Age       string `json:"age"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		stsList, err := client.AppsV1().StatefulSets("").List(r.Context(), metav1.ListOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := []SSInfo{}
		for _, sts := range stsList.Items {
			var specReplicas int32
			if sts.Spec.Replicas != nil {
				specReplicas = *sts.Spec.Replicas
			}
			out = append(out, SSInfo{
				Name:      sts.Name,
				Namespace: sts.Namespace,
				Ready:     fmt.Sprintf("%d/%d", sts.Status.ReadyReplicas, specReplicas),
				Age:       calculateAge(sts.CreationTimestamp.Time),
			})
		}
		writeJSONList(w, out)
	}
}

// GetDaemonSets returns all daemonsets
func GetDaemonSets(store *sessions.CookieStore) http.HandlerFunc {
	type DSInfo struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
		Desired   int32  `json:"desired"`
		Current   int32  `json:"current"`
		Ready     int32  `json:"ready"`
		Age       string `json:"age"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		dsList, err := client.AppsV1().DaemonSets("").List(r.Context(), metav1.ListOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := []DSInfo{}
		for _, ds := range dsList.Items {
			out = append(out, DSInfo{
				Name:      ds.Name,
				Namespace: ds.Namespace,
				Desired:   ds.Status.DesiredNumberScheduled,
				Current:   ds.Status.CurrentNumberScheduled,
				Ready:     ds.Status.NumberReady,
				Age:       calculateAge(ds.CreationTimestamp.Time),
			})
		}
		writeJSONList(w, out)
	}
}

// GetJobs returns all jobs
func GetJobs(store *sessions.CookieStore) http.HandlerFunc {
	type JobInfo struct {
		Name        string `json:"name"`
		Namespace   string `json:"namespace"`
		Completions string `json:"completions"`
		Duration    string `json:"duration"`
		Age         string `json:"age"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		jobs, err := client.BatchV1().Jobs("").List(r.Context(), metav1.ListOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := []JobInfo{}
		for _, job := range jobs.Items {
			var desired int32
			if job.Spec.Completions != nil {
				desired = *job.Spec.Completions
			}
			completions := fmt.Sprintf("%d/%d", job.Status.Succeeded, desired)
			duration := "-"
			if job.Status.StartTime != nil && job.Status.CompletionTime != nil {
				d := job.Status.CompletionTime.Time.Sub(job.Status.StartTime.Time)
				duration = fmt.Sprintf("%ds", int(d.Seconds()))
			}
			out = append(out, JobInfo{
				Name:        job.Name,
				Namespace:   job.Namespace,
				Completions: completions,
				Duration:    duration,
				Age:         calculateAge(job.CreationTimestamp.Time),
			})
		}
		writeJSONList(w, out)
	}
}

// GetCronJobs returns all cronjobs
func GetCronJobs(store *sessions.CookieStore) http.HandlerFunc {
	type CJInfo struct {
		Name         string `json:"name"`
		Namespace    string `json:"namespace"`
		Schedule     string `json:"schedule"`
		Suspend      bool   `json:"suspend"`
		Active       int    `json:"active"`
		LastSchedule string `json:"lastSchedule"`
		Age          string `json:"age"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		client, err := getK8sClient(r, store)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}

		cronjobs, err := client.BatchV1().CronJobs("").List(r.Context(), metav1.ListOptions{})
		if err != nil {
			// fallback for older clusters (batch/v1beta1) if v1 not available
			cjBeta, betaErr := client.BatchV1beta1().CronJobs("").List(r.Context(), metav1.ListOptions{})
			if betaErr != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			out := []CJInfo{}
			for _, cj := range cjBeta.Items {
				last := "<none>"
				if cj.Status.LastScheduleTime != nil {
					last = calculateAge(cj.Status.LastScheduleTime.Time)
				}
				suspend := false
				if cj.Spec.Suspend != nil {
					suspend = *cj.Spec.Suspend
				}
				out = append(out, CJInfo{
					Name:         cj.Name,
					Namespace:    cj.Namespace,
					Schedule:     cj.Spec.Schedule,
					Suspend:      suspend,
					Active:       len(cj.Status.Active),
					LastSchedule: last,
					Age:          calculateAge(cj.CreationTimestamp.Time),
				})
			}
			writeJSONList(w, out)
			return
		}

		out := []CJInfo{}
		for _, cj := range cronjobs.Items {
			last := "<none>"
			if cj.Status.LastScheduleTime != nil {
				last = calculateAge(cj.Status.LastScheduleTime.Time)
			}
			suspend := false
			if cj.Spec.Suspend != nil {
				suspend = *cj.Spec.Suspend
			}
			out = append(out, CJInfo{
				Name:         cj.Name,
				Namespace:    cj.Namespace,
				Schedule:     cj.Spec.Schedule,
				Suspend:      suspend,
				Active:       len(cj.Status.Active),
				LastSchedule: last,
				Age:          calculateAge(cj.CreationTimestamp.Time),
			})
		}
		writeJSONList(w, out)
	}
}

// helpers
func countReadyContainers(statuses []v1.ContainerStatus) int {
	n := 0
	for _, cs := range statuses {
		if cs.Ready {
			n++
		}
	}
	return n
}

func getExternalIPs(svc v1.Service) []string {
	if len(svc.Status.LoadBalancer.Ingress) > 0 {
		ips := []string{}
		for _, ing := range svc.Status.LoadBalancer.Ingress {
			if ing.IP != "" {
				ips = append(ips, ing.IP)
			} else if ing.Hostname != "" {
				ips = append(ips, ing.Hostname)
			}
		}
		return ips
	}
	return svc.Spec.ExternalIPs
}

func calculateAge(creation time.Time) string {
	diff := time.Since(creation)
	if diff < time.Minute {
		return fmt.Sprintf("%ds", int(diff.Seconds()))
	}
	if diff < time.Hour {
		return fmt.Sprintf("%dm", int(diff.Minutes()))
	}
	if diff < 24*time.Hour {
		return fmt.Sprintf("%dh", int(diff.Hours()))
	}
	if diff < 30*24*time.Hour {
		return fmt.Sprintf("%dd", int(diff.Hours()/24))
	}
	if diff < 365*24*time.Hour {
		return fmt.Sprintf("%dmo", int(diff.Hours()/(24*30)))
	}
	return fmt.Sprintf("%dy", int(diff.Hours()/(24*365)))
}

func writeJSONList(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}