package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	SessionSecretKey       []byte
	TLSInsecureSkipVerify bool
	AllowedCORSOrigins    []string
	APIPort               string
	SessionMaxAge         int
	CACertPath            string
	LogLevel              string
}

func Load() (*Config, error) {
	cfg := &Config{
		APIPort:       getEnvOrDefault("API_PORT", "8080"),
		SessionMaxAge: getEnvIntOrDefault("SESSION_MAX_AGE", 28800),
		LogLevel:      getEnvOrDefault("LOG_LEVEL", "info"),
		CACertPath:    os.Getenv("CA_CERT_PATH"),
	}

	// SESSION_SECRET_KEY is REQUIRED
	secretKey := os.Getenv("SESSION_SECRET_KEY")
	if secretKey == "" {
		return nil, fmt.Errorf("SESSION_SECRET_KEY environment variable is required")
	}
	if len(secretKey) < 32 {
		return nil, fmt.Errorf("SESSION_SECRET_KEY must be at least 32 characters")
	}
	cfg.SessionSecretKey = []byte(secretKey)

	// TLS verification (default: secure)
	cfg.TLSInsecureSkipVerify = getEnvBool("TLS_INSECURE_SKIP_VERIFY")
	if cfg.TLSInsecureSkipVerify {
		log.Println("[WARNING] TLS certificate verification is DISABLED - this is insecure!")
	}

	// CORS origins (required for production)
	originsStr := os.Getenv("ALLOWED_CORS_ORIGINS")
	if originsStr == "" {
		return nil, fmt.Errorf("ALLOWED_CORS_ORIGINS environment variable is required")
	}
	cfg.AllowedCORSOrigins = strings.Split(originsStr, ",")

	return cfg, nil
}

func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvIntOrDefault(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

func getEnvBool(key string) bool {
	val := strings.ToLower(os.Getenv(key))
	return val == "true" || val == "1" || val == "yes"
}
