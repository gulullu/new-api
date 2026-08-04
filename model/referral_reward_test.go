package model

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func createReferralRewardUsers(t *testing.T, inviterID int, inviteeID int) {
	t.Helper()
	require.NoError(t, DB.Create(&User{
		Id:       inviterID,
		Username: fmt.Sprintf("reward-inviter-%d", inviterID),
		AffCode:  fmt.Sprintf("ri%d", inviterID),
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id:        inviteeID,
		Username:  fmt.Sprintf("reward-invitee-%d", inviteeID),
		AffCode:   fmt.Sprintf("re%d", inviteeID),
		Status:    common.UserStatusEnabled,
		InviterId: inviterID,
	}).Error)
}

func createReferralTopUp(t *testing.T, inviteeID int, tradeNo string, provider string, status string) *TopUp {
	t.Helper()
	topUp := &TopUp{
		UserId:          inviteeID,
		Amount:          100,
		Money:           100,
		TradeNo:         tradeNo,
		PaymentMethod:   provider,
		PaymentProvider: provider,
		CreateTime:      common.GetTimestamp(),
		Status:          status,
	}
	require.NoError(t, DB.Create(topUp).Error)
	return topUp
}

func expectedReferralRewardQuota(t *testing.T, paidAmount string) int {
	t.Helper()
	paid, err := decimal.NewFromString(paidAmount)
	require.NoError(t, err)
	quota, clamp := common.QuotaFromDecimalChecked(paid.
		Mul(decimal.NewFromInt(ReferralRewardBasisPoints)).
		Div(decimal.NewFromInt(10000)).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Floor())
	require.Nil(t, clamp)
	return quota
}

func completeReferralTopUp(t *testing.T, topUp *TopUp, payment VerifiedPayment) {
	t.Helper()
	switch topUp.PaymentProvider {
	case PaymentProviderEpay:
		require.NoError(t, RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1", payment))
	case PaymentProviderStripe:
		require.NoError(t, Recharge(topUp.TradeNo, "customer-refund-before-payment", "127.0.0.1", payment))
	case PaymentProviderCreem:
		require.NoError(t, RechargeCreem(topUp.TradeNo, "", "", "127.0.0.1", payment))
	case PaymentProviderWaffo:
		require.NoError(t, RechargeWaffo(topUp.TradeNo, "127.0.0.1", payment))
	case PaymentProviderWaffoPancake:
		require.NoError(t, RechargeWaffoPancake(topUp.TradeNo, "127.0.0.1", payment))
	default:
		t.Fatalf("unsupported referral payment provider %q", topUp.PaymentProvider)
	}
}

func TestReferralRewardCanonicalPaymentReferences(t *testing.T) {
	tests := []struct {
		name      string
		provider  string
		tradeNo   string
		payment   VerifiedPayment
		wantKind  string
		wantValue string
	}{
		{
			name:      "epay gateway payment id",
			provider:  PaymentProviderEpay,
			tradeNo:   "epay-local-trade",
			payment:   VerifiedPayment{GatewayEventId: "epay-event", GatewayPaymentId: " epay-gateway-ref "},
			wantKind:  referralPaymentReferenceGateway,
			wantValue: "epay-gateway-ref",
		},
		{
			name:      "stripe payment intent",
			provider:  PaymentProviderStripe,
			tradeNo:   "stripe-local-trade",
			payment:   VerifiedPayment{GatewayEventId: "stripe-event", GatewayPaymentId: " pi_canonical "},
			wantKind:  referralPaymentReferenceGateway,
			wantValue: "pi_canonical",
		},
		{
			name:      "creem transaction",
			provider:  PaymentProviderCreem,
			tradeNo:   "creem-local-trade",
			payment:   VerifiedPayment{GatewayEventId: "creem-event", GatewayPaymentId: " creem-transaction "},
			wantKind:  referralPaymentReferenceGateway,
			wantValue: "creem-transaction",
		},
		{
			name:      "waffo original payment request",
			provider:  PaymentProviderWaffo,
			tradeNo:   "waffo-local-trade",
			payment:   VerifiedPayment{GatewayEventId: " waffo-payment-request ", GatewayPaymentId: "waffo-acquiring-order"},
			wantKind:  referralPaymentReferenceGateway,
			wantValue: "waffo-payment-request",
		},
		{
			name:      "waffo pancake merchant trade",
			provider:  PaymentProviderWaffoPancake,
			tradeNo:   " pancake-merchant-trade ",
			payment:   VerifiedPayment{GatewayEventId: "pancake-event", GatewayPaymentId: "pancake-payment"},
			wantKind:  referralPaymentReferenceTrade,
			wantValue: "pancake-merchant-trade",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			kind, value, ok := referralRewardGrantReference(&TopUp{
				PaymentProvider: test.provider,
				TradeNo:         test.tradeNo,
			}, test.payment)
			require.True(t, ok)
			assert.Equal(t, test.wantKind, kind)
			assert.Equal(t, test.wantValue, value)

			digest, err := referralPaymentReferenceDigest(test.provider, kind, "  "+value+"  ")
			require.NoError(t, err)
			assert.Len(t, digest, 64)
			assert.NotContains(t, digest, value)
		})
	}
}

