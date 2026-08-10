package common

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSensitiveCipherRoundTripAndPurposeSeparation(t *testing.T) {
	previous := CryptoSecret
	CryptoSecret = "partner-sensitive-test-secret"
	t.Cleanup(func() { CryptoSecret = previous })

	plaintext := `{"alipay_account":"user@example.com"}`
	ciphertext, err := EncryptSensitiveValue("partner-payout", plaintext)
	require.NoError(t, err)
	assert.False(t, strings.Contains(ciphertext, "user@example.com"))

	decrypted, err := DecryptSensitiveValue("partner-payout", ciphertext)
	require.NoError(t, err)
	assert.Equal(t, plaintext, decrypted)

	_, err = DecryptSensitiveValue("different-purpose", ciphertext)
	require.Error(t, err)
}
