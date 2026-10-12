package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	v1 "k8s.io/api/core/v1"
)

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
