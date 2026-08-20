package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGrok46DefaultsMatchGrok45StandardPricing(t *testing.T) {
	require.Contains(t, defaultModelRatio, "grok-4.5")
	require.Contains(t, defaultCompletionRatio, "grok-4.5")
	require.Contains(t, defaultCacheRatio, "grok-4.5")

	assert.Equal(t, defaultModelRatio["grok-4.5"], defaultModelRatio["grok-4.6"])
	assert.Equal(t, defaultCompletionRatio["grok-4.5"], defaultCompletionRatio["grok-4.6"])
	assert.Equal(t, defaultCacheRatio["grok-4.5"], defaultCacheRatio["grok-4.6"])
	assert.Equal(t, 1.0, defaultModelRatio["grok-4.6"])
	assert.Equal(t, 3.0, defaultCompletionRatio["grok-4.6"])
	assert.Equal(t, 0.25, defaultCacheRatio["grok-4.6"])
}

func TestGLM53DefaultsMatchGLM52Pricing(t *testing.T) {
	require.Contains(t, defaultModelRatio, "glm-5.2")
	require.Contains(t, defaultCompletionRatio, "glm-5.2")
	require.Contains(t, defaultCacheRatio, "glm-5.2")

	assert.Equal(t, defaultModelRatio["glm-5.2"], defaultModelRatio["glm-5.3"])
	assert.Equal(t, defaultCompletionRatio["glm-5.2"], defaultCompletionRatio["glm-5.3"])
	assert.Equal(t, defaultCacheRatio["glm-5.2"], defaultCacheRatio["glm-5.3"])
	assert.Equal(t, 4.0, defaultModelRatio["glm-5.3"])
	assert.Equal(t, 3.5, defaultCompletionRatio["glm-5.3"])
	assert.Equal(t, 0.25, defaultCacheRatio["glm-5.3"])
}

func TestGemini37FlashDefaults(t *testing.T) {
	require.Equal(t, 0.375, defaultModelRatio["gemini-3.7-flash"])
	require.Equal(t, 5.0, defaultCompletionRatio["gemini-3.7-flash"])
	require.Equal(t, 0.1, defaultCacheRatio["gemini-3.7-flash"])
}

func TestDeepSeekV4PeakDefaults(t *testing.T) {
	require.Equal(t, 1.5, defaultModelRatio["deepseek-v4-flash"])
	require.Equal(t, 4.5, defaultModelRatio["deepseek-v4-pro"])
	require.Equal(t, 3.0, defaultCompletionRatio["deepseek-v4-flash"])
	require.Equal(t, 3.0, defaultCompletionRatio["deepseek-v4-pro"])
	require.Equal(t, 3.0, defaultCompletionRatio["deepseek-chat"])
	require.Equal(t, 3.0, defaultCompletionRatio["deepseek-reasoner"])
	require.InDelta(t, 0.1/3, defaultCacheRatio["deepseek-v4-flash"], 1e-15)
	require.InDelta(t, 0.3/9, defaultCacheRatio["deepseek-v4-pro"], 1e-15)
}
