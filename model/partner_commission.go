package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	PartnerDefaultCommissionBasisPoints = 3000
	PartnerMinCommissionBasisPoints     = 1
	PartnerMaxCommissionBasisPoints     = 10000
	PartnerCommissionHoldSeconds        = int64(7 * 24 * 60 * 60)
	PartnerMinimumWithdrawalUsdMicros   = int64(20 * 1_000_000)
	PartnerMinimumTransferUsdMicros     = int64(1)

	PartnerWalletEntryCommissionPending   = "commission_pending"
	PartnerWalletEntryCommissionAvailable = "commission_available"
	PartnerWalletEntryDebtRepaid          = "debt_repaid"
	PartnerWalletEntryTransfer            = "balance_transfer"
	PartnerWalletEntryWithdrawalLock      = "withdrawal_lock"
	PartnerWalletEntryWithdrawalUnlock    = "withdrawal_unlock"
	PartnerWalletEntryWithdrawalPaid      = "withdrawal_paid"
	PartnerWalletEntryReversal            = "commission_reversal"

	PartnerWithdrawalMethodAlipay  = "alipay"
	PartnerWithdrawalMethodBSCUSDT = "bsc_usdt"

	PartnerWithdrawalStatusPending  = "pending"
	PartnerWithdrawalStatusPaid     = "paid"
	PartnerWithdrawalStatusRejected = "rejected"

	partnerPayoutCipherPurpose = "partner-payout-destination-v1"
)

var (
	partnerBSCAddressPattern = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)
	partnerBSCTxHashPattern  = regexp.MustCompile(`^0x[0-9a-fA-F]{64}$`)
	partnerRequestIDPattern  = regexp.MustCompile(`^[A-Za-z0-9_-]{16,96}$`)
)

// PartnerProfile is deliberately separate from User. An enabled row grants
// Partner-program membership without changing the user's API routing group.
type PartnerProfile struct {
	Id                    int   `json:"id"`
	UserId                int   `json:"user_id" gorm:"not null;uniqueIndex"`
	Enabled               bool  `json:"enabled" gorm:"not null;default:true;index"`
	CommissionBasisPoints int   `json:"commission_basis_points" gorm:"not null;default:3000"`
	EffectiveAt           int64 `json:"effective_at" gorm:"not null;default:0;index"`
	UpdatedBy             int   `json:"updated_by" gorm:"not null;default:0"`
	CreatedAt             int64 `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt             int64 `json:"updated_at" gorm:"autoUpdateTime"`
}

// PartnerWallet is the materialized balance protected by a row lock. USD
// micros avoid floating-point accounting and match USDT's six decimals.
type PartnerWallet struct {
	Id                           int   `json:"id"`
	UserId                       int   `json:"user_id" gorm:"not null;uniqueIndex"`
	PendingUsdMicros             int64 `json:"pending_usd_micros" gorm:"not null;default:0"`
	AvailableUsdMicros           int64 `json:"available_usd_micros" gorm:"not null;default:0"`
	LockedUsdMicros              int64 `json:"locked_usd_micros" gorm:"not null;default:0"`
	DebtUsdMicros                int64 `json:"debt_usd_micros" gorm:"not null;default:0"`
	LifetimeEarnedUsdMicros      int64 `json:"lifetime_earned_usd_micros" gorm:"not null;default:0"`
	LifetimeReversedUsdMicros    int64 `json:"lifetime_reversed_usd_micros" gorm:"not null;default:0"`
	LifetimeTransferredUsdMicros int64 `json:"lifetime_transferred_usd_micros" gorm:"not null;default:0"`
	LifetimeWithdrawnUsdMicros   int64 `json:"lifetime_withdrawn_usd_micros" gorm:"not null;default:0"`
	ActiveWithdrawalId           int   `json:"active_withdrawal_id" gorm:"not null;default:0;index"`
	CreatedAt                    int64 `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt                    int64 `json:"updated_at" gorm:"autoUpdateTime"`
}

