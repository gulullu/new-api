package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateWaffoPancakeSubscriptionCurrency(t *testing.T) {
	testCases := []struct {
		name             string
		planCurrency     string
		checkoutCurrency string
		errorText        string
	}{
		{
			name:             "CNY plan can use CNY checkout",
			planCurrency:     "CNY",
			checkoutCurrency: "CNY",
		},
		{
			name:             "blank legacy plan defaults to USD checkout",
			planCurrency:     "",
			checkoutCurrency: "USD",
		},
		{
			name:             "USD plan cannot use CNY checkout",
			planCurrency:     "USD",
			checkoutCurrency: "CNY",
			errorText:        "does not match",
		},
		{
			name:             "invalid plan currency is rejected",
			planCurrency:     "CN1",
			checkoutCurrency: "CNY",
			errorText:        "invalid subscription plan currency",
		},
		{
			name:             "invalid checkout currency is rejected",
			planCurrency:     "CNY",
			checkoutCurrency: "CN1",
			errorText:        "invalid Waffo Pancake checkout currency",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateWaffoPancakeSubscriptionCurrency(tc.planCurrency, tc.checkoutCurrency)
			if tc.errorText != "" {
				require.ErrorContains(t, err, tc.errorText)
				return
			}
			require.NoError(t, err)
		})
	}
}
