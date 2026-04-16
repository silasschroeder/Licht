package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/sessions"
	"github.com/silasschroeder/licht/go/config"
	v1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// getK8sClient creates a Kubernetes client from session credentials
func getK8sClient(r *http.Request, store sessions.Store, cfg *config.Config) (*kubernetes.Clientset, error) {
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
		k8sConfig = &rest.Config{
			Host: serverURL,
			TLSClientConfig: rest.TLSClientConfig{
				Insecure: cfg.TLSInsecureSkipVerify,
				CertData: certData,
				KeyData:  keyData,
			},
		}
	case "token":
		token, ok := session.Values["token"].(string)
		if !ok {
			return nil, fmt.Errorf("token not found in session")
		}
		k8sConfig = &rest.Config{
			Host:        serverURL,
			BearerToken: strings.TrimSpace(token),
			TLSClientConfig: rest.TLSClientConfig{
				Insecure: cfg.TLSInsecureSkipVerify,
			},
		}
	default:
		return nil, fmt.Errorf("unsupported auth method")
	}

	return kubernetes.NewForConfig(k8sConfig)
}

// Helper functions

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