type PartnerWalletEntry struct {
	Id              int    `json:"id"`
	UserId          int    `json:"user_id" gorm:"not null;index"`
	Kind            string `json:"kind" gorm:"type:varchar(40);not null;index"`
	AmountUsdMicros int64  `json:"amount_usd_micros" gorm:"not null"`
	ClaimId         int    `json:"claim_id" gorm:"not null;default:0;index"`
	WithdrawalId    int    `json:"withdrawal_id" gorm:"not null;default:0;index"`
	QuotaAmount     int    `json:"quota_amount" gorm:"not null;default:0"`
	UnitPriceUsd    string `json:"unit_price_usd,omitempty" gorm:"type:varchar(64);not null;default:''"`
	IdempotencyKey  string `json:"-" gorm:"type:varchar(128);not null;uniqueIndex"`
	CreatedAt       int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

type PartnerWithdrawal struct {
	Id                   int    `json:"id"`
	UserId               int    `json:"user_id" gorm:"not null;index"`
	AmountUsdMicros      int64  `json:"amount_usd_micros" gorm:"not null"`
	Method               string `json:"method" gorm:"type:varchar(24);not null;index"`
	DestinationEncrypted string `json:"-" gorm:"type:text;not null"`
	DestinationDigest    string `json:"-" gorm:"type:char(64);not null;index"`
	DestinationMasked    string `json:"destination_masked" gorm:"type:varchar(160);not null"`
	Status               string `json:"status" gorm:"type:varchar(24);not null;index"`
	PayoutReference      string `json:"payout_reference,omitempty" gorm:"type:varchar(160);not null;default:''"`
	AdminNote            string `json:"admin_note,omitempty" gorm:"type:varchar(500);not null;default:''"`
	ReviewedBy           int    `json:"reviewed_by" gorm:"not null;default:0;index"`
	RequestedAt          int64  `json:"requested_at" gorm:"not null;index"`
	ReviewedAt           int64  `json:"reviewed_at" gorm:"not null;default:0"`
	CreatedAt            int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt            int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type PartnerPayoutDestination struct {
	AlipayAccount string `json:"alipay_account,omitempty"`
	AlipayName    string `json:"alipay_name,omitempty"`
	BSCAddress    string `json:"bsc_address,omitempty"`
}

type PartnerWalletSummary struct {
	Eligible                     bool  `json:"eligible"`
	CommissionBasisPoints        int   `json:"commission_basis_points"`
	HoldSeconds                  int64 `json:"hold_seconds"`
	MinimumWithdrawalUsdMicros   int64 `json:"minimum_withdrawal_usd_micros"`
	MinimumTransferUsdMicros     int64 `json:"minimum_transfer_usd_micros"`
	PendingUsdMicros             int64 `json:"pending_usd_micros"`
	AvailableUsdMicros           int64 `json:"available_usd_micros"`
	LockedUsdMicros              int64 `json:"locked_usd_micros"`
	DebtUsdMicros                int64 `json:"debt_usd_micros"`
	LifetimeEarnedUsdMicros      int64 `json:"lifetime_earned_usd_micros"`
	LifetimeReversedUsdMicros    int64 `json:"lifetime_reversed_usd_micros"`
	LifetimeTransferredUsdMicros int64 `json:"lifetime_transferred_usd_micros"`
	LifetimeWithdrawnUsdMicros   int64 `json:"lifetime_withdrawn_usd_micros"`
	ActiveWithdrawalId           int   `json:"active_withdrawal_id"`
}

type PartnerProfileAdminItem struct {
	UserId                int    `json:"user_id"`
	Username              string `json:"username"`
	Email                 string `json:"email"`
	CommissionBasisPoints int    `json:"commission_basis_points"`
	EffectiveAt           int64  `json:"effective_at"`
	UpdatedAt             int64  `json:"updated_at"`
}

type PartnerWithdrawalAdminItem struct {
	PartnerWithdrawal
	Username string `json:"username"`
	Email    string `json:"email"`
}

func validatePartnerCommissionBasisPoints(value int) error {
	if value < PartnerMinCommissionBasisPoints || value > PartnerMaxCommissionBasisPoints {
		return errors.New("partner commission rate must be between 0.01% and 100%")
	}
	return nil
}

func partnerCommissionUsdMicros(payment VerifiedPayment, basisPoints int) (int64, error) {
	if !strings.EqualFold(strings.TrimSpace(payment.Currency), "USD") {
		return 0, errors.New("partner commissions require USD settlement")
	}
	if err := validatePartnerCommissionBasisPoints(basisPoints); err != nil {
		return 0, err
	}
	amount := payment.Amount.
		Mul(decimal.NewFromInt(int64(basisPoints))).
		Div(decimal.NewFromInt(10000)).
		Mul(decimal.NewFromInt(1_000_000)).
		Floor()
	if !amount.IsPositive() {
		return 0, nil
	}
	if amount.GreaterThan(decimal.NewFromInt(math.MaxInt64)) {
		return 0, errors.New("partner commission exceeds supported range")
	}
	return amount.IntPart(), nil
}

func getEnabledPartnerProfileTx(tx *gorm.DB, userId int, locked bool) (*PartnerProfile, error) {
	if tx == nil || userId <= 0 {
		return nil, errors.New("invalid partner profile context")
	}
	query := tx
	if locked {
		query = lockForUpdate(tx)
	}
	var profile PartnerProfile
	if err := query.Where("user_id = ? AND enabled = ?", userId, true).First(&profile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if err := validatePartnerCommissionBasisPoints(profile.CommissionBasisPoints); err != nil {
		return nil, err
	}
	return &profile, nil
}

func IsPartnerEnabled(userId int) bool {
	profile, err := getEnabledPartnerProfileTx(DB, userId, false)
	if err != nil {
		common.SysError(fmt.Sprintf("failed to load partner membership: user_id=%d error=%q", userId, err.Error()))
		return false
	}
	return profile != nil
}

func ensurePartnerWalletTx(tx *gorm.DB, userId int) (*PartnerWallet, error) {
	if tx == nil || userId <= 0 {
		return nil, errors.New("invalid partner wallet context")
	}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&PartnerWallet{UserId: userId}).Error; err != nil {
		return nil, err
	}
	var wallet PartnerWallet
	if err := lockForUpdate(tx).Where("user_id = ?", userId).First(&wallet).Error; err != nil {
		return nil, err
	}
	return &wallet, nil
}

func createPartnerWalletEntryTx(tx *gorm.DB, entry *PartnerWalletEntry) error {
	if tx == nil || entry == nil || entry.UserId <= 0 || strings.TrimSpace(entry.IdempotencyKey) == "" {
		return errors.New("invalid partner wallet entry")
	}
	return tx.Create(entry).Error
}

func grantPartnerCommissionTx(tx *gorm.DB, topUp *TopUp, payment VerifiedPayment, paymentState *ReferralPaymentState, invitee *User, inviter *User, profile *PartnerProfile) (bool, int64, error) {
	if tx == nil || topUp == nil || paymentState == nil || invitee == nil || inviter == nil || profile == nil || !profile.Enabled || profile.UserId != inviter.Id {
		return false, 0, errors.New("missing partner commission context")
	}
	commissionMicros, err := partnerCommissionUsdMicros(payment, profile.CommissionBasisPoints)
	if err != nil {
		common.SysError(fmt.Sprintf("skipped partner commission: inviter_id=%d topup_id=%d error=%q", inviter.Id, topUp.Id, err.Error()))
		return false, 0, nil
	}
	if commissionMicros <= 0 {
		return false, 0, nil
	}

	now := common.GetTimestamp()
	claim := &ReferralRewardClaim{
		InviteeId:              topUp.UserId,
		InviterId:              inviter.Id,
		TopUpId:                topUp.Id,
		TradeNo:                topUp.TradeNo,
		PaymentReferenceDigest: &paymentState.ReferenceDigest,
		PaymentProvider:        topUp.PaymentProvider,
		PaidAmount:             payment.Amount.String(),
		PaidCurrency:           "USD",
		Program:                ReferralRewardProgramPartner,
		RateBasisPoints:        profile.CommissionBasisPoints,
		CommissionUsdMicros:    commissionMicros,
		PartnerSettlement:      PartnerCommissionSettlementPending,
		PartnerAvailableAt:     now + PartnerCommissionHoldSeconds,
		Status:                 ReferralRewardStatusAwarded,
		GatewayEventId:         payment.GatewayEventId,
		GatewayPaymentId:       payment.GatewayPaymentId,
	}
	result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(claim)
	if result.Error != nil {
		return false, 0, result.Error
	}
	if result.RowsAffected == 0 {
		return false, 0, nil
	}

	wallet, err := ensurePartnerWalletTx(tx, inviter.Id)
	if err != nil {
		return false, 0, err
	}
	if wallet.PendingUsdMicros > math.MaxInt64-commissionMicros || wallet.LifetimeEarnedUsdMicros > math.MaxInt64-commissionMicros {
		return false, 0, errors.New("partner wallet exceeds supported range")
	}
	if err := tx.Model(wallet).Updates(map[string]interface{}{
		"pending_usd_micros":         gorm.Expr("pending_usd_micros + ?", commissionMicros),
		"lifetime_earned_usd_micros": gorm.Expr("lifetime_earned_usd_micros + ?", commissionMicros),
	}).Error; err != nil {
		return false, 0, err
	}
	if err := createPartnerWalletEntryTx(tx, &PartnerWalletEntry{
		UserId:          inviter.Id,
		Kind:            PartnerWalletEntryCommissionPending,
		AmountUsdMicros: commissionMicros,
		ClaimId:         claim.Id,
		IdempotencyKey:  fmt.Sprintf("partner-claim:%d:pending", claim.Id),
	}); err != nil {
		return false, 0, err
	}
	return true, commissionMicros, nil
}

func settleMaturePartnerCommissionsTx(tx *gorm.DB, userId int, now int64) (*PartnerWallet, error) {
	if tx == nil || userId <= 0 {
		return nil, errors.New("missing partner settlement context")
	}
	// Refund reversal locks the immutable claim before touching the materialized
	// wallet. Settlement follows the same order so a maturity read and a refund
	// cannot form a claim <-> wallet lock cycle. Discover candidate IDs without a
	// range lock, then lock current rows by primary key and re-check every state.
	// This avoids a MySQL secondary-index deadlock where a pending-status range
	// scan blocks the refund's status update while the refund holds a claim row.
	var candidateIds []int
	if err := tx.Model(&ReferralRewardClaim{}).
		Where("inviter_id = ? AND program = ? AND status = ? AND partner_settlement = ? AND partner_available_at <= ?",
			userId,
			ReferralRewardProgramPartner,
			ReferralRewardStatusAwarded,
			PartnerCommissionSettlementPending,
			now,
		).
		Order("id ASC").
		Pluck("id", &candidateIds).Error; err != nil {
		return nil, err
	}
	var lockedClaims []ReferralRewardClaim
	if len(candidateIds) > 0 {
		if err := lockForUpdate(tx).
			Where("id IN ?", candidateIds).
			Order("id ASC").
			Find(&lockedClaims).Error; err != nil {
			return nil, err
		}
	}
	claims := make([]ReferralRewardClaim, 0, len(lockedClaims))
	for _, claim := range lockedClaims {
		if claim.InviterId == userId &&
			claim.Program == ReferralRewardProgramPartner &&
			claim.Status == ReferralRewardStatusAwarded &&
			claim.PartnerSettlement == PartnerCommissionSettlementPending &&
			claim.PartnerAvailableAt <= now {
			claims = append(claims, claim)
		}
	}
	wallet, err := ensurePartnerWalletTx(tx, userId)
	if err != nil {
		return nil, err
	}
	if len(claims) == 0 {
		return wallet, nil
	}

	var total int64
	claimIds := make([]int, 0, len(claims))
	for _, claim := range claims {
		if claim.CommissionUsdMicros <= 0 || total > math.MaxInt64-claim.CommissionUsdMicros {
			return nil, errors.New("invalid partner settlement amount")
		}
		total += claim.CommissionUsdMicros
		claimIds = append(claimIds, claim.Id)
	}
	if wallet.PendingUsdMicros < total {
		return nil, errors.New("partner pending balance is inconsistent")
	}

	debtRepaid := total
	if debtRepaid > wallet.DebtUsdMicros {
		debtRepaid = wallet.DebtUsdMicros
	}
	available := total - debtRepaid
	updates := map[string]interface{}{
		"pending_usd_micros":   gorm.Expr("pending_usd_micros - ?", total),
		"available_usd_micros": gorm.Expr("available_usd_micros + ?", available),
		"debt_usd_micros":      gorm.Expr("debt_usd_micros - ?", debtRepaid),
	}
	if err := tx.Model(wallet).Updates(updates).Error; err != nil {
		return nil, err
	}
	if err := tx.Model(&ReferralRewardClaim{}).Where("id IN ?", claimIds).Updates(map[string]interface{}{
		"partner_settlement": PartnerCommissionSettlementAvailable,
		"partner_settled_at": now,
	}).Error; err != nil {
		return nil, err
	}
	sort.Ints(claimIds)
	settlementKey := fmt.Sprintf("partner-settle:%d:%d", wallet.UserId, claimIds[len(claimIds)-1])
	if available > 0 {
		if err := createPartnerWalletEntryTx(tx, &PartnerWalletEntry{
			UserId:          wallet.UserId,
			Kind:            PartnerWalletEntryCommissionAvailable,
			AmountUsdMicros: available,
			IdempotencyKey:  settlementKey + ":available",
		}); err != nil {
			return nil, err
		}
	}
	if debtRepaid > 0 {
		if err := createPartnerWalletEntryTx(tx, &PartnerWalletEntry{
			UserId:          wallet.UserId,
			Kind:            PartnerWalletEntryDebtRepaid,
			AmountUsdMicros: debtRepaid,
			IdempotencyKey:  settlementKey + ":debt",
		}); err != nil {
			return nil, err
		}
	}
	wallet.PendingUsdMicros -= total
	wallet.AvailableUsdMicros += available
	wallet.DebtUsdMicros -= debtRepaid
	return wallet, nil
}

func GetPartnerWalletSummary(userId int) (PartnerWalletSummary, error) {
	if userId <= 0 {
		return PartnerWalletSummary{}, errors.New("invalid partner user")
	}
	summary := PartnerWalletSummary{
		CommissionBasisPoints:      PartnerDefaultCommissionBasisPoints,
		HoldSeconds:                PartnerCommissionHoldSeconds,
		MinimumWithdrawalUsdMicros: PartnerMinimumWithdrawalUsdMicros,
		MinimumTransferUsdMicros:   PartnerMinimumTransferUsdMicros,
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Select("id", "status").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		profile, err := getEnabledPartnerProfileTx(tx, userId, true)
		if err != nil {
			return err
		}
		summary.Eligible = user.Status == common.UserStatusEnabled && profile != nil
		if !summary.Eligible {
			return nil
		}
		wallet, err := settleMaturePartnerCommissionsTx(tx, userId, common.GetTimestamp())
		if err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", userId).First(wallet).Error; err != nil {
			return err
		}
		summary.CommissionBasisPoints = profile.CommissionBasisPoints
		summary.PendingUsdMicros = wallet.PendingUsdMicros
		summary.AvailableUsdMicros = wallet.AvailableUsdMicros
		summary.LockedUsdMicros = wallet.LockedUsdMicros
		summary.DebtUsdMicros = wallet.DebtUsdMicros
		summary.LifetimeEarnedUsdMicros = wallet.LifetimeEarnedUsdMicros
		summary.LifetimeReversedUsdMicros = wallet.LifetimeReversedUsdMicros
		summary.LifetimeTransferredUsdMicros = wallet.LifetimeTransferredUsdMicros
		summary.LifetimeWithdrawnUsdMicros = wallet.LifetimeWithdrawnUsdMicros
		summary.ActiveWithdrawalId = wallet.ActiveWithdrawalId
		return nil
	})
	return summary, err
}