func TestRefundBeforePaymentPreventsReferralRewardAcrossProviders(t *testing.T) {
	tests := []struct {
		name      string
		provider  string
		tradeNo   string
		eventID   string
		paymentID string
		reverse   func(string, string) (ReferralRewardReversalResult, error)
	}{
		{
			name:      "epay",
			provider:  PaymentProviderEpay,
			tradeNo:   "refund-first-epay-trade",
			eventID:   "refund-first-epay-event",
			paymentID: "refund-first-epay-gateway",
			reverse: func(_ string, paymentID string) (ReferralRewardReversalResult, error) {
				return ReverseReferralRewardByGatewayReference(PaymentProviderEpay, paymentID, "epay-refund-first", "refund first")
			},
		},
		{
			name:      "stripe",
			provider:  PaymentProviderStripe,
			tradeNo:   "refund-first-stripe-trade",
			eventID:   "refund-first-stripe-event",
			paymentID: "pi_refund_first",
			reverse: func(_ string, paymentID string) (ReferralRewardReversalResult, error) {
				return ReverseReferralRewardByGatewayReference(PaymentProviderStripe, paymentID, "stripe-refund-first", "refund first")
			},
		},
		{
			name:      "creem",
			provider:  PaymentProviderCreem,
			tradeNo:   "refund-first-creem-trade",
			eventID:   "refund-first-creem-event",
			paymentID: "creem-refund-first-transaction",
			reverse: func(_ string, paymentID string) (ReferralRewardReversalResult, error) {
				return ReverseReferralRewardByGatewayReference(PaymentProviderCreem, paymentID, "creem-refund-first", "refund first")
			},
		},
		{
			name:      "waffo",
			provider:  PaymentProviderWaffo,
			tradeNo:   "refund-first-waffo-trade",
			eventID:   "waffo-refund-first-payment-request",
			paymentID: "waffo-refund-first-acquiring-order",
			reverse: func(_ string, _ string) (ReferralRewardReversalResult, error) {
				return ReverseReferralRewardByGatewayReference(PaymentProviderWaffo, "waffo-refund-first-payment-request", "waffo-refund-first", "refund first")
			},
		},
		{
			name:      "waffo pancake",
			provider:  PaymentProviderWaffoPancake,
			tradeNo:   "refund-first-pancake-trade",
			eventID:   "refund-first-pancake-event",
			paymentID: "refund-first-pancake-payment",
			reverse: func(tradeNo string, _ string) (ReferralRewardReversalResult, error) {
				return ReverseReferralRewardByTradeNo(PaymentProviderWaffoPancake, tradeNo, "pancake-refund-first", "refund first")
			},
		},
	}

	for index, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			truncateTables(t)
			inviterID := 50000 + index*10 + 1
			inviteeID := inviterID + 1
			createReferralRewardUsers(t, inviterID, inviteeID)
			topUp := createReferralTopUp(t, inviteeID, test.tradeNo, test.provider, common.TopUpStatusPending)
			payment, err := NewVerifiedPayment("90", "CNY", test.eventID, test.paymentID, true)
			require.NoError(t, err)

			firstRefund, err := test.reverse(test.tradeNo, test.paymentID)
			require.NoError(t, err)
			assert.False(t, firstRefund.Changed)
			duplicateRefund, err := test.reverse("  "+test.tradeNo+"  ", "  "+test.paymentID+"  ")
			require.NoError(t, err)
			assert.False(t, duplicateRefund.Changed)

			completeReferralTopUp(t, topUp, payment)

			var storedTopUp TopUp
			require.NoError(t, DB.First(&storedTopUp, topUp.Id).Error)
			assert.Equal(t, common.TopUpStatusSuccess, storedTopUp.Status)
			var inviter User
			require.NoError(t, DB.First(&inviter, inviterID).Error)
			assert.Zero(t, inviter.AffCount)
			assert.Zero(t, inviter.AffQuota)
			assert.Zero(t, inviter.AffHistoryQuota)

			var claimCount int64
			require.NoError(t, DB.Model(&ReferralRewardClaim{}).Where("invitee_id = ?", inviteeID).Count(&claimCount).Error)
			assert.Zero(t, claimCount)
			var states []ReferralPaymentState
			require.NoError(t, DB.Find(&states).Error)
			require.Len(t, states, 1)
			assert.Positive(t, states[0].RefundedAt)
			assert.Len(t, states[0].ReferenceDigest, 64)
			assert.NotContains(t, states[0].ReferenceDigest, strings.TrimSpace(test.tradeNo))
			assert.NotContains(t, states[0].ReferenceDigest, strings.TrimSpace(test.paymentID))
		})
	}
}

