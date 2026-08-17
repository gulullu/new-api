package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func useDeprecatedCompactAliasMigrationDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := DB
	previousType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}, &Token{}, &Model{}, &Option{}))
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = previousDB
		common.SetMainDatabaseType(previousType)
	})
	return db
}

func TestNormalizeDeprecatedCompactModelListPrefersExistingBaseModels(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  string
	}{
		{
			name:  "existing bases keep their own positions",
			value: "gpt-5.5-openai-compact,gpt-5.6-sol,gpt-5.5,gpt-5.6-sol-openai-compact",
			want:  "gpt-5.6-sol,gpt-5.5",
		},
		{
			name:  "alias only is converted to the base model",
			value: "gpt-5.6-luna-openai-compact,other",
			want:  "gpt-5.6-luna,other",
		},
		{
			name:  "converted aliases are stably deduplicated",
			value: "gpt-5.6-luna-openai-compact,other,gpt-5.6-luna-openai-compact",
			want:  "gpt-5.6-luna,other",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, changed := normalizeDeprecatedCompactModelList(test.value)
			assert.True(t, changed)
			assert.Equal(t, test.want, got)
		})
	}

	unchanged := "gpt-5.5,gpt-5.6-sol"
	got, changed := normalizeDeprecatedCompactModelList(unchanged)
	assert.False(t, changed)
	assert.Equal(t, unchanged, got)
}

