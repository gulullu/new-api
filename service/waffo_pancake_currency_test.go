package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveWaffoPancakeConfigCurrencyPreservesCurrentValueWhenOmitted(t *testing.T) {
	original := setting.WaffoPancakeCurrency
	setting.WaffoPancakeCurrency = "CNY"
	t.Cleanup(func() {
		setting.WaffoPancakeCurrency = original
	})

	currency, err := resolveWaffoPancakeConfigCurrency("")
	require.NoError(t, err)
	assert.Equal(t, "CNY", currency)
}

func TestResolveWaffoPancakeConfigCurrencyUsesExplicitValue(t *testing.T) {
	original := setting.WaffoPancakeCurrency
	setting.WaffoPancakeCurrency = "CNY"
	t.Cleanup(func() {
		setting.WaffoPancakeCurrency = original
	})

	currency, err := resolveWaffoPancakeConfigCurrency(" usd ")
	require.NoError(t, err)
	assert.Equal(t, "USD", currency)
}