func TestMissingCanonicalReferenceSkipsRewardWithoutFailingTopUp(t *testing.T) {
	truncateTables(t)
	createReferralRewardUsers(t, 50991, 50992)
	topUp := createReferralTopUp(t, 50992, "missing-canonical-reference", PaymentProviderStripe, common.TopUpStatusPending)
	payment, err := NewVerifiedPayment("90", "CNY", "stripe-event-without-payment-intent", "", true)
	require.NoError(t, err)

	completeReferralTopUp(t, topUp, payment)

	var stored TopUp
	require.NoError(t, DB.First(&stored, topUp.Id).Error)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
	var inviter User
	require.NoError(t, DB.First(&inviter, 50991).Error)
	assert.Zero(t, inviter.AffCount)
	var claimCount int64
	require.NoError(t, DB.Model(&ReferralRewardClaim{}).Count(&claimCount).Error)
	assert.Zero(t, claimCount)
}

func TestFirstPaidReferralRewardUsesVerifiedAmountAndIsIdempotent(t *testing.T) {
	truncateTables(t)
	createReferralRewardUsers(t, 5101, 5102)
	topUp := createReferralTopUp(t, 5102, "reward-first-real-payment", PaymentProviderEpay, common.TopUpStatusPending)

	// The order's local estimate is 100, but the signed provider callback says
	// 90 after discounts. Only 90 may be used for the 3% reward.
	payment, err := NewVerifiedPayment("90", "cny", "epay-event-1", "epay-payment-1", true)
	require.NoError(t, err)
	require.NoError(t, RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1", payment))

	wantReward := expectedReferralRewardQuota(t, "90")
	var inviter User
	require.NoError(t, DB.First(&inviter, 5101).Error)
	assert.Equal(t, 1, inviter.AffCount)
	assert.Equal(t, wantReward, inviter.AffQuota)
	assert.Equal(t, wantReward, inviter.AffHistoryQuota)

	var claim ReferralRewardClaim
	require.NoError(t, DB.Where("invitee_id = ?", 5102).First(&claim).Error)
	assert.Equal(t, "90", claim.PaidAmount)
	assert.Equal(t, "CNY", claim.PaidCurrency)
	assert.Equal(t, wantReward, claim.RewardQuota)
	assert.Equal(t, ReferralRewardBasisPoints, claim.RateBasisPoints)

	// A duplicate callback must not credit either the buyer or inviter again.
	var inviteeBefore User
	require.NoError(t, DB.First(&inviteeBefore, 5102).Error)
	require.NoError(t, RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1", payment))
	var inviteeAfter User
	require.NoError(t, DB.First(&inviteeAfter, 5102).Error)
	require.NoError(t, DB.First(&inviter, 5101).Error)
	assert.Equal(t, inviteeBefore.Quota, inviteeAfter.Quota)
	assert.Equal(t, wantReward, inviter.AffQuota)
	var claimCount int64
	require.NoError(t, DB.Model(&ReferralRewardClaim{}).Where("invitee_id = ?", 5102).Count(&claimCount).Error)
	assert.Equal(t, int64(1), claimCount)
}

func TestFirstPaidReferralRewardRejectsSandboxAndLaterPayments(t *testing.T) {
	t.Run("sandbox callback", func(t *testing.T) {
		truncateTables(t)
		createReferralRewardUsers(t, 5201, 5202)
		topUp := createReferralTopUp(t, 5202, "reward-sandbox-payment", PaymentProviderEpay, common.TopUpStatusPending)
		payment, err := NewVerifiedPayment("90", "CNY", "sandbox-event", "sandbox-payment", false)
		require.NoError(t, err)
		require.NoError(t, RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1", payment))

		var inviter User
		require.NoError(t, DB.First(&inviter, 5201).Error)
		assert.Zero(t, inviter.AffCount)
		assert.Zero(t, inviter.AffQuota)
		var count int64
		require.NoError(t, DB.Model(&ReferralRewardClaim{}).Count(&count).Error)
		assert.Zero(t, count)
	})

	t.Run("existing successful topup", func(t *testing.T) {
		truncateTables(t)
		createReferralRewardUsers(t, 5301, 5302)
		historical := createReferralTopUp(t, 5302, "reward-historical-payment", PaymentProviderStripe, common.TopUpStatusSuccess)
		require.NoError(t, DB.Model(historical).Update("referral_payment_verified", true).Error)
		topUp := createReferralTopUp(t, 5302, "reward-later-payment", PaymentProviderEpay, common.TopUpStatusPending)
		payment, err := NewVerifiedPayment("90", "CNY", "later-event", "later-payment", true)
		require.NoError(t, err)
		require.NoError(t, RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1", payment))

		var inviter User
		require.NoError(t, DB.First(&inviter, 5301).Error)
		assert.Zero(t, inviter.AffCount)
		assert.Zero(t, inviter.AffQuota)
		var count int64
		require.NoError(t, DB.Model(&ReferralRewardClaim{}).Count(&count).Error)
		assert.Zero(t, count)
	})
}

func TestFirstPaidReferralRewardRejectsUnsupportedNominalCurrency(t *testing.T) {
	truncateTables(t)
	createReferralRewardUsers(t, 5321, 5322)
	topUp := createReferralTopUp(t, 5322, "reward-unsupported-currency", PaymentProviderStripe, common.TopUpStatusPending)
	payment, err := NewVerifiedPayment("9000", "JPY", "jpy-event", "pi_jpy", true)
	require.NoError(t, err)

	completeReferralTopUp(t, topUp, payment)

	var stored TopUp
	require.NoError(t, DB.First(&stored, topUp.Id).Error)
	assert.Equal(t, common.TopUpStatusSuccess, stored.Status)
	var inviter User
	require.NoError(t, DB.First(&inviter, 5321).Error)
	assert.Zero(t, inviter.AffCount)
	assert.Zero(t, inviter.AffQuota)
	var count int64
	require.NoError(t, DB.Model(&ReferralRewardClaim{}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestManualCompletionDoesNotConsumeFirstVerifiedReferralPayment(t *testing.T) {
	truncateTables(t)
	createReferralRewardUsers(t, 5351, 5352)
	manual := createReferralTopUp(t, 5352, "reward-manual-completion", PaymentProviderStripe, common.TopUpStatusPending)
	require.NoError(t, ManualCompleteTopUp(manual.TradeNo, "127.0.0.1"))

	var completed TopUp
	require.NoError(t, DB.First(&completed, manual.Id).Error)
	assert.False(t, completed.ReferralPaymentVerified)

	verified := createReferralTopUp(t, 5352, "reward-after-manual", PaymentProviderEpay, common.TopUpStatusPending)
	payment, err := NewVerifiedPayment("90", "CNY", "verified-after-manual-event", "verified-after-manual-payment", true)
	require.NoError(t, err)
	require.NoError(t, RechargeEpay(verified.TradeNo, "alipay", "127.0.0.1", payment))

	var claim ReferralRewardClaim
	require.NoError(t, DB.Where("invitee_id = ?", 5352).First(&claim).Error)
	assert.Equal(t, verified.Id, claim.TopUpId)
}

func TestLegacySuccessfulTopUpsAreBackfilledOnce(t *testing.T) {
	truncateTables(t)
	createReferralRewardUsers(t, 5371, 5372)
	legacy := createReferralTopUp(t, 5372, "reward-legacy-backfill", PaymentProviderStripe, common.TopUpStatusSuccess)

	require.NoError(t, InitializeReferralPaymentVerification())
	var migrated TopUp
	require.NoError(t, DB.First(&migrated, legacy.Id).Error)
	assert.True(t, migrated.ReferralPaymentVerified)

	manual := createReferralTopUp(t, 5372, "reward-manual-after-backfill", PaymentProviderStripe, common.TopUpStatusSuccess)
	require.NoError(t, InitializeReferralPaymentVerification())
	migrated = TopUp{}
	require.NoError(t, DB.First(&migrated, manual.Id).Error)
	assert.False(t, migrated.ReferralPaymentVerified)
}

func TestVerifiedMinorUnitPaymentUsesCurrencyExponent(t *testing.T) {
	tests := []struct {
		currency string
		minor    int64
		want     string
	}{
		{currency: "CNY", minor: 9000, want: "90"},
		{currency: "JPY", minor: 9000, want: "9000"},
		{currency: "KWD", minor: 9000, want: "9"},
	}
	for _, test := range tests {
		t.Run(test.currency, func(t *testing.T) {
			payment, err := NewVerifiedMinorUnitPayment(test.minor, test.currency, "", "", true)
			require.NoError(t, err)
			assert.Equal(t, test.want, payment.Amount.String())
		})
	}
}

func TestReferralRegistrationDoesNotGrantLegacyFixedRewards(t *testing.T) {
	truncateTables(t)
	createReferralRewardUsers(t, 5401, 5402)

	previousInviterReward := common.QuotaForInviter
	previousInviteeReward := common.QuotaForInvitee
	common.QuotaForInviter = 123456
	common.QuotaForInvitee = 654321
	t.Cleanup(func() {
		common.QuotaForInviter = previousInviterReward
		common.QuotaForInvitee = previousInviteeReward
	})

	invitee, err := GetUserById(5402, true)
	require.NoError(t, err)
	invitee.finishInsert(5401)

	var inviter User
	require.NoError(t, DB.First(&inviter, 5401).Error)
	require.NoError(t, DB.First(invitee, 5402).Error)
	assert.Zero(t, inviter.AffCount)
	assert.Zero(t, inviter.AffQuota)
	assert.Zero(t, inviter.AffHistoryQuota)
	assert.Zero(t, invitee.Quota)
}

func TestReferralRewardHistoryIsOwnerScopedAndPrivacySafe(t *testing.T) {
	truncateTables(t)
	createReferralRewardUsers(t, 5501, 5502)
	createReferralRewardUsers(t, 5503, 5504)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", 5502).Updates(map[string]interface{}{
		"email":        "private-invitee@example.com",
		"display_name": "Private Invitee",
		"username":     "private-referral-user",
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id:        5505,
		Username:  "second-private-user",
		Email:     "second-private@example.com",
		AffCode:   "re5505",
		Status:    common.UserStatusEnabled,
		InviterId: 5501,
	}).Error)

	claims := []ReferralRewardClaim{
		{
			InviteeId:        5502,
			InviterId:        5501,
			TopUpId:          7001,
			TradeNo:          "private-trade-1",
			PaymentProvider:  PaymentProviderStripe,
			PaidAmount:       "19.8",
			PaidCurrency:     "CNY",
			RateBasisPoints:  ReferralRewardBasisPoints,
			RewardQuota:      297000,
			Status:           ReferralRewardStatusAwarded,
			GatewayEventId:   "private-gateway-event-1",
			GatewayPaymentId: "private-gateway-payment-1",
			CreatedAt:        100,
		},
		{
			InviteeId:        5505,
			InviterId:        5501,
			TopUpId:          7002,
			TradeNo:          "private-trade-2",
			PaymentProvider:  PaymentProviderWaffo,
			PaidAmount:       "90",
			PaidCurrency:     "USD",
			RateBasisPoints:  ReferralRewardBasisPoints,
			RewardQuota:      1350000,
			Status:           ReferralRewardStatusAwarded,
			GatewayEventId:   "private-gateway-event-2",
			GatewayPaymentId: "private-gateway-payment-2",
			CreatedAt:        200,
		},
		{
			InviteeId:        5504,
			InviterId:        5503,
			TopUpId:          7003,
			TradeNo:          "other-inviter-trade",
			PaymentProvider:  PaymentProviderEpay,
			PaidAmount:       "50",
			PaidCurrency:     "CNY",
			RateBasisPoints:  ReferralRewardBasisPoints,
			RewardQuota:      750000,
			Status:           ReferralRewardStatusAwarded,
			GatewayEventId:   "other-inviter-event",
			GatewayPaymentId: "other-inviter-payment",
			CreatedAt:        300,
		},
	}
	for i := range claims {
		require.NoError(t, DB.Create(&claims[i]).Error)
	}

	pageInfo := &common.PageInfo{Page: 1, PageSize: 1}
	items, total, err := GetReferralRewardHistory(5501, pageInfo)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, items, 1)
	assert.Equal(t, PaymentProviderWaffo, items[0].PaymentProvider)
	assert.Equal(t, "90", items[0].PaidAmount)
	assert.Equal(t, "USD", items[0].PaidCurrency)
	assert.Equal(t, "s***r", items[0].InviteeLabel)

	encoded, err := json.Marshal(items)
	require.NoError(t, err)
	response := string(encoded)
	for _, forbidden := range []string{
		"invitee_id",
		"inviter_id",
		"top_up_id",
		"trade_no",
		"gateway_event_id",
		"gateway_payment_id",
		"private-invitee@example.com",
		"Private Invitee",
		"private-referral-user",
		"second-private-user",
		"second-private@example.com",
		"private-trade-2",
		"private-gateway-event-2",
		"private-gateway-payment-2",
		"other-inviter-trade",
	} {
		assert.NotContains(t, response, forbidden)
	}

	pageInfo.Page = 2
	secondPage, total, err := GetReferralRewardHistory(5501, pageInfo)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, secondPage, 1)
	assert.Equal(t, PaymentProviderStripe, secondPage[0].PaymentProvider)
	assert.Equal(t, "p***r", secondPage[0].InviteeLabel)
	assert.NotEqual(t, items[0].InviteeLabel, secondPage[0].InviteeLabel)
}

func TestReferralInviteeMasking(t *testing.T) {
	tests := []struct {
		name     string
		identity referralRewardInviteeIdentity
		want     string
	}{
		{name: "username", identity: referralRewardInviteeIdentity{Username: "mumu"}, want: "m***u"},
		{name: "short username", identity: referralRewardInviteeIdentity{Username: "a"}, want: "***"},
		{name: "email fallback", identity: referralRewardInviteeIdentity{Email: "gululu@gmail.com"}, want: "g***u@gmail.com"},
		{name: "email username", identity: referralRewardInviteeIdentity{Username: "ab@example.com"}, want: "a***@example.com"},
		{name: "deleted user", identity: referralRewardInviteeIdentity{}, want: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, maskedReferralInviteeLabel(test.identity))
		})
	}
}

