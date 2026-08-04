package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeWaffoPancakeCurrency(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		wantErr  bool
	}{
		{name: "blank preserves official USD default", input: "", expected: "USD"},
		{name: "normalizes CNY", input: " cny ", expected: "CNY"},
		{name: "accepts another ISO-shaped code", input: "eur", expected: "EUR"},
		{name: "rejects short code", input: "CN", wantErr: true},
		{name: "rejects non letters", input: "C1Y", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual, err := NormalizeWaffoPancakeCurrency(test.input)
			if test.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.expected, actual)
		})
	}
}
