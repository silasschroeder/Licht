package config

import (
	"encoding/base64"
	"fmt"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// K8sCredentials holds the credentials for connecting to a Kubernetes cluster
type K8sCredentials struct {
    ServerURL  string
    AuthMethod string
    ClientCert string
    ClientKey  string
    Token      string
    Insecure   bool
}

// CreateClientConfig creates a Kubernetes client config from credentials
func CreateClientConfig(creds *K8sCredentials) (*rest.Config, error) {
    var config *rest.Config
    
    switch creds.AuthMethod {
    case "certificate":
        // Decode client certificate and key from base64
        clientCertData, err := base64.StdEncoding.DecodeString(creds.ClientCert)
        if err != nil {
            return nil, fmt.Errorf("invalid client certificate: %v", err)
        }
        
        clientKeyData, err := base64.StdEncoding.DecodeString(creds.ClientKey)
        if err != nil {
            return nil, fmt.Errorf("invalid client key: %v", err)
        }
        
        config = &rest.Config{
            Host: creds.ServerURL,
            TLSClientConfig: rest.TLSClientConfig{
                Insecure: creds.Insecure,
                CertData: clientCertData,
                KeyData:  clientKeyData,
            },
        }
    case "token":
        config = &rest.Config{
            Host:        creds.ServerURL,
            BearerToken: creds.Token,
            TLSClientConfig: rest.TLSClientConfig{
                Insecure: creds.Insecure,
            },
        }
    default:
        return nil, fmt.Errorf("unsupported authentication method: %s", creds.AuthMethod)
    }
    
    return config, nil
}

// CreateClientset creates a Kubernetes clientset from credentials
func CreateClientset(creds *K8sCredentials) (*kubernetes.Clientset, error) {
    config, err := CreateClientConfig(creds)
    if err != nil {
        return nil, err
    }
    
    return kubernetes.NewForConfig(config)
}