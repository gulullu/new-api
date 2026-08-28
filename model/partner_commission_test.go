package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPartnerCommissionUsdMicrosConvertsCNYUsingOrderSnapshot(t *testing.T) {
	tests := []struct {
		name       string
		topUp      *TopUp
		payment    VerifiedPayment
		wantMicros int64
		wantError  string
	}{
		{
			name:       "USD keeps the existing one to one path",
			topUp:      &TopUp{},
			payment:    VerifiedPayment{Amount: decimal.RequireFromString("20"), Currency: "USD"},
			wantMicros: 6_000_000,
		},
		{
			name:       "CNY uses the immutable USD per unit snapshot",
			topUp:      &TopUp{PartnerSettlementUsdPerUnit: "0.15"},
			payment:    VerifiedPayment{Amount: decimal.RequireFromString("20"), Currency: "CNY"},
			wantMicros: 900_000,
		},
		{
			name:      "missing CNY snapshot is unavailable",
			topUp:     &TopUp{},
			payment:   VerifiedPayment{Amount: decimal.RequireFromString("20"), Currency: "CNY"},
			wantError: "partner commission unavailable",
		},
		{
			name:      "malformed CNY snapshot is unavailable",
			topUp:     &TopUp{PartnerSettlementUsdPerUnit: "not-a-rate"},
			payment:   VerifiedPayment{Amount: decimal.RequireFromString("20"), Currency: "CNY"},
			wantError: "partner commission unavailable",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual, err := partnerCommissionUsdMicrosForTopUp(tt.topUp, tt.payment, PartnerDefaultCommissionBasisPoints)
			if tt.wantError != "" {
				require.ErrorContains(t, err, tt.wantError)
				assert.Zero(t, actual)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.wantMicros, actual)
		})
	}
}

func TestPartnerCNYOrderWithoutSettlementSnapshotFallsBackToStandardReferral(t *testing.T) {
	truncateTables(t)
	createPartnerRewardUsers(t, 6051, 6052)
	topUp := createReferralTopUp(t, 6052, "partner-cny-fallback", PaymentProviderEpay, common.TopUpStatusPending)
	payment, err := NewVerifiedPayment("20", "CNY", "partner-cny-fallback-event", "partner-cny-fallback-payment", true)
	require.NoError(t, err)
	completeReferralTopUp(t, topUp, payment)

	var claims []ReferralRewardClaim
	require.NoError(t, DB.Where("inviter_id = ?", 6051).Find(&claims).Error)
	require.Len(t, claims, 1)
	assert.Equal(t, ReferralRewardProgramStandard, claims[0].Program)
	assert.Equal(t, "CNY", claims[0].PaidCurrency)
	assert.Equal(t, expectedReferralRewardQuota(t, "20"), claims[0].RewardQuota)

	var partnerClaims []ReferralRewardClaim
	require.NoError(t, DB.Where("inviter_id = ? AND program = ?", 6051, ReferralRewardProgramPartner).Find(&partnerClaims).Error)
	assert.Empty(t, partnerClaims)
}

func TestPartnerCNYOrderUsesSettlementSnapshotAndKeepsOriginalPaymentCurrency(t *testing.T) {
	truncateTables(t)
	createPartnerRewardUsers(t, 6061, 6062)
	topUp := createReferralTopUp(t, 6062, "partner-cny-snapshot", PaymentProviderEpay, common.TopUpStatusPending)
	topUp.PartnerSettlementUsdPerUnit = "0.15"
	require.NoError(t, topUp.Update())
	payment, err := NewVerifiedPayment("20", "CNY", "partner-cny-snapshot-event", "partner-cny-snapshot-payment", true)
	require.NoError(t, err)
	completeReferralTopUp(t, topUp, payment)

	var claim ReferralRewardClaim
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).First(&claim).Error)
	assert.Equal(t, ReferralRewardProgramPartner, claim.Program)
	assert.Equal(t, "20", claim.PaidAmount)
	assert.Equal(t, "CNY", claim.PaidCurrency)
	assert.Equal(t, int64(900_000), claim.CommissionUsdMicros)

	var wallet PartnerWallet
	require.NoError(t, DB.Where("user_id = ?", 6061).First(&wallet).Error)
	assert.Equal(t, int64(900_000), wallet.PendingUsdMicros)
}

