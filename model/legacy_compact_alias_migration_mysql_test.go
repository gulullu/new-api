package model

import (
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

const deprecatedCompactAliasMySQLTestDSNEnv = "NEW_API_COMPACT_ALIAS_MYSQL_TEST_DSN"
const deprecatedCompactAliasPostgresTestDSNEnv = "NEW_API_COMPACT_ALIAS_POSTGRES_TEST_DSN"

func useDeprecatedCompactAliasMigrationMySQLDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv(deprecatedCompactAliasMySQLTestDSNEnv)
	if dsn == "" {
		t.Skip("set " + deprecatedCompactAliasMySQLTestDSNEnv + " to run the MySQL 8 integration test")
	}

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{TablePrefix: "compact_alias_p0_test_"},
	})
	require.NoError(t, err)
	require.NoError(t, db.Migrator().DropTable(&Channel{}, &Ability{}, &Token{}, &Model{}, &Option{}))
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}, &Token{}, &Model{}, &Option{}))

	previousDB := DB
	previousType := common.MainDatabaseType()
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeMySQL)
	initCol()
	t.Cleanup(func() {
		assert.NoError(t, db.Migrator().DropTable(&Channel{}, &Ability{}, &Token{}, &Model{}, &Option{}))
		if sqlDB, sqlErr := db.DB(); sqlErr == nil {
			assert.NoError(t, sqlDB.Close())
		}
		DB = previousDB
		common.SetMainDatabaseType(previousType)
		initCol()
	})
	return db
}

func useDeprecatedCompactAliasMigrationPostgresDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv(deprecatedCompactAliasPostgresTestDSNEnv)
	if dsn == "" {
		t.Skip("set " + deprecatedCompactAliasPostgresTestDSNEnv + " to run the PostgreSQL integration test")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{TablePrefix: "compact_alias_p0_test_"},
	})
	require.NoError(t, err)
	require.NoError(t, db.Migrator().DropTable(&Channel{}, &Ability{}, &Token{}, &Model{}, &Option{}))
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}, &Token{}, &Model{}, &Option{}))

	previousDB := DB
	previousType := common.MainDatabaseType()
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypePostgreSQL)
	initCol()
	t.Cleanup(func() {
		assert.NoError(t, db.Migrator().DropTable(&Channel{}, &Ability{}, &Token{}, &Model{}, &Option{}))
		if sqlDB, sqlErr := db.DB(); sqlErr == nil {
			assert.NoError(t, sqlDB.Close())
		}
		DB = previousDB
		common.SetMainDatabaseType(previousType)
		initCol()
	})
	return db
}

func TestMigrateDeprecatedCompactAliasesMySQL8FirstRunSecondRunAndRollback(t *testing.T) {
	runDeprecatedCompactAliasRelationalMigrationContract(t, useDeprecatedCompactAliasMigrationMySQLDB(t))
}

func TestMigrateDeprecatedCompactAliasesPostgresFirstRunSecondRunAndRollback(t *testing.T) {
	runDeprecatedCompactAliasRelationalMigrationContract(t, useDeprecatedCompactAliasMigrationPostgresDB(t))
}

func runDeprecatedCompactAliasRelationalMigrationContract(t *testing.T, db *gorm.DB) {
	t.Helper()
	mapping := `{"gpt-5.5-openai-compact":"gpt-5.5-openai-compact"}`
	channel := Channel{
		Type:         constant.ChannelTypeCodex,
		Key:          "mysql-first-run-key",
		Status:       common.ChannelStatusEnabled,
		Name:         "mysql-first-run-channel",
		Models:       "gpt-5.5-openai-compact,gpt-5.5",
		Group:        "default",
		ModelMapping: &mapping,
		CreatedTime:  1,
	}
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(db))
	token := Token{
		UserId:             1,
		Key:                "mysql-token",
		ModelLimitsEnabled: true,
		ModelLimits:        "gpt-5.6-sol-openai-compact",
	}
	require.NoError(t, db.Create(&token).Error)
	require.NoError(t, db.Create(&Model{ModelName: "gpt-5.5-openai-compact", Status: 1}).Error)
	require.NoError(t, db.Create(&Option{
		Key:   "ModelRatio",
		Value: `{"gpt-5.5":1,"gpt-5.5-openai-compact":9}`,
	}).Error)

	firstStats, err := MigrateDeprecatedCompactAliases()
	require.NoError(t, err)
	assert.Equal(t, int64(1), firstStats.ChannelsUpdated)
	assert.Equal(t, int64(1), firstStats.ChannelMappingsUpdated)
	assert.Equal(t, int64(1), firstStats.TokensUpdated)
	assert.Equal(t, int64(1), firstStats.AbilitiesDeleted)
	assert.Equal(t, int64(1), firstStats.ModelMetadataDeleted)
	assert.Equal(t, int64(1), firstStats.PricingEntriesDeleted)

	var firstChannel Channel
	require.NoError(t, db.First(&firstChannel, channel.Id).Error)
	assert.Equal(t, "gpt-5.5", firstChannel.Models)
	require.NotNil(t, firstChannel.ModelMapping)
	assert.JSONEq(t, `{"gpt-5.5":"gpt-5.5"}`, *firstChannel.ModelMapping)
	assert.JSONEq(t, `{"gpt-5.5":1}`, requireOptionValue(t, db, "ModelRatio"))

	secondStats, err := MigrateDeprecatedCompactAliases()
	require.NoError(t, err)
	assert.Zero(t, secondStats.TotalChanges())

	rollbackMapping := `{"gpt-5.6-sol-openai-compact":"gpt-5.6-sol-openai-compact"}`
	rollbackChannel := Channel{
		Type:         constant.ChannelTypeCodex,
		Key:          "mysql-rollback-key",
		Status:       common.ChannelStatusEnabled,
		Name:         "mysql-rollback-channel",
		Models:       "gpt-5.6-sol-openai-compact",
		Group:        "default",
		ModelMapping: &rollbackMapping,
		CreatedTime:  1,
	}
	require.NoError(t, db.Create(&rollbackChannel).Error)
	require.NoError(t, rollbackChannel.AddAbilities(db))
	require.NoError(t, db.Model(&Option{}).
		Where(commonKeyCol+" = ?", "ModelRatio").
		Update("value", `{"gpt-5.6-sol-openai-compact":`).Error)

	rollbackStats, err := MigrateDeprecatedCompactAliases()
	require.Error(t, err)
	assert.Zero(t, rollbackStats.TotalChanges())

	var persistedRollbackChannel Channel
	require.NoError(t, db.First(&persistedRollbackChannel, rollbackChannel.Id).Error)
	assert.Equal(t, rollbackChannel.Models, persistedRollbackChannel.Models)
	require.NotNil(t, persistedRollbackChannel.ModelMapping)
	assert.JSONEq(t, rollbackMapping, *persistedRollbackChannel.ModelMapping)
	var rollbackAliasAbilityCount int64
	require.NoError(t, db.Model(&Ability{}).
		Where("channel_id = ? AND model = ?", rollbackChannel.Id, "gpt-5.6-sol-openai-compact").
		Count(&rollbackAliasAbilityCount).Error)
	assert.Equal(t, int64(1), rollbackAliasAbilityCount)
	assert.Equal(t, `{"gpt-5.6-sol-openai-compact":`, requireOptionValue(t, db, "ModelRatio"))
}