func TransferPartnerCommissionToQuota(userId int, amountUsdMicros int64, requestId string) (int, error) {
	requestId = strings.TrimSpace(requestId)
	if userId <= 0 || amountUsdMicros < PartnerMinimumTransferUsdMicros || !partnerRequestIDPattern.MatchString(requestId) {
		return 0, errors.New("invalid partner transfer amount")
	}
	unitPrice := decimal.NewFromFloat(operation_setting.Price)
	if !unitPrice.IsPositive() {
		return 0, errors.New("partner balance transfer price is unavailable")
	}
	quotaDecimal := decimal.NewFromInt(amountUsdMicros).
		Div(decimal.NewFromInt(1_000_000)).
		Div(unitPrice).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Floor()
	quota, clamp := common.QuotaFromDecimalChecked(quotaDecimal)
	if clamp != nil || quota <= 0 {
		return 0, errors.New("partner balance transfer amount is unsupported")
	}

	transferredQuota := quota
	idempotencyKey := fmt.Sprintf("partner-transfer:%d:%s", userId, requestId)
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		profile, err := getEnabledPartnerProfileTx(tx, userId, true)
		if err != nil {
			return err
		}
		if profile == nil || user.Status != common.UserStatusEnabled {
			return errors.New("only partner users can transfer partner commission")
		}
		var existing PartnerWalletEntry
		if err := tx.Where("idempotency_key = ?", idempotencyKey).First(&existing).Error; err == nil {
			if existing.UserId != userId || existing.Kind != PartnerWalletEntryTransfer || existing.AmountUsdMicros != -amountUsdMicros || existing.QuotaAmount <= 0 {
				return errors.New("partner transfer request conflicts with a previous operation")
			}
			transferredQuota = existing.QuotaAmount
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		wallet, err := settleMaturePartnerCommissionsTx(tx, userId, common.GetTimestamp())
		if err != nil {
			return err
		}
		if wallet.DebtUsdMicros > 0 {
			return errors.New("partner wallet has an outstanding adjustment")
		}
		if wallet.AvailableUsdMicros < amountUsdMicros {
			return errors.New("partner commission balance is insufficient")
		}
		if user.Quota > common.MaxQuota-quota {
			return errors.New("user quota exceeds supported range")
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", quota)).Error; err != nil {
			return err
		}
		if err := tx.Model(wallet).Updates(map[string]interface{}{
			"available_usd_micros":            gorm.Expr("available_usd_micros - ?", amountUsdMicros),
			"lifetime_transferred_usd_micros": gorm.Expr("lifetime_transferred_usd_micros + ?", amountUsdMicros),
		}).Error; err != nil {
			return err
		}
		return createPartnerWalletEntryTx(tx, &PartnerWalletEntry{
			UserId:          userId,
			Kind:            PartnerWalletEntryTransfer,
			AmountUsdMicros: -amountUsdMicros,
			QuotaAmount:     quota,
			UnitPriceUsd:    unitPrice.String(),
			IdempotencyKey:  idempotencyKey,
		})
	})
	if err != nil {
		return 0, err
	}
	if err := InvalidateUserCache(userId); err != nil {
		common.SysError(fmt.Sprintf("failed to invalidate user cache after partner transfer: user_id=%d error=%q", userId, err.Error()))
	}
	return transferredQuota, nil
}

