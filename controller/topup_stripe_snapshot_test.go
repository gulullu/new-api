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
