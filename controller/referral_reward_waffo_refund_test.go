package controller

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/waffo-com/waffo-go/core"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupReferralRefundControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousMainDatabaseType, previousLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	common.RedisEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB, model.LOG_DB = db, db
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}, &model.ReferralPaymentState{}, &model.ReferralRewardClaim{}))

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func seedReferralRefundClaim(t *testing.T, db *gorm.DB, provider string, tradeNo string, gatewayReference string) (*model.User, *model.ReferralRewardClaim) {
	t.Helper()
	const rewardQuota = 30_000
	inviter := &model.User{
		Username:        "refund-inviter-" + provider,
		AffCode:         "refund-inviter-code-" + provider,
		Status:          common.UserStatusEnabled,
		AffQuota:        rewardQuota,
		AffHistoryQuota: rewardQuota,
		AffCount:        1,
	}
	require.NoError(t, db.Create(inviter).Error)
	invitee := &model.User{
		Username:  "refund-invitee-" + provider,
		AffCode:   "refund-invitee-code-" + provider,
		Status:    common.UserStatusEnabled,
		InviterId: inviter.Id,
	}
	require.NoError(t, db.Create(invitee).Error)

	claim := &model.ReferralRewardClaim{
		InviteeId:        invitee.Id,
		InviterId:        inviter.Id,
		TopUpId:          invitee.Id + 10_000,
		TradeNo:          tradeNo,
		PaymentProvider:  provider,
		PaidAmount:       "100",
		PaidCurrency:     "CNY",
		RateBasisPoints:  model.ReferralRewardBasisPoints,
		RewardQuota:      rewardQuota,
		Status:           model.ReferralRewardStatusAwarded,
		GatewayEventId:   gatewayReference,
		GatewayPaymentId: "gateway-payment-" + provider,
	}
	require.NoError(t, db.Create(claim).Error)
	return inviter, claim
}

func TestWaffoTerminalRefundReversesReferralRewardOnce(t *testing.T) {
	for _, status := range []string{core.RefundStatusPartiallyRefunded, core.RefundStatusFullyRefunded} {
		t.Run(status, func(t *testing.T) {
			db := setupReferralRefundControllerTestDB(t)
			inviter, claim := seedReferralRefundClaim(t, db, model.PaymentProviderWaffo, "waffo-refund-trade", "waffo-original-payment-request")

			result := &core.RefundNotificationResult{
				RefundRequestID:      "waffo-refund-request",
				OrigPaymentRequestID: "waffo-original-payment-request",
				RefundStatus:         status,
				RefundReason:         "buyer requested",
			}
			outcome, err := reverseWaffoReferralReward(result, true)
			require.NoError(t, err)
			assert.True(t, outcome.Changed)
			assert.Equal(t, claim.Id, outcome.ClaimId)

			var updatedClaim model.ReferralRewardClaim
			require.NoError(t, db.First(&updatedClaim, claim.Id).Error)
			assert.Equal(t, model.ReferralRewardStatusReversed, updatedClaim.Status)
			assert.Equal(t, "waffo-refund-request", updatedClaim.ReversalEventId)
			assert.Contains(t, updatedClaim.ReversalReason, status)

			var updatedInviter model.User
			require.NoError(t, db.First(&updatedInviter, inviter.Id).Error)
			assert.Zero(t, updatedInviter.AffQuota)
			assert.Zero(t, updatedInviter.AffHistoryQuota)
			assert.Zero(t, updatedInviter.AffCount)

			duplicate, err := reverseWaffoReferralReward(result, true)
			require.NoError(t, err)
			assert.False(t, duplicate.Changed)
		})
	}
}

func TestWaffoNonProductionAndIncompleteRefundsDoNotReverseReferralReward(t *testing.T) {
	db := setupReferralRefundControllerTestDB(t)
	_, claim := seedReferralRefundClaim(t, db, model.PaymentProviderWaffo, "waffo-ignored-refund-trade", "waffo-ignored-payment-request")

	terminalSandbox := &core.RefundNotificationResult{
		RefundRequestID:      "waffo-sandbox-refund",
		OrigPaymentRequestID: "waffo-ignored-payment-request",
		RefundStatus:         core.RefundStatusFullyRefunded,
	}
	outcome, err := reverseWaffoReferralReward(terminalSandbox, false)
	require.NoError(t, err)
	assert.False(t, outcome.Changed)

	inProgressProduction := &core.RefundNotificationResult{
		RefundRequestID:      "waffo-pending-refund",
		OrigPaymentRequestID: "waffo-ignored-payment-request",
		RefundStatus:         core.RefundStatusInProgress,
	}
	outcome, err = reverseWaffoReferralReward(inProgressProduction, true)
	require.NoError(t, err)
	assert.False(t, outcome.Changed)

	var unchanged model.ReferralRewardClaim
	require.NoError(t, db.First(&unchanged, claim.Id).Error)
	assert.Equal(t, model.ReferralRewardStatusAwarded, unchanged.Status)
}

func TestWaffoPancakeProductionRefundUsesTradeNumberAndIsIdempotent(t *testing.T) {
	db := setupReferralRefundControllerTestDB(t)
	inviter, claim := seedReferralRefundClaim(t, db, model.PaymentProviderWaffoPancake, "WAFFO_PANCAKE-refund-trade", "pancake-payment-event")

	sandbox, err := reverseWaffoPancakeReferralReward(claim.TradeNo, "pancake-test-refund", false)
	require.NoError(t, err)
	assert.False(t, sandbox.Changed)

	production, err := reverseWaffoPancakeReferralReward(claim.TradeNo, "pancake-prod-refund", true)
	require.NoError(t, err)
	assert.True(t, production.Changed)
	assert.Equal(t, claim.Id, production.ClaimId)

	var updatedClaim model.ReferralRewardClaim
	require.NoError(t, db.First(&updatedClaim, claim.Id).Error)
	assert.Equal(t, model.ReferralRewardStatusReversed, updatedClaim.Status)
	assert.Equal(t, "pancake-prod-refund", updatedClaim.ReversalEventId)

	var updatedInviter model.User
	require.NoError(t, db.First(&updatedInviter, inviter.Id).Error)
	assert.Zero(t, updatedInviter.AffQuota)
	assert.Zero(t, updatedInviter.AffHistoryQuota)
	assert.Zero(t, updatedInviter.AffCount)

	duplicate, err := reverseWaffoPancakeReferralReward(claim.TradeNo, "pancake-prod-refund", true)
	require.NoError(t, err)
	assert.False(t, duplicate.Changed)
}
