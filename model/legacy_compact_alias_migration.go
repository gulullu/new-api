package model

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"gorm.io/gorm"
)

var deprecatedCompactPricingOptionKeys = []string{
	"ModelRatio",
	"ModelPrice",
	"CompletionRatio",
	"CacheRatio",
	"CreateCacheRatio",
	"ImageRatio",
	"AudioRatio",
	"AudioCompletionRatio",
	"billing_setting.billing_mode",
	"billing_setting.billing_expr",
}

func isDeprecatedCompactPricingOptionKey(optionKey string) bool {
	for _, key := range deprecatedCompactPricingOptionKeys {
		if optionKey == key {
			return true
		}
	}
	return false
}

func validateDeprecatedCompactPricingOption(value string) error {
	entries := make(map[string]json.RawMessage)
	if err := common.UnmarshalJsonStr(value, &entries); err != nil {
		return err
	}
	for modelName := range entries {
		if constant.IsDeprecatedOpenAICompactModel(modelName) {
			return fmt.Errorf("deprecated Compact model aliases cannot be configured")
		}
	}
	return nil
}

type DeprecatedCompactAliasMigrationStats struct {
	ChannelsUpdated        int64
	ChannelMappingsUpdated int64
	TokensUpdated          int64
	AbilitiesDeleted       int64
	ModelMetadataDeleted   int64
	PricingEntriesDeleted  int64
}

func (s DeprecatedCompactAliasMigrationStats) TotalChanges() int64 {
	return s.ChannelsUpdated +
		s.TokensUpdated +
		s.AbilitiesDeleted +
		s.ModelMetadataDeleted +
		s.PricingEntriesDeleted
}

// MigrateDeprecatedCompactAliases removes the retired model-name routing
// aliases in one transaction. Lists are normalized to their base model names
// so existing Compact access remains available through the official model ID.
func MigrateDeprecatedCompactAliases() (DeprecatedCompactAliasMigrationStats, error) {
	stats := DeprecatedCompactAliasMigrationStats{}
	if DB == nil {
		return stats, fmt.Errorf("database is not initialized")
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
		suffixPattern := "%" + constant.DeprecatedOpenAICompactModelSuffix
		containsPattern := suffixPattern + "%"

		if err := tx.Model(&Ability{}).Where("model LIKE ?", suffixPattern).Count(&stats.AbilitiesDeleted).Error; err != nil {
			return fmt.Errorf("count deprecated compact abilities: %w", err)
		}

		var channels []Channel
		if err := tx.Where(
			"models LIKE ? OR test_model LIKE ? OR model_mapping LIKE ?",
			containsPattern,
			containsPattern,
			containsPattern,
		).Find(&channels).Error; err != nil {
			return fmt.Errorf("list channels with deprecated compact aliases: %w", err)
		}
		for i := range channels {
			channel := &channels[i]
			normalizedModels, modelsChanged := normalizeDeprecatedCompactModelList(channel.Models)
			updates := make(map[string]any, 2)
			if modelsChanged {
				updates["models"] = normalizedModels
				channel.Models = normalizedModels
			}
			if channel.TestModel != nil {
				if baseModel, changed := deprecatedCompactBaseModel(*channel.TestModel); changed {
					updates["test_model"] = baseModel
					channel.TestModel = &baseModel
				}
			}
			if channel.ModelMapping != nil && strings.Contains(*channel.ModelMapping, constant.DeprecatedOpenAICompactModelSuffix) {
				normalizedMapping, changed, err := normalizeDeprecatedCompactModelMapping(*channel.ModelMapping)
				if err != nil {
					return fmt.Errorf("normalize deprecated compact model mapping for channel %d: %w", channel.Id, err)
				}
				if changed {
					updates["model_mapping"] = normalizedMapping
					channel.ModelMapping = &normalizedMapping
					stats.ChannelMappingsUpdated++
				}
			}
			if len(updates) == 0 {
				continue
			}
			if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Updates(updates).Error; err != nil {
				return fmt.Errorf("normalize deprecated compact aliases for channel %d: %w", channel.Id, err)
			}
			if modelsChanged {
				if err := channel.UpdateAbilities(tx); err != nil {
					return fmt.Errorf("rebuild abilities for channel %d: %w", channel.Id, err)
				}
			}
			stats.ChannelsUpdated++
		}

		if err := tx.Where("model LIKE ?", suffixPattern).Delete(&Ability{}).Error; err != nil {
			return fmt.Errorf("delete deprecated compact abilities: %w", err)
		}

		var tokens []Token
		if err := tx.Unscoped().Where("model_limits LIKE ?", containsPattern).Find(&tokens).Error; err != nil {
			return fmt.Errorf("list tokens with deprecated compact aliases: %w", err)
		}
		for i := range tokens {
			normalized, changed := normalizeDeprecatedCompactModelList(tokens[i].ModelLimits)
			if !changed {
				continue
			}
			if err := tx.Unscoped().Model(&Token{}).Where("id = ?", tokens[i].Id).Update("model_limits", normalized).Error; err != nil {
				return fmt.Errorf("normalize deprecated compact aliases for token %d: %w", tokens[i].Id, err)
			}
			stats.TokensUpdated++
		}

		if err := tx.Unscoped().Model(&Model{}).Where("model_name LIKE ?", suffixPattern).Count(&stats.ModelMetadataDeleted).Error; err != nil {
			return fmt.Errorf("count deprecated compact model metadata: %w", err)
		}
		if err := tx.Unscoped().Where("model_name LIKE ?", suffixPattern).Delete(&Model{}).Error; err != nil {
			return fmt.Errorf("delete deprecated compact model metadata: %w", err)
		}

		var options []Option
		if err := tx.Where(
			"key IN ? AND value LIKE ?",
			deprecatedCompactPricingOptionKeys,
			containsPattern,
		).Find(&options).Error; err != nil {
			return fmt.Errorf("list model pricing options: %w", err)
		}
		for _, option := range options {
			entries := make(map[string]json.RawMessage)
			if err := common.UnmarshalJsonStr(option.Value, &entries); err != nil {
				return fmt.Errorf("decode model pricing option %s: %w", option.Key, err)
			}
			var deleted int64
			for modelName := range entries {
				if constant.IsDeprecatedOpenAICompactModel(modelName) {
					delete(entries, modelName)
					deleted++
				}
			}
			if deleted == 0 {
				continue
			}
			encoded, err := common.Marshal(entries)
			if err != nil {
				return fmt.Errorf("encode model pricing option %s: %w", option.Key, err)
			}
			if err := tx.Model(&Option{}).Where("key = ?", option.Key).Update("value", string(encoded)).Error; err != nil {
				return fmt.Errorf("update model pricing option %s: %w", option.Key, err)
			}
			stats.PricingEntriesDeleted += deleted
		}

		return nil
	})
	if err != nil {
		return DeprecatedCompactAliasMigrationStats{}, err
	}
	return stats, nil
}

