package handlers

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestFetchPods(t *testing.T) {
	client := fake.NewSimpleClientset(
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-pod",
				Namespace: "default",
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodRunning,
				PodIP: "10.0.0.1",
			},
			Spec: corev1.PodSpec{
				NodeName: "test-node",
				Containers: []corev1.Container{
					{Name: "container1"},
				},
			},
		},
	)

	result, err := FetchPods(context.Background(), client)
	if err != nil {
		t.Fatalf("FetchPods failed: %v", err)
	}

	pods := result.([]PodInfo)
	if len(pods) != 1 {
		t.Errorf("Expected 1 pod, got %d", len(pods))
	}
	if pods[0].Name != "test-pod" {
		t.Errorf("Expected pod name 'test-pod', got '%s'", pods[0].Name)
	}
	if pods[0].Status != "Running" {
		t.Errorf("Expected status 'Running', got '%s'", pods[0].Status)
	}
	if pods[0].IP != "10.0.0.1" {
		t.Errorf("Expected IP '10.0.0.1', got '%s'", pods[0].IP)
	}
}

func TestFetchNodes(t *testing.T) {
	client := fake.NewSimpleClientset(
		&corev1.Node{
			ObjectMeta: metav1.ObjectMeta{Name: "test-node"},
			Status: corev1.NodeStatus{
				Conditions: []corev1.NodeCondition{
					{Type: corev1.NodeReady, Status: corev1.ConditionTrue},
				},
			},
		},
	)

	result, err := FetchNodes(context.Background(), client)
	if err != nil {
		t.Fatalf("FetchNodes failed: %v", err)
	}

	nodes := result.([]NodeInfo)
	if len(nodes) != 1 {
		t.Errorf("Expected 1 node, got %d", len(nodes))
	}
	if nodes[0].Name != "test-node" {
		t.Errorf("Expected node name 'test-node', got '%s'", nodes[0].Name)
	}
	if nodes[0].Status != "Ready" {
		t.Errorf("Expected node status 'Ready', got '%s'", nodes[0].Status)
	}
}

func TestFetchNamespaces(t *testing.T) {
	client := fake.NewSimpleClientset(
		&corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{Name: "default"},
		},
		&corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{Name: "kube-system"},
		},
	)

	result, err := FetchNamespaces(context.Background(), client)
	if err != nil {
		t.Fatalf("FetchNamespaces failed: %v", err)
	}

	namespaces := result.([]NsInfo)
	if len(namespaces) != 2 {
		t.Errorf("Expected 2 namespaces, got %d", len(namespaces))
	}
}

func TestFetchServices(t *testing.T) {
	client := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-service",
				Namespace: "default",
			},
			Spec: corev1.ServiceSpec{
				Type:      corev1.ServiceTypeClusterIP,
				ClusterIP: "10.96.0.1",
				Ports: []corev1.ServicePort{
					{Port: 80, Protocol: corev1.ProtocolTCP},
				},
			},
		},
	)

	result, err := FetchServices(context.Background(), client)
	if err != nil {
		t.Fatalf("FetchServices failed: %v", err)
	}

	services := result.([]SvcInfo)
	if len(services) != 1 {
		t.Errorf("Expected 1 service, got %d", len(services))
	}
	if services[0].Name != "test-service" {
		t.Errorf("Expected service name 'test-service', got '%s'", services[0].Name)
	}
	if services[0].ClusterIP != "10.96.0.1" {
		t.Errorf("Expected ClusterIP '10.96.0.1', got '%s'", services[0].ClusterIP)
	}
}

func TestFetchDeployments(t *testing.T) {
	replicas := int32(3)
	client := fake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-deployment",
				Namespace: "default",
			},
			Spec: appsv1.DeploymentSpec{
				Replicas: &replicas,
			},
			Status: appsv1.DeploymentStatus{
				ReadyReplicas:     2,
				UpdatedReplicas:   3,
				AvailableReplicas: 2,
			},
		},
	)

	result, err := FetchDeployments(context.Background(), client)
	if err != nil {
		t.Fatalf("FetchDeployments failed: %v", err)
	}

	deployments := result.([]DeployInfo)
	if len(deployments) != 1 {
		t.Errorf("Expected 1 deployment, got %d", len(deployments))
	}
	if deployments[0].Ready != "2/3" {
		t.Errorf("Expected ready '2/3', got '%s'", deployments[0].Ready)
	}
}

func TestCountReadyContainers(t *testing.T) {
	tests := []struct {
		name     string
		statuses []corev1.ContainerStatus
		expected int
	}{
		{
			name: "all ready",
			statuses: []corev1.ContainerStatus{
				{Ready: true},
				{Ready: true},
			},
			expected: 2,
		},
		{
			name: "some ready",
			statuses: []corev1.ContainerStatus{
				{Ready: true},
				{Ready: false},
			},
			expected: 1,
		},
		{
			name:     "none ready",
			statuses: []corev1.ContainerStatus{},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := countReadyContainers(tt.statuses)
			if result != tt.expected {
				t.Errorf("Expected %d, got %d", tt.expected, result)
			}
		})
	}
}

func TestGetExternalIPs(t *testing.T) {
	tests := []struct {
		name     string
		service  corev1.Service
		expected []string
	}{
		{
			name: "LoadBalancer with IP",
			service: corev1.Service{
				Status: corev1.ServiceStatus{
					LoadBalancer: corev1.LoadBalancerStatus{
						Ingress: []corev1.LoadBalancerIngress{
							{IP: "1.2.3.4"},
						},
					},
				},
			},
			expected: []string{"1.2.3.4"},
		},
		{
			name: "LoadBalancer with Hostname",
			service: corev1.Service{
				Status: corev1.ServiceStatus{
					LoadBalancer: corev1.LoadBalancerStatus{
						Ingress: []corev1.LoadBalancerIngress{
							{Hostname: "example.com"},
						},
					},
				},
			},
			expected: []string{"example.com"},
		},
		{
			name: "ExternalIPs",
			service: corev1.Service{
				Spec: corev1.ServiceSpec{
					ExternalIPs: []string{"5.6.7.8"},
				},
			},
			expected: []string{"5.6.7.8"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getExternalIPs(tt.service)
			if len(result) != len(tt.expected) {
				t.Errorf("Expected %d IPs, got %d", len(tt.expected), len(result))
			}
		})
	}
}