func TestInsertWithTxPersistsOAuthInviterRelationship(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{
		Id:       5601,
		Username: "oauth-inviter",
		AffCode:  "oauth-inviter-code",
		Status:   common.UserStatusEnabled,
	}).Error)

	invitee := &User{
		Username: "oauth-invitee",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return invitee.InsertWithTx(tx, 5601)
	}))

	var stored User
	require.NoError(t, DB.First(&stored, invitee.Id).Error)
	assert.Equal(t, 5601, stored.InviterId)
}

func TestReferralRewardWithholdsOverflowWithoutFailingPayment(t *testing.T) {
	truncateTables(t)
	createReferralRewardUsers(t, 5701, 5702)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", 5701).Updates(map[string]interface{}{
		"aff_quota":   common.MaxQuota - 1,
		"aff_history": common.MaxQuota - 1,
	}).Error)
	topUp := createReferralTopUp(t, 5702, "reward-overflow-payment", PaymentProviderEpay, common.TopUpStatusPending)
	payment, err := NewVerifiedPayment("90", "CNY", "overflow-event", "overflow-payment", true)
	require.NoError(t, err)
	require.NoError(t, RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1", payment))

	var updatedTopUp TopUp
	require.NoError(t, DB.First(&updatedTopUp, topUp.Id).Error)
	assert.Equal(t, common.TopUpStatusSuccess, updatedTopUp.Status)

	var inviter User
	require.NoError(t, DB.First(&inviter, 5701).Error)
	assert.Equal(t, common.MaxQuota-1, inviter.AffQuota)
	assert.Equal(t, common.MaxQuota-1, inviter.AffHistoryQuota)
	assert.Zero(t, inviter.AffCount)

	var claim ReferralRewardClaim
	require.NoError(t, DB.Where("invitee_id = ?", 5702).First(&claim).Error)
	assert.Equal(t, ReferralRewardStatusWithheld, claim.Status)
	assert.Equal(t, expectedReferralRewardQuota(t, "90"), claim.RewardQuota)
}