func TestMigrateDeprecatedCompactAliasesNormalizesDataAndIsIdempotent(t *testing.T) {
	db := useDeprecatedCompactAliasMigrationDB(t)
	testModel := "gpt-5.5-openai-compact"
	modelMapping := `{"gpt-5.5":"official-base","gpt-5.5-openai-compact":"legacy-loses","only-openai-compact":"upstream-only-openai-compact","other":"gpt-5.6-sol-openai-compact"}`
	priority := int64(10)
	weight := uint(20)
	channel := Channel{
		Type:         constant.ChannelTypeCodex,
		Key:          "test-key",
		Status:       common.ChannelStatusEnabled,
		Name:         "codex-test",
		Models:       "gpt-5.5-openai-compact,gpt-5.6-sol,gpt-5.5,gpt-5.6-sol-openai-compact,gpt-5.6-luna-openai-compact,gpt-5.6-luna-openai-compact,gpt-5.4",
		Group:        "default",
		TestModel:    &testModel,
		ModelMapping: &modelMapping,
		Priority:     &priority,
		Weight:       &weight,
		CreatedTime:  1,
	}
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(db))
	require.NoError(t, db.Create(&Ability{
		Group:     "default",
		Model:     "orphan-openai-compact",
		ChannelId: 999,
		Enabled:   true,
	}).Error)

	activeToken := Token{UserId: 1, Key: "active-token", ModelLimitsEnabled: true, ModelLimits: "gpt-5.5-openai-compact,gpt-5.5,gpt-5.6-luna-openai-compact,gpt-5.4"}
	deletedToken := Token{UserId: 1, Key: "deleted-token", ModelLimitsEnabled: true, ModelLimits: "gpt-5.6-sol-openai-compact"}
	require.NoError(t, db.Create(&activeToken).Error)
	require.NoError(t, db.Create(&deletedToken).Error)
	require.NoError(t, db.Delete(&deletedToken).Error)

	require.NoError(t, db.Create(&Model{ModelName: "gpt-5.5-openai-compact", Status: 1}).Error)
	deletedMetadata := Model{ModelName: "gpt-5.6-sol-openai-compact", Status: 1}
	require.NoError(t, db.Create(&deletedMetadata).Error)
	require.NoError(t, db.Delete(&deletedMetadata).Error)
	require.NoError(t, db.Create(&Model{ModelName: "gpt-5.5", Status: 1}).Error)

	options := []Option{
		{Key: "ModelRatio", Value: `{"gpt-5.5":1.25,"gpt-5.5-openai-compact":9,"*-openai-compact":7,"unrelated":2}`},
		{Key: "ModelPrice", Value: `{"gpt-5.6-sol-openai-compact":0.01,"gpt-5.6-sol":0.02}`},
		{Key: "CompletionRatio", Value: `not-json`},
		{Key: "billing_setting.billing_mode", Value: `{"gpt-5.5":"tiered_expr","gpt-5.5-openai-compact":"tiered_expr"}`},
		{Key: "billing_setting.billing_expr", Value: `{"gpt-5.5":"p * 1","gpt-5.5-openai-compact":"p * 9"}`},
	}
	require.NoError(t, db.Create(&options).Error)

	stats, err := MigrateDeprecatedCompactAliases()
	require.NoError(t, err)
	assert.Equal(t, int64(1), stats.ChannelsUpdated)
	assert.Equal(t, int64(1), stats.ChannelMappingsUpdated)
	assert.Equal(t, int64(2), stats.TokensUpdated)
	assert.Equal(t, int64(4), stats.AbilitiesDeleted)
	assert.Equal(t, int64(2), stats.ModelMetadataDeleted)
	assert.Equal(t, int64(5), stats.PricingEntriesDeleted)

	var migratedChannel Channel
	require.NoError(t, db.First(&migratedChannel, channel.Id).Error)
	assert.Equal(t, "gpt-5.6-sol,gpt-5.5,gpt-5.6-luna,gpt-5.4", migratedChannel.Models)
	require.NotNil(t, migratedChannel.TestModel)
	assert.Equal(t, "gpt-5.5", *migratedChannel.TestModel)
	require.NotNil(t, migratedChannel.ModelMapping)
	assert.JSONEq(t, `{"gpt-5.5":"official-base","only":"upstream-only","other":"gpt-5.6-sol"}`, *migratedChannel.ModelMapping)

	var abilityModels []string
	require.NoError(t, db.Model(&Ability{}).Where("channel_id = ?", channel.Id).Order("model ASC").Pluck("model", &abilityModels).Error)
	assert.Equal(t, []string{"gpt-5.4", "gpt-5.5", "gpt-5.6-luna", "gpt-5.6-sol"}, abilityModels)
	var deprecatedAbilityCount int64
	require.NoError(t, db.Model(&Ability{}).Where("model LIKE ?", "%"+constant.DeprecatedOpenAICompactModelSuffix).Count(&deprecatedAbilityCount).Error)
	assert.Zero(t, deprecatedAbilityCount)

	var migratedActiveToken Token
	require.NoError(t, db.First(&migratedActiveToken, activeToken.Id).Error)
	assert.Equal(t, "gpt-5.5,gpt-5.6-luna,gpt-5.4", migratedActiveToken.ModelLimits)
	var migratedDeletedToken Token
	require.NoError(t, db.Unscoped().First(&migratedDeletedToken, deletedToken.Id).Error)
	assert.Equal(t, "gpt-5.6-sol", migratedDeletedToken.ModelLimits)

	var deprecatedMetadataCount int64
	require.NoError(t, db.Unscoped().Model(&Model{}).Where("model_name LIKE ?", "%"+constant.DeprecatedOpenAICompactModelSuffix).Count(&deprecatedMetadataCount).Error)
	assert.Zero(t, deprecatedMetadataCount)
	var baseMetadataCount int64
	require.NoError(t, db.Model(&Model{}).Where("model_name = ?", "gpt-5.5").Count(&baseMetadataCount).Error)
	assert.Equal(t, int64(1), baseMetadataCount)

	assert.JSONEq(t, `{"gpt-5.5":1.25,"unrelated":2}`, requireOptionValue(t, db, "ModelRatio"))
	assert.JSONEq(t, `{"gpt-5.6-sol":0.02}`, requireOptionValue(t, db, "ModelPrice"))
	assert.Equal(t, `not-json`, requireOptionValue(t, db, "CompletionRatio"))
	assert.JSONEq(t, `{"gpt-5.5":"tiered_expr"}`, requireOptionValue(t, db, "billing_setting.billing_mode"))
	assert.JSONEq(t, `{"gpt-5.5":"p * 1"}`, requireOptionValue(t, db, "billing_setting.billing_expr"))

	secondStats, err := MigrateDeprecatedCompactAliases()
	require.NoError(t, err)
	assert.Zero(t, secondStats.TotalChanges())
}

