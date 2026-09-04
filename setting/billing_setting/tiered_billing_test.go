package billing_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultGrok46BillingUsesOfficialContextTiers(t *testing.T) {
	require.NoError(t, SmokeTestExpr(DefaultGrok46BillingExpr))

	standardCost, standardTrace, err := billingexpr.RunExpr(
		DefaultGrok46BillingExpr,
		billingexpr.TokenParams{P: 1000, C: 200, CR: 500, Len: 199999},
	)
	require.NoError(t, err)
	assert.Equal(t, 3450.0, standardCost)
	assert.Equal(t, "standard", standardTrace.MatchedTier)

	longCost, longTrace, err := billingexpr.RunExpr(
		DefaultGrok46BillingExpr,
		billingexpr.TokenParams{P: 1000, C: 200, CR: 500, Len: 200000},
	)
	require.NoError(t, err)
	assert.Equal(t, 6900.0, longCost)
	assert.Equal(t, "long_context", longTrace.MatchedTier)
}

func TestDefaultGrok46BillingIsEnabled(t *testing.T) {
	assert.Equal(t, BillingModeTieredExpr, GetBillingMode("grok-4.6"))
	expr, ok := GetBillingExpr("grok-4.6")
	require.True(t, ok)
	assert.Equal(t, DefaultGrok46BillingExpr, expr)
}

func TestDefaultGPT6AstraBillingUsesOfficialContextTiers(t *testing.T) {
	require.NoError(t, SmokeTestExpr(DefaultGPT6AstraBillingExpr))

	standardCost, standardTrace, err := billingexpr.RunExpr(
		DefaultGPT6AstraBillingExpr,
		billingexpr.TokenParams{P: 1000, C: 200, CR: 500, CC: 100, Len: 272000},
	)
	require.NoError(t, err)
	assert.Equal(t, 21750.0, standardCost)
	assert.Equal(t, "standard", standardTrace.MatchedTier)

	longCost, longTrace, err := billingexpr.RunExpr(
		DefaultGPT6AstraBillingExpr,
		billingexpr.TokenParams{P: 1000, C: 200, CR: 500, CC: 100, Len: 272001},
	)
	require.NoError(t, err)
	assert.Equal(t, 38500.0, longCost)
	assert.Equal(t, "long_context", longTrace.MatchedTier)
}