func TestReferralRewardReversalReclaimsTransferredQuotaAndIsIdempotent(t *testing.T) {
	truncateTables(t)
	createReferralRewardUsers(t, 5801, 5802)
	topUp := createReferralTopUp(t, 5802, "reward-reversal-payment", PaymentProviderEpay, common.TopUpStatusPending)
	payment, err := NewVerifiedPayment("90", "CNY", "reversal-original-event", "reversal-original-payment", true)
	require.NoError(t, err)
	require.NoError(t, RechargeEpay(topUp.TradeNo, "alipay", "127.0.0.1", payment))

	rewardQuota := expectedReferralRewardQuota(t, "90")
	var inviter User
	require.NoError(t, DB.First(&inviter, 5801).Error)
	require.NoError(t, inviter.TransferAffQuotaToQuota(rewardQuota))

	outcome, err := ReverseReferralRewardByGatewayReference(
		PaymentProviderEpay,
		"reversal-original-payment",
		"refund-event-1",
		"payment refunded",
	)
	require.NoError(t, err)
	assert.True(t, outcome.Changed)
	assert.Zero(t, outcome.UnrecoveredQuota)

	require.NoError(t, DB.First(&inviter, 5801).Error)
	assert.Zero(t, inviter.AffQuota)
	assert.Zero(t, inviter.AffHistoryQuota)
	assert.Zero(t, inviter.AffCount)
	assert.Zero(t, inviter.Quota)

	var claim ReferralRewardClaim
	require.NoError(t, DB.Where("invitee_id = ?", 5802).First(&claim).Error)
	assert.Equal(t, ReferralRewardStatusReversed, claim.Status)
	assert.Equal(t, rewardQuota, claim.ReversedQuota)
	assert.Equal(t, "refund-event-1", claim.ReversalEventId)
	assert.Positive(t, claim.ReversedAt)
	var paymentStates []ReferralPaymentState
	require.NoError(t, DB.Find(&paymentStates).Error)
	require.Len(t, paymentStates, 1)
	assert.Positive(t, paymentStates[0].RefundedAt)
	assert.Len(t, paymentStates[0].ReferenceDigest, 64)
	assert.NotEqual(t, "reversal-original-payment", paymentStates[0].ReferenceDigest)
	assert.NotEqual(t, "refund-event-1", paymentStates[0].ReversalEventDigest)

	duplicate, err := ReverseReferralRewardByGatewayReference(
		PaymentProviderEpay,
		"reversal-original-payment",
		"refund-event-1-duplicate",
		"duplicate refund callback",
	)
	require.NoError(t, err)
	assert.False(t, duplicate.Changed)
	require.NoError(t, DB.First(&inviter, 5801).Error)
	assert.Zero(t, inviter.Quota)
	paymentStates = nil
	require.NoError(t, DB.Find(&paymentStates).Error)
	assert.Len(t, paymentStates, 1)
}
