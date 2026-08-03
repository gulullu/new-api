package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestWaffoPancakeCurrencyFromTradeNo(t *testing.T) {
	testCases := []struct {
		name      string
		tradeNo   string
		expected  string
		errorText string
	}{
		{
			name:     "new CNY wallet order",
			tradeNo:  "WAFFO_PANCAKE-CNY-42-1770000000000-ABC123",
			expected: "CNY",
		},
		{
			name:     "new CNY subscription order",
			tradeNo:  "WAFFO_PANCAKE_SUB-CNY-42-1770000000000-ABC123",
			expected: "CNY",
		},
		{
			name:     "legacy wallet order remains USD",
			tradeNo:  "WAFFO_PANCAKE-42-1770000000000-ABC123",
			expected: "USD",
		},
		{
			name:     "legacy subscription order remains USD",
			tradeNo:  "WAFFO_PANCAKE_SUB-42-1770000000000-ABC123",
			expected: "USD",
		},
		{
			name:      "unknown prefix is rejected",
			tradeNo:   "OTHER-CNY-42",
			errorText: "unrecognized",
		},
		{
			name:      "malformed trade number is rejected",
			tradeNo:   "WAFFO_PANCAKE-CNY",
			errorText: "malformed",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actual, err := waffoPancakeCurrencyFromTradeNo(tc.tradeNo)
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
