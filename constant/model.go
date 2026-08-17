package constant

import "strings"

// DeprecatedOpenAICompactModelSuffix identifies the retired New API routing
// aliases that encoded the Responses Compact endpoint in a model name. It is
// kept only so requests and persisted legacy data can be rejected or migrated;
// routing, channel discovery, and billing must use the base model name.
const DeprecatedOpenAICompactModelSuffix = "-openai-compact"

func IsDeprecatedOpenAICompactModel(modelName string) bool {
	return strings.HasSuffix(strings.TrimSpace(modelName), DeprecatedOpenAICompactModelSuffix)
}