func normalizePartnerPayoutDestination(method string, destination PartnerPayoutDestination) (PartnerPayoutDestination, error) {
	method = strings.TrimSpace(method)
	destination.AlipayAccount = strings.TrimSpace(destination.AlipayAccount)
	destination.AlipayName = strings.TrimSpace(destination.AlipayName)
	destination.BSCAddress = strings.TrimSpace(destination.BSCAddress)
	switch method {
	case PartnerWithdrawalMethodAlipay:
		if len([]rune(destination.AlipayAccount)) < 5 || len([]rune(destination.AlipayAccount)) > 128 {
			return PartnerPayoutDestination{}, errors.New("invalid Alipay account")
		}
		if len([]rune(destination.AlipayName)) < 2 || len([]rune(destination.AlipayName)) > 64 {
			return PartnerPayoutDestination{}, errors.New("invalid Alipay recipient name")
		}
		if strings.ContainsAny(destination.AlipayAccount+destination.AlipayName, "\r\n\x00") {
			return PartnerPayoutDestination{}, errors.New("invalid Alipay payout details")
		}
		destination.BSCAddress = ""
	case PartnerWithdrawalMethodBSCUSDT:
		if !partnerBSCAddressPattern.MatchString(destination.BSCAddress) {
			return PartnerPayoutDestination{}, errors.New("invalid BSC USDT address")
		}
		destination.AlipayAccount = ""
		destination.AlipayName = ""
	default:
		return PartnerPayoutDestination{}, errors.New("unsupported partner withdrawal method")
	}
	return destination, nil
}

