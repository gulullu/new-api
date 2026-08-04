package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateOptionValueWaffoPancakeCurrency(t *testing.T) {
	require.NoError(t, validateOptionValue("WaffoPancakeCurrency", "CNY"))
	require.NoError(t, validateOptionValue("WaffoPancakeCurrency", " usd "))
	assert.Error(t, validateOptionValue("WaffoPancakeCurrency", "CN"))
	assert.Error(t, validateOptionValue("WaffoPancakeCurrency", "C1Y"))
}

func TestUpdateOptionMapNormalizesWaffoPancakeCurrency(t *testing.T) {
	original := setting.WaffoPancakeCurrency
	originalOptionMap := common.OptionMap
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMapRWMutex.RLock()
	originalOption, hadOriginalOption := common.OptionMap["WaffoPancakeCurrency"]
	common.OptionMapRWMutex.RUnlock()
	t.Cleanup(func() {
		setting.WaffoPancakeCurrency = original
		if originalOptionMap == nil {
			common.OptionMap = nil
			return
		}
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		if hadOriginalOption {
			common.OptionMap["WaffoPancakeCurrency"] = originalOption
		} else {
			delete(common.OptionMap, "WaffoPancakeCurrency")
		}
	})

	require.NoError(t, updateOptionMap("WaffoPancakeCurrency", " cny "))
	assert.Equal(t, "CNY", setting.WaffoPancakeCurrency)
}
