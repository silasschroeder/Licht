package handlers

import (
	"encoding/base64"
	"strings"
)

// maybeDecodeBase64OrPEM returns the raw PEM bytes if the input already
// contains BEGIN/END markers, otherwise tries to base64 decode it.
func maybeDecodeBase64OrPEM(s string) ([]byte, error) {
    trim := strings.TrimSpace(s)
    if strings.Contains(trim, "-----BEGIN") {
        return []byte(trim), nil
    }
    return base64.StdEncoding.DecodeString(trim)
}