func TestPartnerCNYCommissionRefundReversesSnapshottedUsdMicros(t *testing.T) {
	truncateTables(t)
	createPartnerRewardUsers(t, 6071, 6072)
	topUp := createReferralTopUp(t, 6072, "partner-cny-refund", PaymentProviderEpay, common.TopUpStatusPending)
	topUp.PartnerSettlementUsdPerUnit = "0.15"
	require.NoError(t, topUp.Update())
	payment, err := NewVerifiedPayment("20", "CNY", "partner-cny-refund-event", "partner-cny-refund-payment", true)
	require.NoError(t, err)
	completeReferralTopUp(t, topUp, payment)

	var claim ReferralRewardClaim
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).First(&claim).Error)
	require.Equal(t, int64(900_000), claim.CommissionUsdMicros)

	outcome, err := ReverseReferralRewardById(claim.Id, "partner-cny-refund-reversal", "payment refunded")
	require.NoError(t, err)
	require.True(t, outcome.Changed)
	assert.Equal(t, int64(900_000), outcome.CommissionUsdMicros)

	var wallet PartnerWallet
	require.NoError(t, DB.Where("user_id = ?", 6071).First(&wallet).Error)
	assert.Zero(t, wallet.PendingUsdMicros)
	assert.Equal(t, int64(900_000), wallet.LifetimeReversedUsdMicros)

	var reversed ReferralRewardClaim
	require.NoError(t, DB.First(&reversed, claim.Id).Error)
	assert.Equal(t, ReferralRewardStatusReversed, reversed.Status)
}

func createPartnerRewardUsers(t *testing.T, inviterID int, inviteeID int) {
	t.Helper()
	createReferralRewardUsers(t, inviterID, inviteeID)
	require.NoError(t, DB.Create(&PartnerProfile{
		UserId:                inviterID,
		Enabled:               true,
		CommissionBasisPoints: PartnerDefaultCommissionBasisPoints,
		EffectiveAt:           common.GetTimestamp(),
	}).Error)
}

func TestPartnerCommissionAwardsEveryVerifiedPaymentAtSnapshottedRate(t *testing.T) {
	truncateTables(t)
	createPartnerRewardUsers(t, 6101, 6102)
	require.NoError(t, DB.Model(&PartnerProfile{}).Where("user_id = ?", 6101).Update("commission_basis_points", 3500).Error)

	for index, amount := range []string{"10", "20"} {
		topUp := createReferralTopUp(t, 6102, fmt.Sprintf("partner-every-%d", index), PaymentProviderEpay, common.TopUpStatusPending)
		payment, err := NewVerifiedPayment(amount, "USD", fmt.Sprintf("event-%d", index), fmt.Sprintf("payment-%d", index), true)
		require.NoError(t, err)
		completeReferralTopUp(t, topUp, payment)
	}

	var claims []ReferralRewardClaim
	require.NoError(t, DB.Where("inviter_id = ?", 6101).Order("id ASC").Find(&claims).Error)
	require.Len(t, claims, 2)
	assert.Equal(t, int64(3_500_000), claims[0].CommissionUsdMicros)
	assert.Equal(t, int64(7_000_000), claims[1].CommissionUsdMicros)
	for _, claim := range claims {
		assert.Equal(t, ReferralRewardProgramPartner, claim.Program)
		assert.Equal(t, 3500, claim.RateBasisPoints)
		assert.Equal(t, PartnerCommissionSettlementPending, claim.PartnerSettlement)
		assert.Zero(t, claim.RewardQuota)
	}

	var wallet PartnerWallet
	require.NoError(t, DB.Where("user_id = ?", 6101).First(&wallet).Error)
	assert.Equal(t, int64(10_500_000), wallet.PendingUsdMicros)
	assert.Equal(t, int64(10_500_000), wallet.LifetimeEarnedUsdMicros)
	assert.Zero(t, wallet.AvailableUsdMicros)

	var inviter User
	require.NoError(t, DB.First(&inviter, 6101).Error)
	assert.Zero(t, inviter.AffQuota)
}

