package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const relayBasesMinimumTopup int64 = 20

// relayBasesMinimumTopupCredits is the deployment policy expressed in the
// user-facing RelayBases credit unit. The server applies the same policy to
// every interface language; the browser never sends a minimum that the
// payment endpoints trust.
func relayBasesMinimumTopupCredits(_ *gin.Context) int64 {
	return relayBasesMinimumTopup
}

// relayBasesMinimumTopupFloor converts the credit policy into the request unit
// used by the current quota display mode. In the normal USD/CNY/CUSTOM modes a
// request unit is already one displayed credit; TOKENS is the only mode that
// needs conversion.
func relayBasesMinimumTopupFloor(c *gin.Context) int64 {
	minimum := relayBasesMinimumTopupCredits(c)
	if operation_setting.GetQuotaDisplayType() != operation_setting.QuotaDisplayTypeTokens {
		return minimum
	}

	converted := decimal.NewFromInt(minimum).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		IntPart()
	if converted > 0 {
		return converted
	}
	return minimum
}

func relayBasesEffectiveTopupMinimum(c *gin.Context, configured int64) int64 {
	minimum := relayBasesMinimumTopupFloor(c)
	if configured > minimum {
		return configured
	}
	return minimum
}

func relayBasesTopupMinimumMessage(c *gin.Context, minimum int64) string {
	return i18n.T(c, i18n.MsgTopupMinimum, map[string]any{"Amount": minimum})
}

func relayBasesLowestEnabledTopupMinimum(defaultMinimum int64, enabledMinimums ...int64) int64 {
	if len(enabledMinimums) == 0 {
		return defaultMinimum
	}

	minimum := enabledMinimums[0]
	for _, enabledMinimum := range enabledMinimums[1:] {
		if enabledMinimum < minimum {
			minimum = enabledMinimum
		}
	}
	return minimum
}

// relayBasesTopupAmountOptions returns a request-local copy. It never mutates
// the global payment setting shared by other users or concurrent requests.
func relayBasesTopupAmountOptions(options []int, minimum int64) []int {
	result := make([]int, 0, len(options)+1)
	hasMinimum := false
	for _, option := range options {
		if int64(option) < minimum {
			continue
		}
		if int64(option) == minimum {
			hasMinimum = true
		}
		result = append(result, option)
	}

	if !hasMinimum {
		result = append([]int{int(minimum)}, result...)
	}
	return result
}

// relayBasesTopupPayMethods clones every map before applying the effective
// minimum. operation_setting.PayMethods is global mutable state and must not be
// rewritten for one user's language.
func relayBasesTopupPayMethods(
	methods []map[string]string,
	minimumByType map[string]int64,
	defaultMinimum int64,
) []map[string]string {
	result := make([]map[string]string, 0, len(methods))
	for _, method := range methods {
		cloned := make(map[string]string, len(method)+1)
		for key, value := range method {
			cloned[key] = value
		}

		minimum := defaultMinimum
		if providerMinimum, ok := minimumByType[cloned["type"]]; ok && providerMinimum > minimum {
			minimum = providerMinimum
		}
		if configured, err := strconv.ParseInt(cloned["min_topup"], 10, 64); err == nil && configured > minimum {
			minimum = configured
		}
		cloned["min_topup"] = strconv.FormatInt(minimum, 10)
		result = append(result, cloned)
	}
	return result
}
