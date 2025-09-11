package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"github.com/gorilla/sessions"
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
    
    var k8sConfig *rest.Config
    
    if authMethod == "certificate" {
        clientCert, ok := session.Values["client_cert"].(string)
        if !ok {
            return nil, fmt.Errorf("client certificate not found in session")
        }
        
        clientKey, ok := session.Values["client_key"].(string)
        if !ok {
            return nil, fmt.Errorf("client key not found in session")
        }
        
        // Decode client certificate and key from base64
        clientCertData, err := base64.StdEncoding.DecodeString(clientCert)
        if err != nil {
            return nil, err
        }
        
        clientKeyData, err := base64.StdEncoding.DecodeString(clientKey)
        if err != nil {
            return nil, err
        }
        
        k8sConfig = &rest.Config{
            Host: serverURL,
            TLSClientConfig: rest.TLSClientConfig{
                Insecure: true,
                CertData: clientCertData,
                KeyData:  clientKeyData,
            },
        }
    } else if authMethod == "token" {
        token, ok := session.Values["token"].(string)
        if !ok {
            return nil, fmt.Errorf("token not found in session")
        }
        
        k8sConfig = &rest.Config{
            Host:        serverURL,
            BearerToken: token,
            TLSClientConfig: rest.TLSClientConfig{
                Insecure: true,
            },
        }
    } else {
        return nil, fmt.Errorf("unsupported authentication method")
    }
    
    return kubernetes.NewForConfig(k8sConfig)
}

// GetPods returns all pods from the Kubernetes cluster
func GetPods(store *sessions.CookieStore) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        clientset, err := getK8sClient(r, store)
        if err != nil {
            http.Error(w, "Failed to create Kubernetes client: "+err.Error(), http.StatusInternalServerError)
            return
        }
        
        // Get pods from all namespaces
        pods, err := clientset.CoreV1().Pods("").List(context.TODO(), metav1.ListOptions{})
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        
        // Create a response structure matching kubectl get pods -o wide
        type PodInfo struct {
            Name           string `json:"name"`
            Namespace      string `json:"namespace"`
            Ready          string `json:"ready"`
            Status         string `json:"status"`
            Restarts       int    `json:"restarts"`
            Age            string `json:"age"`
            IP             string `json:"ip"`
            Node           string `json:"node"`
            NominatedNode  string `json:"nominatedNode"`
            ReadinessGates int    `json:"readinessGates"`
        }
        
        var podList []PodInfo
        for _, pod := range pods.Items {
            // Calculate container ready count
            readyContainers := 0
            totalContainers := len(pod.Spec.Containers)
            for _, containerStatus := range pod.Status.ContainerStatuses {
                if containerStatus.Ready {
                    readyContainers++
                }
            }
            
            // Calculate restarts
            restarts := 0
            for _, containerStatus := range pod.Status.ContainerStatuses {
                restarts += int(containerStatus.RestartCount)
            }
            
            // Calculate age
            age := time.Since(pod.CreationTimestamp.Time).Round(time.Second).String()
            
            podList = append(podList, PodInfo{
                Name:           pod.Name,
                Namespace:      pod.Namespace,
                Ready:          fmt.Sprintf("%d/%d", readyContainers, totalContainers),
                Status:         string(pod.Status.Phase),
                Restarts:       restarts,
                Age:            age,
                IP:             pod.Status.PodIP,
                Node:           pod.Spec.NodeName,
                NominatedNode:  pod.Status.NominatedNodeName,
                ReadinessGates: len(pod.Spec.ReadinessGates),
            })
        }
        
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(podList)
    }
}

// GetNodes returns all nodes from the Kubernetes cluster
func GetNodes(store *sessions.CookieStore) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        clientset, err := getK8sClient(r, store)
        if err != nil {
            http.Error(w, "Failed to create Kubernetes client: "+err.Error(), http.StatusInternalServerError)
            return
        }
        
        // Get all nodes
        nodes, err := clientset.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        
        // Create a simplified response structure
        type NodeInfo struct {
            Name   string `json:"name"`
            Status string `json:"status"`
        }
        
        var nodeList []NodeInfo
        for _, node := range nodes.Items {
            // Determine node status
            var status string = "Unknown"
            for _, condition := range node.Status.Conditions {
                if condition.Type == "Ready" {
                    if condition.Status == "True" {
                        status = "Ready"
                    } else {
                        status = "NotReady"
                    }
                    break
                }
            }
            
            nodeList = append(nodeList, NodeInfo{
                Name:   node.Name,
                Status: status,
            })
        }
        
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(nodeList)
    }
}

func GetNamespaces(store *sessions.CookieStore) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        clientset, err := getK8sClient(r, store)
        if err != nil {
            http.Error(w, "Failed to create Kubernetes client: "+err.Error(), http.StatusInternalServerError)
            return
        }
        
        // Get all namespaces
        namespaces, err := clientset.CoreV1().Namespaces().List(context.TODO(), metav1.ListOptions{})
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        
        // Create a simplified response structure
        type NamespaceInfo struct {
            Name string `json:"name"`
        }
        
        var namespaceList []NamespaceInfo
        for _, ns := range namespaces.Items {
            namespaceList = append(namespaceList, NamespaceInfo{
                Name: ns.Name,
            })
        }
        
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(namespaceList)
    }
}