func maskPartnerPayoutDestination(method string, destination PartnerPayoutDestination) string {
	if method == PartnerWithdrawalMethodBSCUSDT {
		value := destination.BSCAddress
		if len(value) >= 12 {
			return value[:6] + "…" + value[len(value)-4:]
		}
		return "••••"
	}
	account := []rune(destination.AlipayAccount)
	maskedAccount := "••••"
	if len(account) >= 4 {
		maskedAccount = string(account[:2]) + "••••" + string(account[len(account)-2:])
	}
	name := []rune(destination.AlipayName)
	maskedName := "••"
	if len(name) > 0 {
		maskedName = string(name[0]) + strings.Repeat("•", len(name)-1)
	}
	return maskedName + " · " + maskedAccount
}

func encryptPartnerPayoutDestination(method string, destination PartnerPayoutDestination) (string, string, string, error) {
	payload, err := common.Marshal(destination)
	if err != nil {
		return "", "", "", err
	}
	encrypted, err := common.EncryptSensitiveValue(partnerPayoutCipherPurpose, string(payload))
	if err != nil {
		return "", "", "", err
	}
	digest := sha256.Sum256([]byte(method + "\x00" + string(payload) + "\x00" + common.CryptoSecret))
	return encrypted, hex.EncodeToString(digest[:]), maskPartnerPayoutDestination(method, destination), nil
}

