package setting

import (
	"fmt"
	"strings"
)

const DefaultWaffoPancakeCurrency = "USD"

// Waffo Pancake hosted checkout configuration. Gateway is enabled once
// MerchantID + PrivateKey + ProductID are populated (no separate Enabled
// flag, matching Stripe / Creem). StoreID + ProductID are operator-bound
// via SaveWaffoPancakeConfig.
var (
	WaffoPancakeMerchantID string
	WaffoPancakePrivateKey string
	WaffoPancakeReturnURL  string
	WaffoPancakeCurrency   string  = DefaultWaffoPancakeCurrency
	WaffoPancakeUnitPrice  float64 = 1.0
	WaffoPancakeMinTopUp   int     = 1
	WaffoPancakeStoreID    string
	WaffoPancakeProductID  string
)

func NormalizeWaffoPancakeCurrency(value string) (string, error) {
	currency := strings.ToUpper(strings.TrimSpace(value))
	if currency == "" {
		return DefaultWaffoPancakeCurrency, nil
	}
	if len(currency) != 3 {
		return "", fmt.Errorf("Waffo Pancake currency must be a three-letter ISO 4217 code")
	}
	for i := 0; i < len(currency); i++ {
		if currency[i] < 'A' || currency[i] > 'Z' {
			return "", fmt.Errorf("Waffo Pancake currency must be a three-letter ISO 4217 code")
		}
	}
	return currency, nil
}

func GetWaffoPancakeCurrency() (string, error) {
	return NormalizeWaffoPancakeCurrency(WaffoPancakeCurrency)
}
