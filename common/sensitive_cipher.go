package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
)

const sensitiveCipherVersion = "v1"

func sensitiveCipherKey(purpose string) []byte {
	digest := sha256.Sum256([]byte(strings.TrimSpace(purpose) + "\x00" + CryptoSecret))
	return digest[:]
}

// EncryptSensitiveValue encrypts application-owned sensitive data with a
// purpose-separated AES-GCM key derived from CRYPTO_SECRET. Callers must keep
// the purpose stable so ciphertext remains decryptable across restarts.
func EncryptSensitiveValue(purpose string, plaintext string) (string, error) {
	if strings.TrimSpace(purpose) == "" {
		return "", errors.New("sensitive encryption purpose is required")
	}
	block, err := aes.NewCipher(sensitiveCipherKey(purpose))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nil, nonce, []byte(plaintext), []byte(purpose))
	payload := append(nonce, sealed...)
	return sensitiveCipherVersion + ":" + base64.RawURLEncoding.EncodeToString(payload), nil
}

func DecryptSensitiveValue(purpose string, ciphertext string) (string, error) {
	if strings.TrimSpace(purpose) == "" {
		return "", errors.New("sensitive encryption purpose is required")
	}
	parts := strings.SplitN(strings.TrimSpace(ciphertext), ":", 2)
	if len(parts) != 2 || parts[0] != sensitiveCipherVersion {
		return "", errors.New("unsupported sensitive ciphertext")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", errors.New("invalid sensitive ciphertext")
	}
	block, err := aes.NewCipher(sensitiveCipherKey(purpose))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(payload) <= gcm.NonceSize() {
		return "", errors.New("invalid sensitive ciphertext")
	}
	plaintext, err := gcm.Open(nil, payload[:gcm.NonceSize()], payload[gcm.NonceSize():], []byte(purpose))
	if err != nil {
		return "", fmt.Errorf("decrypt sensitive value: %w", err)
	}
	return string(plaintext), nil
}
