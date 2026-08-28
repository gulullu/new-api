package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStripeCheckoutPaymentSnapshotUsesLineItemMinorUnitRounding(t *testing.T) {
	minorAmount, payment, err := stripeCheckoutPaymentSnapshot(13.5375, 14.25, 0.1425, "usd")
	require.NoError(t, err)

	assert.Equal(t, int64(1354), minorAmount)
	assert.Equal(t, "13.54", payment.PaidAmountForLog())
	assert.Equal(t, "USD", payment.Currency)
}

func TestStripeChineseCheckoutKeepsOriginalUsdReferralUnitPrice(t *testing.T) {
	// Chinese Checkout uses CNY 1.00 per R for the hosted line item, while
	// referral accounting must retain the captured USD rate from order creation.
	assert.Equal(t, "0.15", stripeReferralUnitPriceSnapshot(0.15))
	assert.NotEqual(t, stripeReferralUnitPriceSnapshot(1.0), stripeReferralUnitPriceSnapshot(0.15))
}

func TestStripeCheckoutLineItemBreakdownPreservesTotalWithVisibleQuantity(t *testing.T) {
	breakdown, err := stripeCheckoutLineItemBreakdown(286, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(14), breakdown.unitAmount)
	assert.Equal(t, int64(20), breakdown.quantity)
	assert.Equal(t, int64(6), breakdown.remainder)
	assert.Equal(t, int64(286), breakdown.unitAmount*breakdown.quantity+breakdown.remainder)

	breakdown, err = stripeCheckoutLineItemBreakdown(300, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(15), breakdown.unitAmount)
	assert.Equal(t, int64(20), breakdown.quantity)
	assert.Equal(t, int64(0), breakdown.remainder)
	assert.Equal(t, int64(300), breakdown.unitAmount*breakdown.quantity+breakdown.remainder)
}

func TestStripeCheckoutLineItemBreakdownUsesOneLineForTinyTotals(t *testing.T) {
	breakdown, err := stripeCheckoutLineItemBreakdown(5, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(5), breakdown.unitAmount)
	assert.Equal(t, int64(1), breakdown.quantity)
	assert.Equal(t, int64(0), breakdown.remainder)
}

func TestStripeCheckoutLineItemAmountRejectsInvalidValues(t *testing.T) {
	for _, tc := range []struct {
		name     string
		amount   int64
		quantity int64
	}{
		{name: "zero amount", amount: 0, quantity: 20},
		{name: "zero quantity", amount: 286, quantity: 0},
		{name: "negative quantity", amount: 286, quantity: -1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := stripeCheckoutLineItemBreakdown(tc.amount, tc.quantity)
			assert.Error(t, err)
		})
	}
}

func TestStripeCheckoutPaymentMethodTypesAreLocaleScoped(t *testing.T) {
	tests := []struct {
		name   string
		locale string
		want   []string
	}{
		{name: "simplified Chinese", locale: "zhCN", want: []string{"alipay"}},
		{name: "traditional Chinese", locale: "zhTW", want: []string{"alipay"}},
		{name: "BCP 47 Chinese", locale: "zh-CN", want: []string{"alipay"}},
		{name: "traditional BCP 47 Chinese", locale: "zh-Hant-TW", want: []string{"alipay"}},
		{name: "unsupported Chinese-looking tag", locale: "zh-unknown", want: nil},
		{name: "English keeps dashboard methods", locale: "en"},
		{name: "other language keeps dashboard methods", locale: "fr"},
		{name: "empty locale keeps dashboard methods", locale: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := stripeCheckoutPaymentMethodTypesForLocale(tt.locale)
			if len(tt.want) == 0 {
				if actual != nil {
					t.Fatalf("expected nil payment method types, got %#v", actual)
				}
				return
			}
			if len(actual) != len(tt.want) {
				t.Fatalf("expected %d payment method types, got %#v", len(tt.want), actual)
			}
			for i, want := range tt.want {
				if actual[i] == nil || *actual[i] != want {
					t.Fatalf("payment method type %d: expected %q, got %#v", i, want, actual[i])
				}
			}
		})
	}
}

func TestPartnerSettlementUsdPerUnitSnapshotIsCNYOnlyAndFinite(t *testing.T) {
	tests := []struct {
		name     string
		currency string
		unitRate float64
		want     string
	}{
		{name: "CNY captures USD basis", currency: "CNY", unitRate: 0.15, want: "0.15"},
		{name: "case insensitive CNY", currency: " cny ", unitRate: 0.15, want: "0.15"},
		{name: "USD does not need conversion snapshot", currency: "USD", unitRate: 0.15, want: ""},
		{name: "zero rate is rejected", currency: "CNY", unitRate: 0, want: ""},
		{name: "negative rate is rejected", currency: "CNY", unitRate: -0.15, want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if actual := partnerSettlementUsdPerUnitSnapshot(tt.currency, tt.unitRate); actual != tt.want {
				t.Fatalf("expected snapshot %q, got %q", tt.want, actual)
			}
		})
	}
}

func TestStripePayMoneyUsesCapturedUnitPrice(t *testing.T) {
	originalUnitPrice := setting.StripeUnitPrice
	originalQuotaDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	originalDiscounts := operation_setting.GetPaymentSetting().AmountDiscount
	originalTopupGroupRatio := common.TopupGroupRatio2JSONString()
	t.Cleanup(func() {
		setting.StripeUnitPrice = originalUnitPrice
		operation_setting.GetGeneralSetting().QuotaDisplayType = originalQuotaDisplayType
		operation_setting.GetPaymentSetting().AmountDiscount = originalDiscounts
		require.NoError(t, common.UpdateTopupGroupRatioByJSONString(originalTopupGroupRatio))
	})

	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	operation_setting.GetPaymentSetting().AmountDiscount = map[int]float64{}
	require.NoError(t, common.UpdateTopupGroupRatioByJSONString(`{"default":1}`))
	setting.StripeUnitPrice = 9.99

	// RequestPay captures 0.1425 once. A concurrent settings update must not
	// affect the amount or the snapshot passed onward to checkout creation.
	actual := getStripePayMoneyAtUnitPrice(100, "default", 0.1425)
	assert.InDelta(t, 14.25, actual, 0.000001)
}
