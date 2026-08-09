package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertUsersForPaginationTest(t *testing.T, total int) {
	t.Helper()
	for id := 1; id <= total; id++ {
		user := &User{
			Id:          id,
			Username:    fmt.Sprintf("user%02d", id),
			Password:    "password123",
			DisplayName: fmt.Sprintf("User %02d", id),
			Email:       fmt.Sprintf("user%02d@example.com", id),
			Role:        common.RoleCommonUser,
			Status:      common.UserStatusEnabled,
			Group:       "default",
			AffCode:     fmt.Sprintf("aff%02d", id),
		}
		require.NoError(t, DB.Create(user).Error)
	}
}

func collectUserIDs(users []*User) []int {
	ids := make([]int, 0, len(users))
	for _, user := range users {
		ids = append(ids, user.Id)
	}
	return ids
}

func TestGetAllUsersSortsBeforePagination(t *testing.T) {
	truncateTables(t)
	insertUsersForPaginationTest(t, 42)

	pageOne, total, err := GetAllUsers(&common.PageInfo{Page: 1, PageSize: 20}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20}, collectUserIDs(pageOne))

	pageTwo, total, err := GetAllUsers(&common.PageInfo{Page: 2, PageSize: 20}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40}, collectUserIDs(pageTwo))

	pageThree, total, err := GetAllUsers(&common.PageInfo{Page: 3, PageSize: 20}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{41, 42}, collectUserIDs(pageThree))
}

func TestSearchUsersSortsBeforePagination(t *testing.T) {
	truncateTables(t)
	insertUsersForPaginationTest(t, 42)

	users, total, err := SearchUsers("user", "", nil, nil, 20, 20, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(42), total)
	assert.Equal(t, []int{21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40}, collectUserIDs(users))
}

func TestUserAdminQueriesProjectQualifiedPaymentsFromReferralLedger(t *testing.T) {
	truncateTables(t)
	insertUsersForPaginationTest(t, 3)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", 1).Update("aff_count", 12).Error)

	claims := []ReferralRewardClaim{
		{InviterId: 1, InviteeId: 101, TopUpId: 1001, TradeNo: "qualified-awarded", Status: ReferralRewardStatusAwarded},
		{InviterId: 1, InviteeId: 102, TopUpId: 1002, TradeNo: "qualified-withheld", Status: ReferralRewardStatusWithheld},
		{InviterId: 1, InviteeId: 103, TopUpId: 1003, TradeNo: "unqualified-reversed", Status: ReferralRewardStatusReversed},
		{InviterId: 2, InviteeId: 104, TopUpId: 1004, TradeNo: "second-inviter-awarded", Status: ReferralRewardStatusAwarded},
	}
	require.NoError(t, DB.Create(&claims).Error)

	users, total, err := GetAllUsers(&common.PageInfo{Page: 1, PageSize: 3}, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
	require.Len(t, users, 3)
	assert.Equal(t, 12, users[0].AffCount)
	assert.Equal(t, int64(2), users[0].QualifiedReferralPayments)
	assert.Equal(t, int64(1), users[1].QualifiedReferralPayments)
	assert.Zero(t, users[2].QualifiedReferralPayments)

	searchResults, total, err := SearchUsers("user01", "", nil, nil, 0, 20, NewUserSortOptions("id", "asc"))
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, searchResults, 1)
	assert.Equal(t, int64(2), searchResults[0].QualifiedReferralPayments)

	user, err := GetUserByIdWithQualifiedReferralPayments(1, false)
	require.NoError(t, err)
	assert.Equal(t, int64(2), user.QualifiedReferralPayments)
}
