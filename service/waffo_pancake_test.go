package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestWaffoPancakeBindingFromTradeNo(t *testing.T) {
	testCases := []struct {
		name          string
		tradeNo       string
		legacyStoreID string
		expected      waffoPancakeOrderBinding
		errorText     string
	}{
		{
			name:          "new CNY wallet order freezes currency and store",
			tradeNo:       "WAFFO_PANCAKE-CNY-STO_RELAYBASES-42-1770000000000-ABC123",
			legacyStoreID: "STO_CURRENT",
			expected: waffoPancakeOrderBinding{
				Currency: "CNY",
				StoreID:  "STO_RELAYBASES",
			},
		},
		{
			name:          "new CNY subscription order freezes currency and store",
			tradeNo:       "WAFFO_PANCAKE_SUB-CNY-STO_SUBSCRIPTIONS-42-1770000000000-ABC123",
			legacyStoreID: "STO_CURRENT",
			expected: waffoPancakeOrderBinding{
				Currency: "CNY",
				StoreID:  "STO_SUBSCRIPTIONS",
			},
		},
		{
			name:          "legacy wallet order remains USD and uses legacy store",
			tradeNo:       "WAFFO_PANCAKE-42-1770000000000-ABC123",
			legacyStoreID: "STO_LEGACY",
			expected: waffoPancakeOrderBinding{
				Currency: "USD",
				StoreID:  "STO_LEGACY",
			},
		},
		{
			name:          "legacy subscription order remains USD and uses legacy store",
			tradeNo:       "WAFFO_PANCAKE_SUB-42-1770000000000-ABC123",
			legacyStoreID: "STO_LEGACY",
			expected: waffoPancakeOrderBinding{
				Currency: "USD",
				StoreID:  "STO_LEGACY",
			},
		},
		{
			name:      "legacy order without legacy store is rejected",
			tradeNo:   "WAFFO_PANCAKE-42-1770000000000-ABC123",
			errorText: "missing legacy Waffo Pancake store binding",
		},
		{
			name:          "currency aware order without frozen store is rejected",
			tradeNo:       "WAFFO_PANCAKE-CNY-42-1770000000000-ABC123",
			legacyStoreID: "STO_CURRENT",
			errorText:     "missing frozen Waffo Pancake store binding",
		},
		{
			name:          "blank frozen store is rejected",
			tradeNo:       "WAFFO_PANCAKE-CNY--42-1770000000000-ABC123",
			legacyStoreID: "STO_CURRENT",
			errorText:     "missing frozen Waffo Pancake store binding",
		},
		{
			name:          "unknown prefix is rejected",
			tradeNo:       "OTHER-CNY-STO_RELAYBASES-42",
			legacyStoreID: "STO_CURRENT",
			errorText:     "unrecognized",
		},
		{
			name:          "malformed trade number is rejected",
			tradeNo:       "WAFFO_PANCAKE-CNY",
			legacyStoreID: "STO_CURRENT",
			errorText:     "malformed",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actual, err := waffoPancakeBindingFromTradeNo(tc.tradeNo, tc.legacyStoreID)
			if tc.errorText != "" {
				require.ErrorContains(t, err, tc.errorText)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.expected, actual)
		})
	}
}

func validWaffoPancakePaymentEvent() *WaffoPancakeWebhookEvent {
	return &WaffoPancakeWebhookEvent{
		StoreID: "STO_RELAYBASES",
		Data: WaffoPancakeWebhookData{
			Currency:      "CNY",
			Amount:        "21.30",
			TaxAmount:     "1.30",
			Subtotal:      "20.00",
			Total:         "21.30",
			PaymentStatus: "succeeded",
		},
	}
}

func TestValidateWaffoPancakePayment_AcceptsTaxedOrderAtFrozenSubtotal(t *testing.T) {
	event := validWaffoPancakePaymentEvent()
	require.NoError(t, validateWaffoPancakePayment(event, 20, "CNY", "STO_RELAYBASES", common.TopUpStatusPending))
}

func TestValidateWaffoPancakePayment_AcceptsLegacyAmountWithoutSubtotal(t *testing.T) {
	event := validWaffoPancakePaymentEvent()
	event.Data.Amount = "20.00"
	event.Data.TaxAmount = "0"
	event.Data.Subtotal = ""
	event.Data.Total = ""
	require.NoError(t, validateWaffoPancakePayment(event, 20, "CNY", "STO_RELAYBASES", common.TopUpStatusPending))
}

