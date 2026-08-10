package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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
		{language: "ja", want: "Minimum top-up amount is 20"},
		{language: "ru", want: "Minimum top-up amount is 20"},
		{language: "vi", want: "Minimum top-up amount is 20"},
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

func TestRelayBasesMinimumTopupUsesTwentyForEveryInterfaceLanguage(t *testing.T) {
	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
	})
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD

	languages := []string{
		"zh-CN",
		"zh-TW",
		"zhTW",
		"en",
		"fr",
		"ja",
		"ru",
		"vi",
	}

	for _, language := range languages {
		t.Run(language, func(t *testing.T) {
			assert.Equal(t, int64(20), relayBasesEffectiveTopupMinimum(
				relayBasesTopupTestContext(language),
				1,
			))
		})
	}
}

func TestRelayBasesEffectiveTopupMinimumKeepsStricterGatewaySetting(t *testing.T) {
	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
	})

	c := relayBasesTopupTestContext("zh-CN")
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	assert.Equal(t, int64(20), relayBasesEffectiveTopupMinimum(c, 1))
	assert.Equal(t, int64(80), relayBasesEffectiveTopupMinimum(c, 80))

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeTokens
	assert.Equal(t, int64(10_000_000), relayBasesEffectiveTopupMinimum(c, 1))
	assert.Equal(
		t,
		int64(40_000_000),
		relayBasesEffectiveTopupMinimum(c, 40_000_000),
	)
}

func TestRelayBasesTopupAmountOptionsFiltersAndPrependsMinimum(t *testing.T) {
	t.Parallel()

	original := []int{10, 20, 50, 200}
	assert.Equal(t, []int{20, 50, 200}, relayBasesTopupAmountOptions(original, 20))
	assert.Equal(t, []int{10, 20, 50, 200}, original)
}

func TestRelayBasesLowestEnabledTopupMinimumUsesAllEnabledChannels(t *testing.T) {
	t.Parallel()

	assert.Equal(t, int64(20), relayBasesLowestEnabledTopupMinimum(20))
	assert.Equal(t, int64(20), relayBasesLowestEnabledTopupMinimum(20, 20, 80, 150))
}

func TestRelayBasesTopupPayMethodsClonesAndAppliesProviderMinimum(t *testing.T) {
	t.Parallel()

	original := []map[string]string{
		{"name": "Stripe", "type": "stripe", "min_topup": "1"},
		{"name": "Wallet A", "type": "wallet", "min_topup": "20"},
		{"name": "Wallet B", "type": "wallet", "min_topup": "150"},
	}
	result := relayBasesTopupPayMethods(
		original,
		map[string]int64{"stripe": 20},
		20,
	)

	assert.Equal(t, "20", result[0]["min_topup"])
	assert.Equal(t, "150", result[1]["min_topup"])
	assert.Equal(t, "150", result[2]["min_topup"])
	assert.Equal(t, "1", original[0]["min_topup"])
	result[0]["name"] = "Changed"
	assert.Equal(t, "Stripe", original[0]["name"])
}

func TestEpayQuoteAndOrderEnforceTheSelectedMethodMinimum(t *testing.T) {
	require.NoError(t, appI18n.Init())
	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalMinTopUp := operation_setting.MinTopUp
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
		operation_setting.MinTopUp = originalMinTopUp
		operation_setting.PayMethods = originalPayMethods
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	operation_setting.MinTopUp = 1
	operation_setting.PayMethods = []map[string]string{
		{"name": "Custom A", "type": "custom1", "min_topup": "20"},
		{"name": "Custom B", "type": "custom1", "min_topup": "50"},
	}

	for _, endpoint := range []struct {
		name    string
		handler gin.HandlerFunc
	}{
		{name: "quote", handler: RequestAmount},
		{name: "order", handler: RequestEpay},
	} {
		t.Run(endpoint.name, func(t *testing.T) {
			recorder := performRelayBasesMinimumRequest(
				t,
				endpoint.handler,
				`{"amount":20,"payment_method":"custom1"}`,
				"en",
			)
			assert.Equal(t, http.StatusOK, recorder.Code)
			assert.JSONEq(
				t,
				`{"message":"error","data":"Minimum top-up amount is 50"}`,
				recorder.Body.String(),
			)
		})
	}
}

func performRelayBasesMinimumRequest(
	t *testing.T,
	handler gin.HandlerFunc,
	body string,
	language string,
) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/test", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set(string(constant.ContextKeyLanguage), language)
	handler(c)
	return recorder
}