func TestPartnerCommissionMaturesAfterSevenDaysAndTransfersAtPriceSnapshot(t *testing.T) {
	truncateTables(t)
	createPartnerRewardUsers(t, 6201, 6202)
	topUp := createReferralTopUp(t, 6202, "partner-mature", PaymentProviderEpay, common.TopUpStatusPending)
	payment, err := NewVerifiedPayment("30", "USD", "partner-mature-event", "partner-mature-payment", true)
	require.NoError(t, err)
	completeReferralTopUp(t, topUp, payment)

	var claim ReferralRewardClaim
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).First(&claim).Error)
	require.NoError(t, DB.Model(&claim).Update("partner_available_at", common.GetTimestamp()-1).Error)

	summary, err := GetPartnerWalletSummary(6201)
	require.NoError(t, err)
	assert.Zero(t, summary.PendingUsdMicros)
	assert.Equal(t, int64(9_000_000), summary.AvailableUsdMicros)

	previousPrice := operation_setting.Price
	operation_setting.Price = 0.1
	t.Cleanup(func() { operation_setting.Price = previousPrice })
	quota, err := TransferPartnerCommissionToQuota(6201, 5_000_000, "transfer-request-6201")
	require.NoError(t, err)
	assert.Equal(t, int(50*common.QuotaPerUnit), quota)
	quota, err = TransferPartnerCommissionToQuota(6201, 5_000_000, "transfer-request-6201")
	require.NoError(t, err)
	assert.Equal(t, int(50*common.QuotaPerUnit), quota)

	var wallet PartnerWallet
	require.NoError(t, DB.Where("user_id = ?", 6201).First(&wallet).Error)
	assert.Equal(t, int64(4_000_000), wallet.AvailableUsdMicros)
	assert.Equal(t, int64(5_000_000), wallet.LifetimeTransferredUsdMicros)
	var inviter User
	require.NoError(t, DB.First(&inviter, 6201).Error)
	assert.Equal(t, quota, inviter.Quota)
	var entry PartnerWalletEntry
	require.NoError(t, DB.Where("user_id = ? AND kind = ?", 6201, PartnerWalletEntryTransfer).First(&entry).Error)
	assert.Equal(t, "0.1", entry.UnitPriceUsd)
}

func TestPartnerWithdrawalLocksOnceAndRejectRestoresBalance(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 6301, Username: "partner-withdraw", AffCode: "pw6301", Group: "default", Status: common.UserStatusEnabled}).Error)
	require.NoError(t, DB.Create(&PartnerProfile{UserId: 6301, Enabled: true, CommissionBasisPoints: PartnerDefaultCommissionBasisPoints}).Error)
	require.NoError(t, DB.Create(&PartnerWallet{UserId: 6301, AvailableUsdMicros: 50_000_000}).Error)

	withdrawal, err := CreatePartnerWithdrawal(6301, 20_000_000, PartnerWithdrawalMethodAlipay, PartnerPayoutDestination{
		AlipayAccount: "partner@example.com",
		AlipayName:    "合伙人",
	})
	require.NoError(t, err)
	assert.NotContains(t, withdrawal.DestinationEncrypted, "partner@example.com")
	assert.Equal(t, PartnerWithdrawalStatusPending, withdrawal.Status)

	_, err = CreatePartnerWithdrawal(6301, 20_000_000, PartnerWithdrawalMethodBSCUSDT, PartnerPayoutDestination{
		BSCAddress: "0x1111111111111111111111111111111111111111",
	})
	require.ErrorContains(t, err, "already pending")

	reviewed, err := ReviewPartnerWithdrawal(withdrawal.Id, 1, false, "", "Recipient requested a correction")
	require.NoError(t, err)
	assert.Equal(t, PartnerWithdrawalStatusRejected, reviewed.Status)
	var wallet PartnerWallet
	require.NoError(t, DB.Where("user_id = ?", 6301).First(&wallet).Error)
	assert.Equal(t, int64(50_000_000), wallet.AvailableUsdMicros)
	assert.Zero(t, wallet.LockedUsdMicros)
	assert.Zero(t, wallet.ActiveWithdrawalId)
}

func TestPartnerBSCWithdrawalRequiresTransactionHashAndPaysFullAmount(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 6401, Username: "partner-bsc", AffCode: "pb6401", Group: "default", Status: common.UserStatusEnabled}).Error)
	require.NoError(t, DB.Create(&PartnerProfile{UserId: 6401, Enabled: true, CommissionBasisPoints: PartnerDefaultCommissionBasisPoints}).Error)
	require.NoError(t, DB.Create(&PartnerWallet{UserId: 6401, AvailableUsdMicros: 25_000_000}).Error)
	withdrawal, err := CreatePartnerWithdrawal(6401, 25_000_000, PartnerWithdrawalMethodBSCUSDT, PartnerPayoutDestination{
		BSCAddress: "0x2222222222222222222222222222222222222222",
	})
	require.NoError(t, err)

	_, err = ReviewPartnerWithdrawal(withdrawal.Id, 9, true, "invalid", "")
	require.ErrorContains(t, err, "BSC transaction hash")
	txHash := "0x" + "ab" + "11111111111111111111111111111111111111111111111111111111111111"
	require.Len(t, txHash, 66)
	reviewed, err := ReviewPartnerWithdrawal(withdrawal.Id, 9, true, txHash, "")
	require.NoError(t, err)
	assert.Equal(t, PartnerWithdrawalStatusPaid, reviewed.Status)

	var wallet PartnerWallet
	require.NoError(t, DB.Where("user_id = ?", 6401).First(&wallet).Error)
	assert.Zero(t, wallet.AvailableUsdMicros)
	assert.Zero(t, wallet.LockedUsdMicros)
	assert.Equal(t, int64(25_000_000), wallet.LifetimeWithdrawnUsdMicros)
}

