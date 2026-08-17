package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFilterDeprecatedCompactModelsFromCodexDiscovery(t *testing.T) {
	models := []string{
		"gpt-5.5",
		"gpt-5.5-openai-compact",
		" gpt-5.6-sol ",
		"gpt-5.6-sol-openai-compact",
		"gpt-5.5",
		"",
	}

	assert.Equal(t, []string{"gpt-5.5", "gpt-5.6-sol"}, filterDeprecatedCompactModels(models))
}