func TestRelayBasesQuoteAndOrderEndpointsShareTwentyCreditMinimum(t *testing.T) {
	require.NoError(t, appI18n.Init())
	confirmPaymentComplianceForTest(t)

	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalMinTopUp := operation_setting.MinTopUp
	originalStripeMinTopUp := setting.StripeMinTopUp
	originalWaffoEnabled := setting.WaffoEnabled
	originalWaffoMinTopUp := setting.WaffoMinTopUp
	originalPancakeMinTopUp := setting.WaffoPancakeMinTopUp
	originalPancakeMerchantID := setting.WaffoPancakeMerchantID
	originalPancakePrivateKey := setting.WaffoPancakePrivateKey
	originalPancakeProductID := setting.WaffoPancakeProductID
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
		operation_setting.MinTopUp = originalMinTopUp
		setting.StripeMinTopUp = originalStripeMinTopUp
		setting.WaffoEnabled = originalWaffoEnabled
		setting.WaffoMinTopUp = originalWaffoMinTopUp
		setting.WaffoPancakeMinTopUp = originalPancakeMinTopUp
		setting.WaffoPancakeMerchantID = originalPancakeMerchantID
		setting.WaffoPancakePrivateKey = originalPancakePrivateKey
		setting.WaffoPancakeProductID = originalPancakeProductID
		operation_setting.PayMethods = originalPayMethods
	})

	operation_setting.MinTopUp = 1
	setting.StripeMinTopUp = 1
	setting.WaffoEnabled = true
	setting.WaffoMinTopUp = 1
	setting.WaffoPancakeMinTopUp = 1
	setting.WaffoPancakeMerchantID = "merchant"
	setting.WaffoPancakePrivateKey = "private"
	setting.WaffoPancakeProductID = "product"
	operation_setting.PayMethods = nil

	endpoints := []struct {
		name    string
		handler gin.HandlerFunc
		body    func(int64) string
	}{
		{name: "epay quote", handler: RequestAmount, body: func(amount int64) string {
			return fmt.Sprintf(`{"amount":%d}`, amount)
		}},
		{name: "epay order", handler: RequestEpay, body: func(amount int64) string {
			return fmt.Sprintf(`{"amount":%d,"payment_method":"alipay"}`, amount)
		}},
		{name: "Stripe quote", handler: RequestStripeAmount, body: func(amount int64) string {
			return fmt.Sprintf(`{"amount":%d}`, amount)
		}},
		{name: "Stripe order", handler: RequestStripePay, body: func(amount int64) string {
			return fmt.Sprintf(`{"amount":%d,"payment_method":"stripe"}`, amount)
		}},
		{name: "Waffo quote", handler: RequestWaffoAmount, body: func(amount int64) string {
			return fmt.Sprintf(`{"amount":%d}`, amount)
		}},
		{name: "Waffo order", handler: RequestWaffoPay, body: func(amount int64) string {
			return fmt.Sprintf(`{"amount":%d}`, amount)
		}},
		{name: "Waffo Pancake quote", handler: RequestWaffoPancakeAmount, body: func(amount int64) string {
			return fmt.Sprintf(`{"amount":%d}`, amount)
		}},
		{name: "Waffo Pancake order", handler: RequestWaffoPancakePay, body: func(amount int64) string {
			return fmt.Sprintf(`{"amount":%d}`, amount)
		}},
	}
	modes := []struct {
		name          string
		displayType   string
		minimum       int64
		rejectedValue int64
	}{
		{name: "USD", displayType: operation_setting.QuotaDisplayTypeUSD, minimum: 20, rejectedValue: 19},
		{name: "TOKENS", displayType: operation_setting.QuotaDisplayTypeTokens, minimum: 10_000_000, rejectedValue: 9_999_999},
	}

	for _, mode := range modes {
		t.Run(mode.name, func(t *testing.T) {
			operation_setting.GetGeneralSetting().QuotaDisplayType = mode.displayType
			for _, endpoint := range endpoints {
				t.Run(endpoint.name, func(t *testing.T) {
					recorder := performRelayBasesMinimumRequest(
						t,
						endpoint.handler,
						endpoint.body(mode.rejectedValue),
						"en",
					)
					assert.Equal(t, http.StatusOK, recorder.Code)

					var payload map[string]any
					require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
					want := fmt.Sprintf("Minimum top-up amount is %d", mode.minimum)
					message, _ := payload["message"].(string)
					data, _ := payload["data"].(string)
					assert.True(
						t,
						message == want || data == want,
						"response must reject below-minimum %s request: %s",
						endpoint.name,
						recorder.Body.String(),
					)
				})
			}
		})
	}

	t.Run("configured payment method minima", func(t *testing.T) {
		operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
		operation_setting.PayMethods = []map[string]string{
			{"name": "Custom A", "type": "custom1", "min_topup": "20"},
			{"name": "Custom B", "type": "custom1", "min_topup": "50"},
			{"name": "Stripe", "type": model.PaymentMethodStripe, "min_topup": "50"},
			{"name": "Waffo", "type": model.PaymentMethodWaffo, "min_topup": "50"},
			{"name": "Waffo Pancake", "type": model.PaymentMethodWaffoPancake, "min_topup": "50"},
		}

		configuredEndpoints := []struct {
			name    string
			handler gin.HandlerFunc
			body    string
		}{
			{name: "epay quote", handler: RequestAmount, body: `{"amount":20,"payment_method":"custom1"}`},
			{name: "epay order", handler: RequestEpay, body: `{"amount":20,"payment_method":"custom1"}`},
			{name: "Stripe quote", handler: RequestStripeAmount, body: `{"amount":20,"payment_method":"stripe"}`},
			{name: "Stripe order", handler: RequestStripePay, body: `{"amount":20,"payment_method":"stripe"}`},
			{name: "Waffo quote", handler: RequestWaffoAmount, body: `{"amount":20}`},
			{name: "Waffo order", handler: RequestWaffoPay, body: `{"amount":20}`},
			{name: "Waffo Pancake quote", handler: RequestWaffoPancakeAmount, body: `{"amount":20}`},
			{name: "Waffo Pancake order", handler: RequestWaffoPancakePay, body: `{"amount":20}`},
		}

		for _, endpoint := range configuredEndpoints {
			t.Run(endpoint.name, func(t *testing.T) {
				recorder := performRelayBasesMinimumRequest(t, endpoint.handler, endpoint.body, "en")
				assert.Equal(t, http.StatusOK, recorder.Code)

				var payload map[string]any
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
				message, _ := payload["message"].(string)
				data, _ := payload["data"].(string)
				assert.True(
					t,
					message == "Minimum top-up amount is 50" || data == "Minimum top-up amount is 50",
					"response must enforce configured minimum for %s: %s",
					endpoint.name,
					recorder.Body.String(),
				)
			})
		}
	})
}
