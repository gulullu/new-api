package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeWaffoPancakeCurrency(t *testing.T) {
	testCases := []struct {
		name        string
		value       string
		expected    string
		expectError bool
	}{
		{name: "blank preserves legacy USD default", value: "", expected: "USD"},
		{name: "CNY stays canonical", value: "CNY", expected: "CNY"},
		{name: "lowercase is canonicalized", value: " cny ", expected: "CNY"},
		{name: "short code is rejected", value: "CN", expectError: true},
		{name: "non-letter code is rejected", value: "CN1", expectError: true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actual, err := NormalizeWaffoPancakeCurrency(tc.value)
			if tc.expectError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.expected, actual)
		})
	}
}