func decryptPartnerPayoutDestination(withdrawal *PartnerWithdrawal) (PartnerPayoutDestination, error) {
	if withdrawal == nil {
		return PartnerPayoutDestination{}, errors.New("missing partner withdrawal")
	}
	plaintext, err := common.DecryptSensitiveValue(partnerPayoutCipherPurpose, withdrawal.DestinationEncrypted)
	if err != nil {
		return PartnerPayoutDestination{}, err
	}
	var destination PartnerPayoutDestination
	if err := common.Unmarshal([]byte(plaintext), &destination); err != nil {
		return PartnerPayoutDestination{}, err
	}
	return normalizePartnerPayoutDestination(withdrawal.Method, destination)
}

func CreatePartnerWithdrawal(userId int, amountUsdMicros int64, method string, destination PartnerPayoutDestination) (*PartnerWithdrawal, error) {
	if userId <= 0 || amountUsdMicros < PartnerMinimumWithdrawalUsdMicros {
		return nil, errors.New("partner withdrawal minimum is USD 20")
	}
	method = strings.TrimSpace(method)
	var err error
	destination, err = normalizePartnerPayoutDestination(method, destination)
	if err != nil {
		return nil, err
	}
	encrypted, digest, masked, err := encryptPartnerPayoutDestination(method, destination)
	if err != nil {
		return nil, err
	}

	withdrawal := &PartnerWithdrawal{}
	err = DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Select("id", "status").Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		profile, err := getEnabledPartnerProfileTx(tx, userId, true)
		if err != nil {
			return err
		}
		if user.Status != common.UserStatusEnabled || profile == nil {
			return errors.New("only active partner users can request a withdrawal")
		}
		wallet, err := settleMaturePartnerCommissionsTx(tx, userId, common.GetTimestamp())
		if err != nil {
			return err
		}
		if wallet.DebtUsdMicros > 0 {
			return errors.New("partner wallet has an outstanding adjustment")
		}
		if wallet.ActiveWithdrawalId > 0 {
			return errors.New("a partner withdrawal is already pending")
		}
		if wallet.AvailableUsdMicros < amountUsdMicros {
			return errors.New("partner commission balance is insufficient")
		}
		now := common.GetTimestamp()
		withdrawal = &PartnerWithdrawal{
			UserId:               userId,
			AmountUsdMicros:      amountUsdMicros,
			Method:               method,
			DestinationEncrypted: encrypted,
			DestinationDigest:    digest,
			DestinationMasked:    masked,
			Status:               PartnerWithdrawalStatusPending,
			RequestedAt:          now,
		}
		if err := tx.Create(withdrawal).Error; err != nil {
			return err
		}
		if err := tx.Model(wallet).Updates(map[string]interface{}{
			"available_usd_micros": gorm.Expr("available_usd_micros - ?", amountUsdMicros),
			"locked_usd_micros":    gorm.Expr("locked_usd_micros + ?", amountUsdMicros),
			"active_withdrawal_id": withdrawal.Id,
		}).Error; err != nil {
			return err
		}
		return createPartnerWalletEntryTx(tx, &PartnerWalletEntry{
			UserId:          userId,
			Kind:            PartnerWalletEntryWithdrawalLock,
			AmountUsdMicros: -amountUsdMicros,
			WithdrawalId:    withdrawal.Id,
			IdempotencyKey:  fmt.Sprintf("partner-withdrawal:%d:lock", withdrawal.Id),
		})
	})
	return withdrawal, err
}

