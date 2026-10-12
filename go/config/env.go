package config

import (
	"os"
)

type Config struct {
	APIPort  string
	LogLevel string
}

func Load() (*Config, error) {
	return &Config{
		APIPort:  getEnvOrDefault("API_PORT", "8080"),
		LogLevel: getEnvOrDefault("LOG_LEVEL", "info"),
	}, nil
}

func getEnvOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