func TestValidateWaffoPancakePayment_DerivesSubtotalFromTotalAndTax(t *testing.T) {
	event := validWaffoPancakePaymentEvent()
	event.Data.Subtotal = ""
	require.NoError(t, validateWaffoPancakePayment(event, 20, "CNY", "STO_RELAYBASES", common.TopUpStatusPending))
}

func TestValidateWaffoPancakePayment_RejectsMismatchesAndReplay(t *testing.T) {
	testCases := []struct {
		name      string
		mutate    func(*WaffoPancakeWebhookEvent)
		status    string
		errorText string
	}{
		{
			name: "store mismatch",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.StoreID = "STO_OTHER"
			},
			status:    common.TopUpStatusPending,
			errorText: "store mismatch",
		},
		{
			name: "currency mismatch",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.Data.Currency = "USD"
			},
			status:    common.TopUpStatusPending,
			errorText: "currency mismatch",
		},
		{
			name: "frozen subtotal mismatch",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.Data.Subtotal = "19.99"
			},
			status:    common.TopUpStatusPending,
			errorText: "amount mismatch",
		},
		{
			name: "paid total below subtotal",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.Data.Total = "19.99"
			},
			status:    common.TopUpStatusPending,
			errorText: "below subtotal",
		},
		{
			name: "tax total mismatch",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.Data.Total = "21.29"
			},
			status:    common.TopUpStatusPending,
			errorText: "tax total mismatch",
		},
		{
			name: "tax amount fallback mismatch when total is absent",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.Data.Amount = "21.29"
				event.Data.Total = ""
			},
			status:    common.TopUpStatusPending,
			errorText: "tax total mismatch",
		},
		{
			name: "malformed amount",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.Data.Amount = "not-money"
			},
			status:    common.TopUpStatusPending,
			errorText: "invalid Waffo Pancake amount",
		},
		{
			name: "negative amount",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.Data.Amount = "-1.00"
			},
			status:    common.TopUpStatusPending,
			errorText: "negative Waffo Pancake amount",
		},
		{
			name: "negative tax amount",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.Data.TaxAmount = "-0.01"
			},
			status:    common.TopUpStatusPending,
			errorText: "negative Waffo Pancake tax amount",
		},
		{
			name: "missing payment status",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.Data.PaymentStatus = ""
			},
			status:    common.TopUpStatusPending,
			errorText: "payment is not successful",
		},
		{
			name: "unexpected payment status capitalization",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.Data.PaymentStatus = "Succeeded"
			},
			status:    common.TopUpStatusPending,
			errorText: "payment is not successful",
		},
		{
			name: "failed payment status",
			mutate: func(event *WaffoPancakeWebhookEvent) {
				event.Data.PaymentStatus = "failed"
			},
			status:    common.TopUpStatusPending,
			errorText: "payment is not successful",
		},
		{
			name:      "completed order replay",
			mutate:    func(_ *WaffoPancakeWebhookEvent) {},
			status:    common.TopUpStatusSuccess,
			errorText: "order is not pending",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			event := validWaffoPancakePaymentEvent()
			tc.mutate(event)
			err := validateWaffoPancakePayment(event, 20, "CNY", "STO_RELAYBASES", tc.status)
			require.ErrorContains(t, err, tc.errorText)
		})
	}
}

func TestResolveWaffoPancakeTradeNo_ClassifiesDatabaseFailuresAsRetryable(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })

	testCases := []struct {
		name    string
		resolve func(*WaffoPancakeWebhookEvent) (string, error)
		tradeNo string
	}{
		{
			name:    "wallet lookup failure",
			resolve: ResolveWaffoPancakeTradeNo,
			tradeNo: "WAFFO_PANCAKE-CNY-STO_RELAYBASES-42-1770000000000-ABC123",
		},
		{
			name:    "subscription lookup failure",
			resolve: ResolveWaffoPancakeSubscriptionTradeNo,
			tradeNo: "WAFFO_PANCAKE_SUB-CNY-STO_RELAYBASES-42-1770000000000-ABC123",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := tc.resolve(&WaffoPancakeWebhookEvent{
				Data: WaffoPancakeWebhookData{OrderMerchantExternalID: tc.tradeNo},
			})
			require.Error(t, err)
			require.ErrorIs(t, err, ErrWaffoPancakeOrderLookup)
		})
	}
}