func deprecatedCompactBaseModel(modelName string) (string, bool) {
	trimmed := strings.TrimSpace(modelName)
	if !constant.IsDeprecatedOpenAICompactModel(trimmed) {
		return modelName, false
	}
	return strings.TrimSuffix(trimmed, constant.DeprecatedOpenAICompactModelSuffix), true
}

func normalizeDeprecatedCompactAliasesForChannel(channel *Channel) error {
	if channel == nil {
		return nil
	}
	if normalized, changed := normalizeDeprecatedCompactModelList(channel.Models); changed {
		channel.Models = normalized
	}
	if channel.TestModel != nil {
		if baseModel, changed := deprecatedCompactBaseModel(*channel.TestModel); changed {
			channel.TestModel = &baseModel
		}
	}
	if channel.ModelMapping != nil && strings.Contains(*channel.ModelMapping, constant.DeprecatedOpenAICompactModelSuffix) {
		normalized, changed, err := normalizeDeprecatedCompactModelMapping(*channel.ModelMapping)
		if err != nil {
			return err
		}
		if changed {
			channel.ModelMapping = &normalized
		}
	}
	return nil
}

func normalizeDeprecatedCompactModelMapping(value string) (string, bool, error) {
	mapping := make(map[string]string)
	if err := common.UnmarshalJsonStr(value, &mapping); err != nil {
		return value, false, err
	}

	normalized := make(map[string]string, len(mapping))
	changed := false
	for modelName, upstreamModelName := range mapping {
		if constant.IsDeprecatedOpenAICompactModel(modelName) {
			changed = true
			continue
		}
		if baseUpstreamModel, isDeprecated := deprecatedCompactBaseModel(upstreamModelName); isDeprecated {
			upstreamModelName = baseUpstreamModel
			changed = true
		}
		normalized[modelName] = upstreamModelName
	}
	for modelName, upstreamModelName := range mapping {
		baseModelName, isDeprecated := deprecatedCompactBaseModel(modelName)
		if !isDeprecated || baseModelName == "" {
			continue
		}
		if _, baseAlreadyExists := normalized[baseModelName]; baseAlreadyExists {
			continue
		}
		if baseUpstreamModel, upstreamIsDeprecated := deprecatedCompactBaseModel(upstreamModelName); upstreamIsDeprecated {
			upstreamModelName = baseUpstreamModel
		}
		normalized[baseModelName] = upstreamModelName
	}
	if !changed {
		return value, false, nil
	}
	encoded, err := common.Marshal(normalized)
	if err != nil {
		return value, false, err
	}
	return string(encoded), true, nil
}

// normalizeDeprecatedCompactModelList preserves the order of real base-model
// entries. An alias is converted in place only when that base model is absent;
// otherwise the existing base entry wins and the alias is removed.
func normalizeDeprecatedCompactModelList(value string) (string, bool) {
	parts := strings.Split(value, ",")
	existingBaseModels := make(map[string]struct{}, len(parts))
	hasDeprecatedAlias := false
	for _, part := range parts {
		modelName := strings.TrimSpace(part)
		if constant.IsDeprecatedOpenAICompactModel(modelName) {
			hasDeprecatedAlias = true
			continue
		}
		if modelName != "" {
			existingBaseModels[modelName] = struct{}{}
		}
	}
	if !hasDeprecatedAlias {
		return value, false
	}

	normalized := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		modelName := strings.TrimSpace(part)
		if modelName == "" {
			continue
		}
		if constant.IsDeprecatedOpenAICompactModel(modelName) {
			baseModel := strings.TrimSuffix(modelName, constant.DeprecatedOpenAICompactModelSuffix)
			if baseModel == "" {
				continue
			}
			if _, exists := existingBaseModels[baseModel]; exists {
				continue
			}
			modelName = baseModel
		}
		if _, exists := seen[modelName]; exists {
			continue
		}
		seen[modelName] = struct{}{}
		normalized = append(normalized, modelName)
	}

	return strings.Join(normalized, ","), true
}
