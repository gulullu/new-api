package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func relayBasesTopupTestContext(language string) *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set(string(constant.ContextKeyLanguage), language)
	return c
}

func TestRelayBasesTopupMinimumMessageUsesSupportedTranslationsAndEnglishFallback(t *testing.T) {
	require.NoError(t, appI18n.Init())

	tests := []struct {
		language string
		want     string
	}{
		{language: "zh-CN", want: "充值数量不能小于 20"},
		{language: "zh-TW", want: "充值數量不能小於 20"},
		{language: "zhTW", want: "充值數量不能小於 20"},
		{language: "en", want: "Minimum top-up amount is 20"},
		{language: "fr", want: "Minimum top-up amount is 20"},
	}

	for _, test := range tests {
		t.Run(test.language, func(t *testing.T) {
			assert.Equal(t, test.want, relayBasesTopupMinimumMessage(
				relayBasesTopupTestContext(test.language),
				20,
			))
		})
	}
}

func TestRelayBasesMinimumTopupCreditsUsesChineseAndNonChineseTiers(t *testing.T) {
	t.Parallel()

	tests := []struct {
		language string
		minimum  int64
	}{
		{language: "zh-CN", minimum: 20},
		{language: "zh-TW", minimum: 20},
		{language: "zhTW", minimum: 20},
		{language: "en", minimum: 100},
		{language: "fr", minimum: 100},
		{language: "ja", minimum: 100},
		{language: "ru", minimum: 100},
		{language: "vi", minimum: 100},
	}

	for _, test := range tests {
		t.Run(test.language, func(t *testing.T) {
			assert.Equal(t, test.minimum, relayBasesMinimumTopupCredits(
				relayBasesTopupTestContext(test.language),
			))
		})
	}
}

func TestRelayBasesEffectiveTopupMinimumKeepsStricterGatewaySetting(t *testing.T) {
	t.Parallel()

	c := relayBasesTopupTestContext("zh-CN")
	assert.Equal(t, int64(20), relayBasesEffectiveTopupMinimum(c, 1))
	assert.Equal(t, int64(80), relayBasesEffectiveTopupMinimum(c, 80))
}

func TestRelayBasesTopupAmountOptionsFiltersAndPrependsMinimum(t *testing.T) {
	t.Parallel()

	original := []int{10, 20, 50, 200}
	assert.Equal(t, []int{100, 200}, relayBasesTopupAmountOptions(original, 100))
	assert.Equal(t, []int{20, 50, 200}, relayBasesTopupAmountOptions(original, 20))
	assert.Equal(t, []int{10, 20, 50, 200}, original)
}

func TestRelayBasesLowestEnabledTopupMinimumUsesAllEnabledChannels(t *testing.T) {
	t.Parallel()

	assert.Equal(t, int64(100), relayBasesLowestEnabledTopupMinimum(100))
	assert.Equal(t, int64(80), relayBasesLowestEnabledTopupMinimum(100, 120, 80, 150))
}

func TestRelayBasesTopupPayMethodsClonesAndAppliesProviderMinimum(t *testing.T) {
	t.Parallel()

	original := []map[string]string{
		{"name": "Stripe", "type": "stripe", "min_topup": "1"},
		{"name": "Wallet", "type": "wallet", "min_topup": "150"},
	}
	result := relayBasesTopupPayMethods(
		original,
		map[string]int64{"stripe": 120},
		100,
	)

	assert.Equal(t, "120", result[0]["min_topup"])
	assert.Equal(t, "150", result[1]["min_topup"])
	assert.Equal(t, "1", original[0]["min_topup"])
	result[0]["name"] = "Changed"
	assert.Equal(t, "Stripe", original[0]["name"])
}