func TestPartnerRefundReversesPendingAndCreatesDebtAfterFundsLeaveWallet(t *testing.T) {
	truncateTables(t)
	createPartnerRewardUsers(t, 6501, 6502)
	topUp := createReferralTopUp(t, 6502, "partner-refund", PaymentProviderEpay, common.TopUpStatusPending)
	payment, err := NewVerifiedPayment("100", "USD", "partner-refund-event", "partner-refund-payment", true)
	require.NoError(t, err)
	completeReferralTopUp(t, topUp, payment)

	var claim ReferralRewardClaim
	require.NoError(t, DB.Where("top_up_id = ?", topUp.Id).First(&claim).Error)
	reversal, err := ReverseReferralRewardById(claim.Id, "partner-refund-1", "payment refunded")
	require.NoError(t, err)
	assert.True(t, reversal.Changed)
	assert.Equal(t, ReferralRewardProgramPartner, reversal.Program)
	var wallet PartnerWallet
	require.NoError(t, DB.Where("user_id = ?", 6501).First(&wallet).Error)
	assert.Zero(t, wallet.PendingUsdMicros)
	assert.Zero(t, wallet.DebtUsdMicros)

	second := createReferralTopUp(t, 6502, "partner-refund-after-use", PaymentProviderEpay, common.TopUpStatusPending)
	secondPayment, err := NewVerifiedPayment("40", "USD", "partner-refund-event-2", "partner-refund-payment-2", true)
	require.NoError(t, err)
	completeReferralTopUp(t, second, secondPayment)
	var secondClaim ReferralRewardClaim
	require.NoError(t, DB.Where("top_up_id = ?", second.Id).First(&secondClaim).Error)
	require.NoError(t, DB.Model(&secondClaim).Updates(map[string]interface{}{
		"partner_available_at": common.GetTimestamp() - 1,
	}).Error)
	_, err = GetPartnerWalletSummary(6501)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&PartnerWallet{}).Where("user_id = ?", 6501).Update("available_usd_micros", 0).Error)

	_, err = ReverseReferralRewardById(secondClaim.Id, "partner-refund-2", "payment disputed")
	require.NoError(t, err)
	require.NoError(t, DB.Where("user_id = ?", 6501).First(&wallet).Error)
	assert.Equal(t, int64(12_000_000), wallet.DebtUsdMicros)
}

func TestConfigurePartnerKeepsApiRoutingGroupAndEnablesMembership(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{
		Id:       6601,
		Username: "partner-membership",
		AffCode:  "pm6601",
		Group:    "vip",
		Status:   common.UserStatusEnabled,
	}).Error)

	profile, err := ConfigurePartner(6601, 4200, 1)
	require.NoError(t, err)
	assert.True(t, profile.Enabled)
	assert.Equal(t, 4200, profile.CommissionBasisPoints)
	assert.True(t, IsPartnerEnabled(6601))

	var user User
	require.NoError(t, DB.First(&user, 6601).Error)
	assert.Equal(t, "vip", user.Group)
}

func TestPartnerAdminListsReturnEmptyArrays(t *testing.T) {
	truncateTables(t)
	pageInfo := &common.PageInfo{Page: 1, PageSize: 10}

	profiles, profileTotal, err := ListPartnerProfiles("", pageInfo)
	require.NoError(t, err)
	assert.NotNil(t, profiles)
	assert.Empty(t, profiles)
	assert.Zero(t, profileTotal)

	withdrawals, withdrawalTotal, err := ListPartnerWithdrawals("", "", pageInfo)
	require.NoError(t, err)
	assert.NotNil(t, withdrawals)
	assert.Empty(t, withdrawals)
	assert.Zero(t, withdrawalTotal)
}

func TestDisabledPartnerMembershipCannotWithdraw(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 6701, Username: "former-partner", AffCode: "fp6701", Group: "default", Status: common.UserStatusEnabled}).Error)
	require.NoError(t, DB.Create(&PartnerProfile{UserId: 6701, Enabled: true, CommissionBasisPoints: PartnerDefaultCommissionBasisPoints}).Error)
	require.NoError(t, DB.Model(&PartnerProfile{}).Where("user_id = ?", 6701).Update("enabled", false).Error)
	require.NoError(t, DB.Create(&PartnerWallet{UserId: 6701, AvailableUsdMicros: 50_000_000}).Error)

	_, err := CreatePartnerWithdrawal(6701, 20_000_000, PartnerWithdrawalMethodBSCUSDT, PartnerPayoutDestination{
		BSCAddress: "0x3333333333333333333333333333333333333333",
	})
	require.ErrorContains(t, err, "only active partner users")
}
