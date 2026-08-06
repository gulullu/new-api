package model

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminReferralRewardDashboardProvidesGlobalSummaryAndSafeFilteredLedger(t *testing.T) {
	truncateTables(t)
	createReferralRewardUsers(t, 6101, 6102)
	createReferralRewardUsers(t, 6103, 6104)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", 6101).Updates(map[string]interface{}{
		"username": "private-admin-inviter",
		"email":    "private-inviter@example.com",
	}).Error)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", 6102).Updates(map[string]interface{}{
		"username": "private-admin-invitee",
		"email":    "private-invitee@example.com",
	}).Error)

	claims := []ReferralRewardClaim{
		{
			InviteeId:        6102,
			InviterId:        6101,
			TopUpId:          8101,
			TradeNo:          "admin-private-trade-1",
			PaymentProvider:  PaymentProviderStripe,
			PaidAmount:       "20",
			PaidCurrency:     "CNY",
			RateBasisPoints:  ReferralRewardBasisPoints,
			RewardQuota:      300000,
			Status:           ReferralRewardStatusAwarded,
			GatewayEventId:   "admin-private-event-1",
			GatewayPaymentId: "admin-private-payment-1",
			CreatedAt:        100,
		},
		{
			InviteeId:        6104,
			InviterId:        6103,
			TopUpId:          8102,
			TradeNo:          "admin-private-trade-2",
			PaymentProvider:  PaymentProviderWaffo,
			PaidAmount:       "50",
			PaidCurrency:     "USD",
			RateBasisPoints:  ReferralRewardBasisPoints,
			RewardQuota:      750000,
			Status:           ReferralRewardStatusWithheld,
			GatewayEventId:   "admin-private-event-2",
			GatewayPaymentId: "admin-private-payment-2",
			CreatedAt:        200,
		},
	}
	for i := range claims {
		require.NoError(t, DB.Create(&claims[i]).Error)
	}

	reversedInvitee := User{
		Id:        6105,
		Username:  "reversed-private-invitee",
		Email:     "reversed@example.com",
		AffCode:   "re6105",
		Status:    common.UserStatusEnabled,
		InviterId: 6101,
	}
	require.NoError(t, DB.Create(&reversedInvitee).Error)
	require.NoError(t, DB.Create(&ReferralRewardClaim{
		InviteeId:        6105,
		InviterId:        6101,
		TopUpId:          8103,
		TradeNo:          "admin-private-trade-3",
		PaymentProvider:  PaymentProviderStripe,
		PaidAmount:       "100",
		PaidCurrency:     "CNY",
		RateBasisPoints:  ReferralRewardBasisPoints,
		RewardQuota:      1500000,
		ReversedQuota:    1500000,
		Status:           ReferralRewardStatusReversed,
		GatewayEventId:   "admin-private-event-3",
		GatewayPaymentId: "admin-private-payment-3",
		ReversalEventId:  "admin-private-reversal-event",
		ReversalReason:   "verified refund",
		ReversedAt:       350,
		CreatedAt:        300,
	}).Error)

	pageInfo := &common.PageInfo{Page: 1, PageSize: 20}
	items, total, summary, err := GetAdminReferralRewardDashboard(AdminReferralRewardFilter{
		Keyword:  "6101",
		Provider: PaymentProviderStripe,
		Status:   ReferralRewardStatusAwarded,
	}, pageInfo)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, 6101, items[0].InviterId)
	assert.Equal(t, 6102, items[0].InviteeId)
	assert.Equal(t, "p***r", items[0].InviterLabel)
	assert.Equal(t, "p***e", items[0].InviteeLabel)

	assert.Equal(t, int64(3), summary.TotalRecords)
	assert.Equal(t, int64(1), summary.AwardedRecords)
	assert.Equal(t, int64(1), summary.WithheldRecords)
	assert.Equal(t, int64(1), summary.ReversedRecords)
	assert.Equal(t, int64(1800000), summary.AwardedRewardQuota)
	assert.Equal(t, int64(300000), summary.ActiveRewardQuota)
	assert.Equal(t, int64(1500000), summary.ReversedRewardQuota)
	assert.Equal(t, int64(2), summary.UniqueInviters)
	assert.Equal(t, int64(3), summary.UniqueInvitees)

	encoded, err := json.Marshal(items)
	require.NoError(t, err)
	response := string(encoded)
	for _, forbidden := range []string{
		"private-admin-inviter",
		"private-inviter@example.com",
		"private-admin-invitee",
		"private-invitee@example.com",
		"trade_no",
		"top_up_id",
		"gateway_event_id",
		"gateway_payment_id",
		"admin-private-trade",
		"admin-private-event",
		"admin-private-payment",
	} {
		assert.NotContains(t, response, forbidden)
	}
}

func TestAdminReferralRewardDashboardValidatesFilters(t *testing.T) {
	truncateTables(t)
	pageInfo := &common.PageInfo{Page: 1, PageSize: 20}

	_, _, _, err := GetAdminReferralRewardDashboard(AdminReferralRewardFilter{Status: "pending"}, pageInfo)
	require.ErrorContains(t, err, "invalid referral reward status")

	_, _, _, err = GetAdminReferralRewardDashboard(AdminReferralRewardFilter{Provider: "unknown-gateway"}, pageInfo)
	require.ErrorContains(t, err, "invalid referral payment provider")

	_, _, _, err = GetAdminReferralRewardDashboard(AdminReferralRewardFilter{Keyword: strings.Repeat("x", adminReferralSearchMaxLength+1)}, pageInfo)
	require.ErrorContains(t, err, "search is too long")
}

func TestAdminReferralRewardDashboardNormalizesInvalidPagination(t *testing.T) {
	truncateTables(t)
	createReferralRewardUsers(t, 6201, 6202)
	require.NoError(t, DB.Create(&ReferralRewardClaim{
		InviteeId:       6202,
		InviterId:       6201,
		TopUpId:         8201,
		TradeNo:         "pagination-guard-trade",
		PaymentProvider: PaymentProviderStripe,
		PaidAmount:      "20",
		PaidCurrency:    "CNY",
		RateBasisPoints: ReferralRewardBasisPoints,
		RewardQuota:     300000,
		Status:          ReferralRewardStatusAwarded,
	}).Error)

	items, total, _, err := GetAdminReferralRewardDashboard(
		AdminReferralRewardFilter{},
		&common.PageInfo{Page: -10, PageSize: -1},
	)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
}
