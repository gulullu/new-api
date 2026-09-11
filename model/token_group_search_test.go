package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSearchUserTokensGroup(t *testing.T) {
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})
	DB = db
	require.NoError(t, db.AutoMigrate(&Token{}))
	fixtures := []Token{
		{Id: 1, UserId: 1, Key: "alpha", Name: "first", Group: "vip"},
		{Id: 2, UserId: 1, Key: "beta", Name: "second", Group: "vip"},
		{Id: 3, UserId: 1, Key: "gamma", Name: "other", Group: "default"},
		{Id: 4, UserId: 2, Key: "delta", Name: "other-user", Group: "vip"},
		{Id: 5, UserId: 1, Key: "epsilon", Name: "automatic", Group: "auto"},
		{Id: 6, UserId: 1, Key: "zeta", Name: "literal", Group: "vip_%"},
	}
	require.NoError(t, db.Create(&fixtures).Error)
	for _, tc := range []struct {
		name, group, keyword, token string
		offset, limit               int
		total                       int64
		ids                         []int
	}{
		{name: "group first page", group: "vip", limit: 1, total: 2, ids: []int{2}},
		{name: "group second page", group: "vip", offset: 1, limit: 1, total: 2, ids: []int{1}},
		{name: "combined name", group: "vip", keyword: "first", limit: 20, total: 1, ids: []int{1}},
		{name: "combined key", group: "vip", token: "sk-beta", limit: 20, total: 1, ids: []int{2}},
		{name: "empty group results", group: "missing", limit: 20, ids: []int{}},
		{name: "auto group", group: "auto", limit: 20, total: 1, ids: []int{5}},
		{name: "literal group", group: "vip_%", limit: 20, total: 1, ids: []int{6}},
		{name: "cleared filter", limit: 20, total: 5, ids: []int{6, 5, 3, 2, 1}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tokens, total, err := SearchUserTokens(1, tc.keyword, tc.token, tc.group, tc.offset, tc.limit)
			require.NoError(t, err)
			assert.Equal(t, tc.total, total)
			ids := make([]int, 0, len(tokens))
			for _, token := range tokens {
				ids = append(ids, token.Id)
			}
			assert.Equal(t, tc.ids, ids)
		})
	}
}
