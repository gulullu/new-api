package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestBatchUpdateTokenGroupCache(t *testing.T) {
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { DB = previousDB; _ = sqlDB.Close() })
	DB = db
	require.NoError(t, db.AutoMigrate(&Token{}))
	redis := useUserCacheMiniRedis(t)
	token := Token{UserId: 7, Key: "batch-cache-test", Name: "cache", Group: "auto", AutoGroups: `["vip"]`, CrossGroupRetry: true, RemainQuota: 100}
	require.NoError(t, db.Create(&token).Error)
	require.NoError(t, cacheSetTokenForTest(token))
	count, err := BatchUpdateTokenGroup([]int{token.Id}, 7, "default")
	require.NoError(t, err)
	assert.Equal(t, 1, count)
	_, err = cacheGetTokenByKey(token.Key)
	require.Error(t, err)
	assert.True(t, redis.Exists(getTokenCacheFenceKey(token.Key)))
	updated, err := GetTokenByKey(token.Key, false)
	require.NoError(t, err)
	assert.Equal(t, "default", updated.Group)
	assert.Empty(t, updated.AutoGroups)
	assert.False(t, updated.CrossGroupRetry)
	redis.Close()
	count, err = BatchUpdateTokenGroup([]int{token.Id}, 7, "vip")
	require.Error(t, err)
	assert.Zero(t, count)
	require.NoError(t, db.First(&token, token.Id).Error)
	assert.Equal(t, "default", token.Group, "cache failure must abort the database mutation")
}
