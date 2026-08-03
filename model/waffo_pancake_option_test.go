package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateOptionValueWaffoPancakeCurrency(t *testing.T) {
	require.NoError(t, validateOptionValue("WaffoPancakeCurrency", "CNY"))
	require.Error(t, validateOptionValue("WaffoPancakeCurrency", "CN"))
	require.Error(t, validateOptionValue("WaffoPancakeCurrency", "CN1"))
}