func TestMigrateDeprecatedCompactAliasesRollsBackEveryChangeOnFailure(t *testing.T) {
	db := useDeprecatedCompactAliasMigrationDB(t)
	modelMapping := `{"gpt-5.5-openai-compact":"gpt-5.5-openai-compact"}`
	channel := Channel{
		Type:         constant.ChannelTypeCodex,
		Key:          "rollback-key",
		Status:       common.ChannelStatusEnabled,
		Name:         "rollback-channel",
		Models:       "gpt-5.5-openai-compact,gpt-5.5",
		ModelMapping: &modelMapping,
		Group:        "default",
		CreatedTime:  1,
	}
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(db))
	require.NoError(t, db.Create(&Option{Key: "ModelRatio", Value: `{"gpt-5.5-openai-compact":`}).Error)

	stats, err := MigrateDeprecatedCompactAliases()
	require.Error(t, err)
	assert.Zero(t, stats.TotalChanges())

	var persisted Channel
	require.NoError(t, db.First(&persisted, channel.Id).Error)
	assert.Equal(t, channel.Models, persisted.Models)
	require.NotNil(t, persisted.ModelMapping)
	assert.JSONEq(t, modelMapping, *persisted.ModelMapping)
	var deprecatedAbilityCount int64
	require.NoError(t, db.Model(&Ability{}).Where("model LIKE ?", "%"+constant.DeprecatedOpenAICompactModelSuffix).Count(&deprecatedAbilityCount).Error)
	assert.Equal(t, int64(1), deprecatedAbilityCount)
	assert.Equal(t, `{"gpt-5.5-openai-compact":`, requireOptionValue(t, db, "ModelRatio"))
}

func TestDeprecatedCompactAliasesCannotReenterPersistedConfiguration(t *testing.T) {
	db := useDeprecatedCompactAliasMigrationDB(t)
	modelMapping := `{"gpt-5.5-openai-compact":"upstream-gpt-5.5-openai-compact"}`
	channel := Channel{
		Type:         constant.ChannelTypeOpenAI,
		Key:          "new-channel-key",
		Status:       common.ChannelStatusEnabled,
		Name:         "new-channel",
		Models:       "gpt-5.5-openai-compact,gpt-5.6-sol",
		Group:        "default",
		ModelMapping: &modelMapping,
		CreatedTime:  1,
	}
	require.NoError(t, channel.Insert())
	assert.Equal(t, "gpt-5.5,gpt-5.6-sol", channel.Models)
	require.NotNil(t, channel.ModelMapping)
	assert.JSONEq(t, `{"gpt-5.5":"upstream-gpt-5.5"}`, *channel.ModelMapping)

	var deprecatedAbilityCount int64
	require.NoError(t, db.Model(&Ability{}).Where("model LIKE ?", "%"+constant.DeprecatedOpenAICompactModelSuffix).Count(&deprecatedAbilityCount).Error)
	assert.Zero(t, deprecatedAbilityCount)

	token := Token{UserId: 1, Key: "new-token", ModelLimitsEnabled: true, ModelLimits: "gpt-5.5-openai-compact,gpt-5.6-sol"}
	require.NoError(t, token.Insert())
	assert.Equal(t, "gpt-5.5,gpt-5.6-sol", token.ModelLimits)

	assert.Error(t, validateOptionValue("ModelRatio", `{"gpt-5.5-openai-compact":1}`))
	assert.Error(t, validateOptionValue("billing_setting.billing_expr", `{"gpt-5.5-openai-compact":"p * 1"}`))
	assert.NoError(t, validateOptionValue("ModelRatio", `{"gpt-5.5":1}`))

	assert.Error(t, (&Model{ModelName: "gpt-5.5-openai-compact"}).Insert())
}

func TestBatchInsertChannelsNormalizesDeprecatedCompactAliases(t *testing.T) {
	db := useDeprecatedCompactAliasMigrationDB(t)
	mapping := `{"gpt-5.5-openai-compact":"gpt-5.6-sol-openai-compact"}`
	channels := []Channel{{
		Type:         constant.ChannelTypeOpenAI,
		Key:          "batch-key",
		Status:       common.ChannelStatusEnabled,
		Name:         "batch-channel",
		Models:       "gpt-5.5-openai-compact,gpt-5.6-sol",
		Group:        "default",
		ModelMapping: &mapping,
		CreatedTime:  1,
	}}

	require.NoError(t, BatchInsertChannels(channels))

	var persisted Channel
	require.NoError(t, db.First(&persisted).Error)
	assert.Equal(t, "gpt-5.5,gpt-5.6-sol", persisted.Models)
	require.NotNil(t, persisted.ModelMapping)
	assert.JSONEq(t, `{"gpt-5.5":"gpt-5.6-sol"}`, *persisted.ModelMapping)

	var abilityModels []string
	require.NoError(t, db.Model(&Ability{}).Where("channel_id = ?", persisted.Id).Order("model ASC").Pluck("model", &abilityModels).Error)
	assert.Equal(t, []string{"gpt-5.5", "gpt-5.6-sol"}, abilityModels)
}
