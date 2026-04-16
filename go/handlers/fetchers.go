package handlers

import (
	"context"
	"fmt"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// Type definitions for all resources
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

type NodeInfo struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Age    string `json:"age"`
}

type NsInfo struct {
	Name string `json:"name"`
	Age  string `json:"age"`
}

type SvcInfo struct {
	Name        string   `json:"name"`
	Namespace   string   `json:"namespace"`
	Type        string   `json:"type"`
	ClusterIP   string   `json:"clusterIP"`
	ExternalIPs []string `json:"externalIPs"`
	Ports       string   `json:"ports"`
	Age         string   `json:"age"`
}

type DeployInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Ready     string `json:"ready"`
	UpToDate  int32  `json:"upToDate"`
	Available int32  `json:"available"`
	Age       string `json:"age"`
}

type RSInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Desired   int32  `json:"desired"`
	Current   int32  `json:"current"`
	Ready     int32  `json:"ready"`
	Age       string `json:"age"`
}

type SSInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Ready     string `json:"ready"`
	Age       string `json:"age"`
}

type DSInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Desired   int32  `json:"desired"`
	Current   int32  `json:"current"`
	Ready     int32  `json:"ready"`
	UpToDate  int32  `json:"upToDate"`
	Available int32  `json:"available"`
	Age       string `json:"age"`
}

type JobInfo struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	Completions string `json:"completions"`
	Duration    string `json:"duration"`
	Age         string `json:"age"`
}

type CronJobInfo struct {
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	Schedule     string `json:"schedule"`
	Suspend      bool   `json:"suspend"`
	Active       int    `json:"active"`
	LastSchedule string `json:"lastSchedule"`
	Age          string `json:"age"`
}

// FetchPods retrieves all pods with transformed data
func FetchPods(ctx context.Context, client kubernetes.Interface) (interface{}, error) {
	pods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
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
	return out, nil
}

// FetchNodes retrieves all nodes
func FetchNodes(ctx context.Context, client kubernetes.Interface) (interface{}, error) {
	nodes, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
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
	return out, nil
}

// FetchNamespaces retrieves all namespaces
func FetchNamespaces(ctx context.Context, client kubernetes.Interface) (interface{}, error) {
	namespaces, err := client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	out := []NsInfo{}
	for _, ns := range namespaces.Items {
		out = append(out, NsInfo{
			Name: ns.Name,
			Age:  calculateAge(ns.CreationTimestamp.Time),
		})
	}
	return out, nil
}

// FetchServices retrieves all services
func FetchServices(ctx context.Context, client kubernetes.Interface) (interface{}, error) {
	services, err := client.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	out := []SvcInfo{}
	for _, s := range services.Items {
		ports := ""
		for i, p := range s.Spec.Ports {
			if i > 0 {
				ports += ", "
			}
			ports += fmt.Sprintf("%d/%s", p.Port, p.Protocol)
		}
		out = append(out, SvcInfo{
			Name:        s.Name,
			Namespace:   s.Namespace,
			Type:        string(s.Spec.Type),
			ClusterIP:   s.Spec.ClusterIP,
			ExternalIPs: getExternalIPs(s),
			Ports:       ports,
			Age:         calculateAge(s.CreationTimestamp.Time),
		})
	}
	return out, nil
}

// FetchDeployments retrieves all deployments
func FetchDeployments(ctx context.Context, client kubernetes.Interface) (interface{}, error) {
	deps, err := client.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
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
	return out, nil
}

// FetchReplicaSets retrieves all replica sets
func FetchReplicaSets(ctx context.Context, client kubernetes.Interface) (interface{}, error) {
	rsList, err := client.AppsV1().ReplicaSets("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
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
	return out, nil
}

// FetchStatefulSets retrieves all stateful sets
func FetchStatefulSets(ctx context.Context, client kubernetes.Interface) (interface{}, error) {
	ssList, err := client.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	out := []SSInfo{}
	for _, ss := range ssList.Items {
		var desired int32
		if ss.Spec.Replicas != nil {
			desired = *ss.Spec.Replicas
		}
		out = append(out, SSInfo{
			Name:      ss.Name,
			Namespace: ss.Namespace,
			Ready:     fmt.Sprintf("%d/%d", ss.Status.ReadyReplicas, desired),
			Age:       calculateAge(ss.CreationTimestamp.Time),
		})
	}
	return out, nil
}

// FetchDaemonSets retrieves all daemon sets
func FetchDaemonSets(ctx context.Context, client kubernetes.Interface) (interface{}, error) {
	dsList, err := client.AppsV1().DaemonSets("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	out := []DSInfo{}
	for _, ds := range dsList.Items {
		out = append(out, DSInfo{
			Name:      ds.Name,
			Namespace: ds.Namespace,
			Desired:   ds.Status.DesiredNumberScheduled,
			Current:   ds.Status.CurrentNumberScheduled,
			Ready:     ds.Status.NumberReady,
			UpToDate:  ds.Status.UpdatedNumberScheduled,
			Available: ds.Status.NumberAvailable,
			Age:       calculateAge(ds.CreationTimestamp.Time),
		})
	}
	return out, nil
}

// FetchJobs retrieves all jobs
func FetchJobs(ctx context.Context, client kubernetes.Interface) (interface{}, error) {
	jobs, err := client.BatchV1().Jobs("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	out := []JobInfo{}
	for _, j := range jobs.Items {
		completions := "?"
		if j.Spec.Completions != nil {
			completions = fmt.Sprintf("%d/%d", j.Status.Succeeded, *j.Spec.Completions)
		}

		duration := ""
		if j.Status.CompletionTime != nil && j.Status.StartTime != nil {
			duration = j.Status.CompletionTime.Sub(j.Status.StartTime.Time).String()
		}

		out = append(out, JobInfo{
			Name:        j.Name,
			Namespace:   j.Namespace,
			Completions: completions,
			Duration:    duration,
			Age:         calculateAge(j.CreationTimestamp.Time),
		})
	}
	return out, nil
}

// FetchCronJobs retrieves all cron jobs
func FetchCronJobs(ctx context.Context, client kubernetes.Interface) (interface{}, error) {
	cronJobs, err := client.BatchV1().CronJobs("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	out := []CronJobInfo{}
	for _, cj := range cronJobs.Items {
		lastSchedule := ""
		if cj.Status.LastScheduleTime != nil {
			lastSchedule = calculateAge(cj.Status.LastScheduleTime.Time)
		}

		suspend := false
		if cj.Spec.Suspend != nil {
			suspend = *cj.Spec.Suspend
		}

		out = append(out, CronJobInfo{
			Name:         cj.Name,
			Namespace:    cj.Namespace,
			Schedule:     cj.Spec.Schedule,
			Suspend:      suspend,
			Active:       len(cj.Status.Active),
			LastSchedule: lastSchedule,
			Age:          calculateAge(cj.CreationTimestamp.Time),
		})
	}
	return out, nil
}