func GetPartnerWithdrawals(userId int, pageInfo *common.PageInfo) ([]PartnerWithdrawal, int64, error) {
	if userId <= 0 || pageInfo == nil {
		return nil, 0, errors.New("invalid partner withdrawal query")
	}
	var total int64
	var items []PartnerWithdrawal
	query := DB.Model(&PartnerWithdrawal{}).Where("user_id = ?", userId)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("id DESC").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func GetPartnerWithdrawalDestination(withdrawalId int) (PartnerPayoutDestination, error) {
	var withdrawal PartnerWithdrawal
	if withdrawalId <= 0 {
		return PartnerPayoutDestination{}, errors.New("invalid partner withdrawal")
	}
	if err := DB.Where("id = ?", withdrawalId).First(&withdrawal).Error; err != nil {
		return PartnerPayoutDestination{}, err
	}
	return decryptPartnerPayoutDestination(&withdrawal)
}

func ReviewPartnerWithdrawal(withdrawalId int, adminId int, approve bool, payoutReference string, adminNote string) (*PartnerWithdrawal, error) {
	if withdrawalId <= 0 || adminId <= 0 {
		return nil, errors.New("invalid partner withdrawal review")
	}
	payoutReference = strings.TrimSpace(payoutReference)
	adminNote = strings.TrimSpace(adminNote)
	if len([]rune(adminNote)) > 500 {
		return nil, errors.New("partner withdrawal note is too long")
	}
	var reviewed PartnerWithdrawal
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("id = ?", withdrawalId).First(&reviewed).Error; err != nil {
			return err
		}
		if reviewed.Status != PartnerWithdrawalStatusPending {
			return errors.New("partner withdrawal is no longer pending")
		}
		wallet, err := ensurePartnerWalletTx(tx, reviewed.UserId)
		if err != nil {
			return err
		}
		if wallet.ActiveWithdrawalId != reviewed.Id || wallet.LockedUsdMicros < reviewed.AmountUsdMicros {
			return errors.New("partner withdrawal balance is inconsistent")
		}
		now := common.GetTimestamp()
		if approve {
			if wallet.DebtUsdMicros > 0 {
				return errors.New("partner withdrawal cannot be paid while the wallet has an outstanding adjustment")
			}
			if reviewed.Method == PartnerWithdrawalMethodBSCUSDT {
				if !partnerBSCTxHashPattern.MatchString(payoutReference) {
					return errors.New("a valid BSC transaction hash is required")
				}
			} else if payoutReference == "" {
				return errors.New("an Alipay payout reference is required")
			}
			reviewed.Status = PartnerWithdrawalStatusPaid
			reviewed.PayoutReference = payoutReference
			reviewed.ReviewedBy = adminId
			reviewed.ReviewedAt = now
			reviewed.AdminNote = adminNote
			if err := tx.Model(wallet).Updates(map[string]interface{}{
				"locked_usd_micros":             gorm.Expr("locked_usd_micros - ?", reviewed.AmountUsdMicros),
				"lifetime_withdrawn_usd_micros": gorm.Expr("lifetime_withdrawn_usd_micros + ?", reviewed.AmountUsdMicros),
				"active_withdrawal_id":          0,
			}).Error; err != nil {
				return err
			}
			if err := createPartnerWalletEntryTx(tx, &PartnerWalletEntry{
				UserId:          reviewed.UserId,
				Kind:            PartnerWalletEntryWithdrawalPaid,
				AmountUsdMicros: -reviewed.AmountUsdMicros,
				WithdrawalId:    reviewed.Id,
				IdempotencyKey:  fmt.Sprintf("partner-withdrawal:%d:paid", reviewed.Id),
			}); err != nil {
				return err
			}
		} else {
			if adminNote == "" {
				return errors.New("a rejection reason is required")
			}
			reviewed.Status = PartnerWithdrawalStatusRejected
			reviewed.ReviewedBy = adminId
			reviewed.ReviewedAt = now
			reviewed.AdminNote = adminNote
			toDebt := reviewed.AmountUsdMicros
			if toDebt > wallet.DebtUsdMicros {
				toDebt = wallet.DebtUsdMicros
			}
			unlocked := reviewed.AmountUsdMicros - toDebt
			if err := tx.Model(wallet).Updates(map[string]interface{}{
				"locked_usd_micros":    gorm.Expr("locked_usd_micros - ?", reviewed.AmountUsdMicros),
				"available_usd_micros": gorm.Expr("available_usd_micros + ?", unlocked),
				"debt_usd_micros":      gorm.Expr("debt_usd_micros - ?", toDebt),
				"active_withdrawal_id": 0,
			}).Error; err != nil {
				return err
			}
			if err := createPartnerWalletEntryTx(tx, &PartnerWalletEntry{
				UserId:          reviewed.UserId,
				Kind:            PartnerWalletEntryWithdrawalUnlock,
				AmountUsdMicros: unlocked,
				WithdrawalId:    reviewed.Id,
				IdempotencyKey:  fmt.Sprintf("partner-withdrawal:%d:rejected", reviewed.Id),
			}); err != nil {
				return err
			}
		}
		return tx.Model(&reviewed).Select("status", "payout_reference", "admin_note", "reviewed_by", "reviewed_at", "updated_at").Updates(&reviewed).Error
	})
	return &reviewed, err
}

func ConfigurePartner(userId int, basisPoints int, adminId int) (*PartnerProfile, error) {
	if userId <= 0 || adminId <= 0 {
		return nil, errors.New("invalid partner configuration")
	}
	if err := validatePartnerCommissionBasisPoints(basisPoints); err != nil {
		return nil, err
	}
	var profile PartnerProfile
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if user.Status != common.UserStatusEnabled {
			return errors.New("disabled users cannot become partners")
		}
		now := common.GetTimestamp()
		seed := PartnerProfile{
			UserId:                userId,
			Enabled:               true,
			CommissionBasisPoints: basisPoints,
			EffectiveAt:           now,
			UpdatedBy:             adminId,
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"enabled":                 true,
				"commission_basis_points": basisPoints,
				"effective_at":            now,
				"updated_by":              adminId,
				"updated_at":              now,
			}),
		}).Create(&seed).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", userId).First(&profile).Error; err != nil {
			return err
		}
		_, err := ensurePartnerWalletTx(tx, userId)
		return err
	})
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func ListPartnerProfiles(keyword string, pageInfo *common.PageInfo) ([]PartnerProfileAdminItem, int64, error) {
	if pageInfo == nil {
		return nil, 0, errors.New("missing partner profile pagination")
	}
	keyword = strings.TrimSpace(keyword)
	query := DB.Table("partner_profiles AS profiles").
		Joins("JOIN users AS users ON users.id = profiles.user_id").
		Where("profiles.enabled = ? AND users.deleted_at IS NULL", true)
	if keyword != "" {
		pattern := "%" + strings.ReplaceAll(strings.ReplaceAll(keyword, "%", "\\%"), "_", "\\_") + "%"
		query = query.Where("users.username LIKE ? OR users.email LIKE ?", pattern, pattern)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []PartnerProfileAdminItem
	if err := query.Select(
		"users.id AS user_id, users.username, users.email, profiles.commission_basis_points, " +
			"profiles.effective_at, profiles.updated_at",
	).Order("users.id DESC").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func ListPartnerWithdrawals(status string, keyword string, pageInfo *common.PageInfo) ([]PartnerWithdrawalAdminItem, int64, error) {
	if pageInfo == nil {
		return nil, 0, errors.New("missing partner withdrawal pagination")
	}
	status = strings.TrimSpace(status)
	if status != "" && status != PartnerWithdrawalStatusPending && status != PartnerWithdrawalStatusPaid && status != PartnerWithdrawalStatusRejected {
		return nil, 0, errors.New("invalid partner withdrawal status")
	}
	query := DB.Table("partner_withdrawals AS withdrawals").Joins("JOIN users AS users ON users.id = withdrawals.user_id")
	if status != "" {
		query = query.Where("withdrawals.status = ?", status)
	}
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		pattern := "%" + strings.ReplaceAll(strings.ReplaceAll(keyword, "%", "\\%"), "_", "\\_") + "%"
		query = query.Where("users.username LIKE ? OR users.email LIKE ?", pattern, pattern)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []PartnerWithdrawalAdminItem
	if err := query.Select("withdrawals.*, users.username, users.email").Order("withdrawals.id DESC").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func reversePartnerCommissionClaimTx(tx *gorm.DB, claim *ReferralRewardClaim, outcome *ReferralRewardReversalResult) error {
	if tx == nil || claim == nil || outcome == nil {
		return errors.New("missing partner reversal context")
	}
	wallet, err := ensurePartnerWalletTx(tx, claim.InviterId)
	if err != nil {
		return err
	}
	amount := claim.CommissionUsdMicros
	if amount <= 0 {
		return errors.New("invalid partner commission reversal amount")
	}
	updates := map[string]interface{}{
		"lifetime_reversed_usd_micros": gorm.Expr("lifetime_reversed_usd_micros + ?", amount),
	}
	if claim.PartnerSettlement == PartnerCommissionSettlementPending {
		if wallet.PendingUsdMicros < amount {
			return errors.New("partner pending balance is inconsistent")
		}
		updates["pending_usd_micros"] = gorm.Expr("pending_usd_micros - ?", amount)
	} else {
		fromAvailable := amount
		if fromAvailable > wallet.AvailableUsdMicros {
			fromAvailable = wallet.AvailableUsdMicros
		}
		debt := amount - fromAvailable
		updates["available_usd_micros"] = gorm.Expr("available_usd_micros - ?", fromAvailable)
		updates["debt_usd_micros"] = gorm.Expr("debt_usd_micros + ?", debt)
		outcome.UnrecoveredQuota = 0
	}
	if err := tx.Model(wallet).Updates(updates).Error; err != nil {
		return err
	}
	if err := createPartnerWalletEntryTx(tx, &PartnerWalletEntry{
		UserId:          claim.InviterId,
		Kind:            PartnerWalletEntryReversal,
		AmountUsdMicros: -amount,
		ClaimId:         claim.Id,
		IdempotencyKey:  fmt.Sprintf("partner-claim:%d:reversed", claim.Id),
	}); err != nil {
		return err
	}
	claim.PartnerSettlement = PartnerCommissionSettlementReversed
	return nil
}
