package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	// ReferralRewardBasisPoints is the percentage of each qualifying payment
	// made by a referred user that is credited to the inviter. Basis points keep
	// the calculation exact and make the API's displayed percentage match billing.
	ReferralRewardBasisPoints = 300
	ReferralRewardPercent     = 3

	ReferralRewardStatusAwarded  = "awarded"
	ReferralRewardStatusWithheld = "withheld"
	ReferralRewardStatusReversed = "reversed"

	referralPaymentReferenceGateway = "gateway"
	referralPaymentReferenceTrade   = "trade"

	referralPaymentVerificationMigrationKey = "ReferralPaymentVerificationMigrationV1"
	legacyReferralInviteeUniqueIndex        = "idx_referral_reward_claims_invitee_id"
	referralPaymentReferenceUniqueIndex     = "uidx_referral_reward_claims_payment_reference"
)

// ReferralPaymentState serializes reward grants and payment reversals for one
// canonical provider reference. ReferenceDigest is deliberately the only copy
// of the gateway reference in this table: it keeps provider identifiers out of
// the payment-state table and avoids cross-dialect composite-index limits.
type ReferralPaymentState struct {
	Id                  int    `json:"id"`
	ReferenceDigest     string `json:"-" gorm:"column:reference_digest;type:char(64);uniqueIndex"`
	PaymentProvider     string `json:"-" gorm:"column:payment_provider;type:varchar(50);index"`
	ReferenceKind       string `json:"-" gorm:"column:reference_kind;type:varchar(16)"`
	RefundedAt          int64  `json:"-" gorm:"column:refunded_at;index"`
	ReversalEventDigest string `json:"-" gorm:"column:reversal_event_digest;type:char(64)"`
	ReversalReason      string `json:"-" gorm:"column:reversal_reason;type:varchar(255)"`
	CreatedAt           int64  `json:"-" gorm:"autoCreateTime"`
	UpdatedAt           int64  `json:"-" gorm:"autoUpdateTime"`
}

// ReferralRewardClaim is the immutable source of truth for per-payment
// referral rewards. PaymentReferenceDigest, TopUpId, and TradeNo provide
// independent idempotency barriers when duplicate gateway callbacks arrive
// concurrently. Reversal fields are kept in the ledger so refunded or disputed
// payments can be reconciled without rewriting the original award.
type ReferralRewardClaim struct {
	Id                     int     `json:"id"`
	InviteeId              int     `json:"invitee_id" gorm:"column:invitee_id;index:idx_referral_reward_claims_invitee_lookup"`
	InviterId              int     `json:"inviter_id" gorm:"column:inviter_id;index"`
	TopUpId                int     `json:"top_up_id" gorm:"column:top_up_id;uniqueIndex"`
	TradeNo                string  `json:"trade_no" gorm:"type:varchar(255);uniqueIndex"`
	PaymentReferenceDigest *string `json:"-" gorm:"column:payment_reference_digest;type:char(64)"`
	PaymentProvider        string  `json:"payment_provider" gorm:"type:varchar(50);index"`
	PaidAmount             string  `json:"paid_amount" gorm:"type:varchar(64)"`
	PaidCurrency           string  `json:"paid_currency" gorm:"type:varchar(12)"`
	RateBasisPoints        int     `json:"rate_basis_points"`
	RewardQuota            int     `json:"reward_quota"`
	ReversedQuota          int     `json:"reversed_quota" gorm:"default:0"`
	Status                 string  `json:"status" gorm:"type:varchar(24);index"`
	GatewayEventId         string  `json:"gateway_event_id" gorm:"type:varchar(255);index"`
	GatewayPaymentId       string  `json:"gateway_payment_id" gorm:"type:varchar(255);index"`
	ReversalEventId        string  `json:"reversal_event_id" gorm:"type:varchar(255);index"`
	ReversalReason         string  `json:"reversal_reason" gorm:"type:varchar(255)"`
	ReversedAt             int64   `json:"reversed_at"`
	CreatedAt              int64   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt              int64   `json:"updated_at" gorm:"autoUpdateTime"`
}

// referralRewardPaymentReferenceIndex keeps unique-index creation separate
// from AutoMigrate. SQLite cannot ALTER an existing table to add a column with
// an inline UNIQUE constraint, but it can add the nullable column first and
// create a unique index afterward.
type referralRewardPaymentReferenceIndex struct {
	PaymentReferenceDigest *string `gorm:"column:payment_reference_digest;uniqueIndex:uidx_referral_reward_claims_payment_reference"`
}

func (referralRewardPaymentReferenceIndex) TableName() string {
	return "referral_reward_claims"
}

// ReferralRewardHistoryItem is the only referral-claim shape returned to an
// end user. In particular, it intentionally omits invitee IDs, usernames,
// emails, top-up/order identifiers, trade numbers, and gateway identifiers.
type ReferralRewardHistoryItem struct {
	Id              int    `json:"id"`
	InviteeLabel    string `json:"invitee_label"`
	PaymentProvider string `json:"payment_provider"`
	PaidAmount      string `json:"paid_amount"`
	PaidCurrency    string `json:"paid_currency"`
	RewardQuota     int    `json:"reward_quota"`
	RateBasisPoints int    `json:"rate_basis_points"`
	Status          string `json:"status"`
	CreatedAt       int64  `json:"created_at"`
}

type referralRewardHistoryRow struct {
	Id              int
	InviteeId       int
	PaymentProvider string
	PaidAmount      string
	PaidCurrency    string
	RewardQuota     int
	RateBasisPoints int
	Status          string
	CreatedAt       int64
}

type referralRewardInviteeIdentity struct {
	Id       int
	Username string
	Email    string
}

type ReferralRewardReversalResult struct {
	Changed          bool
	ClaimId          int
	InviterId        int
	RewardQuota      int
	UnrecoveredQuota int
}

// VerifiedPayment contains only values obtained from a successfully verified
// provider callback. Never construct it from browser input or TopUp.Money.
type VerifiedPayment struct {
	Amount           decimal.Decimal
	Currency         string
	GatewayEventId   string
	GatewayPaymentId string
	Production       bool
}

func (payment VerifiedPayment) PaidAmountForLog() string {
	if payment.Amount.IsZero() {
		return "0"
	}
	return payment.Amount.String()
}

func logReferralRewardGrant(granted bool, inviterId int, inviteeId int, tradeNo string, rewardQuota int, payment VerifiedPayment) {
	if !granted {
		return
	}
	common.SysLog("referral reward awarded: inviter_id=" + decimal.NewFromInt(int64(inviterId)).String() +
		" invitee_id=" + decimal.NewFromInt(int64(inviteeId)).String() +
		" trade_no=" + tradeNo +
		" paid_amount=" + payment.PaidAmountForLog() +
		" paid_currency=" + payment.Currency +
		" reward_quota=" + decimal.NewFromInt(int64(rewardQuota)).String())
}

func NewVerifiedPayment(amount string, currency string, gatewayEventId string, gatewayPaymentId string, production bool) (VerifiedPayment, error) {
	parsed, err := decimal.NewFromString(strings.TrimSpace(amount))
	if err != nil {
		return VerifiedPayment{}, errors.New("invalid verified payment amount")
	}
	if !parsed.IsPositive() {
		return VerifiedPayment{}, errors.New("verified payment amount must be positive")
	}
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency == "" {
		return VerifiedPayment{}, errors.New("verified payment currency is required")
	}
	return VerifiedPayment{
		Amount:           parsed,
		Currency:         currency,
		GatewayEventId:   strings.TrimSpace(gatewayEventId),
		GatewayPaymentId: strings.TrimSpace(gatewayPaymentId),
		Production:       production,
	}, nil
}

// NewVerifiedMinorUnitPayment converts the gateway's integer minor units to a
// precise major-unit amount. Stripe and Creem both report callback totals in
// minor units.
func NewVerifiedMinorUnitPayment(amount int64, currency string, gatewayEventId string, gatewayPaymentId string, production bool) (VerifiedPayment, error) {
	if amount <= 0 {
		return VerifiedPayment{}, errors.New("verified payment amount must be positive")
	}
	exponent := currencyMinorUnitExponent(currency)
	major := decimal.NewFromInt(amount).Shift(-exponent)
	return NewVerifiedPayment(major.String(), currency, gatewayEventId, gatewayPaymentId, production)
}

func currencyMinorUnitExponent(currency string) int32 {
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF":
		return 0
	case "BHD", "JOD", "KWD", "OMR", "TND":
		return 3
	default:
		return 2
	}
}

func isReferralRewardProvider(provider string) bool {
	switch provider {
	case PaymentProviderEpay, PaymentProviderStripe, PaymentProviderCreem, PaymentProviderWaffo, PaymentProviderWaffoPancake:
		return true
	default:
		return false
	}
}

// Referral rewards use RelayBases' configured one-unit billing basis. The
// supported settlement currencies are treated as one billing unit per credit;
// other currencies must not be converted by their nominal amount because doing
// so would over-credit zero-decimal currencies such as JPY.
func isReferralRewardCurrency(currency string) bool {
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case "CNY", "USD":
		return true
	default:
		return false
	}
}

func referralRewardProviders() []string {
	return []string{
		PaymentProviderEpay,
		PaymentProviderStripe,
		PaymentProviderCreem,
		PaymentProviderWaffo,
		PaymentProviderWaffoPancake,
	}
}

// MigrateReferralRewardsEveryPayment removes the legacy one-reward-per-invitee
// uniqueness barrier. The replacement lookup index has a distinct name, so
// this drop is safe and idempotent on SQLite, MySQL, and PostgreSQL.
func MigrateReferralRewardsEveryPayment() error {
	migrator := DB.Migrator()
	if !migrator.HasIndex(&referralRewardPaymentReferenceIndex{}, referralPaymentReferenceUniqueIndex) {
		if err := migrator.CreateIndex(&referralRewardPaymentReferenceIndex{}, referralPaymentReferenceUniqueIndex); err != nil {
			return err
		}
	}
	if !migrator.HasIndex(&ReferralRewardClaim{}, legacyReferralInviteeUniqueIndex) {
		return nil
	}
	return migrator.DropIndex(&ReferralRewardClaim{}, legacyReferralInviteeUniqueIndex)
}

func referralPaymentReferenceDigest(paymentProvider string, referenceKind string, referenceValue string) (string, error) {
	paymentProvider = strings.TrimSpace(paymentProvider)
	referenceKind = strings.TrimSpace(referenceKind)
	referenceValue = strings.TrimSpace(referenceValue)
	if !isReferralRewardProvider(paymentProvider) ||
		(referenceKind != referralPaymentReferenceGateway && referenceKind != referralPaymentReferenceTrade) ||
		referenceValue == "" {
		return "", errors.New("invalid referral payment reference")
	}
	digest := sha256.Sum256([]byte(paymentProvider + "\x00" + referenceKind + "\x00" + referenceValue))
	return fmt.Sprintf("%x", digest), nil
}

// lockReferralPaymentState is the first referral-specific lock taken by both
// grant and reversal paths. The insert handles the first callback for a
// payment; the following row lock serializes payment/refund callbacks until
// their surrounding transaction commits on MySQL and PostgreSQL. SQLite
// serializes the preceding write transaction and does not support FOR UPDATE.
func lockReferralPaymentState(tx *gorm.DB, paymentProvider string, referenceKind string, referenceValue string) (*ReferralPaymentState, error) {
	if tx == nil {
		return nil, errors.New("missing referral payment state transaction")
	}
	digest, err := referralPaymentReferenceDigest(paymentProvider, referenceKind, referenceValue)
	if err != nil {
		return nil, err
	}

	state := &ReferralPaymentState{
		ReferenceDigest: digest,
		PaymentProvider: strings.TrimSpace(paymentProvider),
		ReferenceKind:   strings.TrimSpace(referenceKind),
	}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(state).Error; err != nil {
		return nil, err
	}
	if err := lockForUpdate(tx).Where("reference_digest = ?", digest).First(state).Error; err != nil {
		return nil, err
	}
	return state, nil
}

func referralRewardGrantReference(topUp *TopUp, payment VerifiedPayment) (string, string, bool) {
	if topUp == nil {
		return "", "", false
	}

	var referenceKind string
	var referenceValue string
	switch topUp.PaymentProvider {
	case PaymentProviderEpay, PaymentProviderStripe, PaymentProviderCreem:
		referenceKind = referralPaymentReferenceGateway
		referenceValue = payment.GatewayPaymentId
	case PaymentProviderWaffo:
		referenceKind = referralPaymentReferenceGateway
		// Waffo refunds identify the original PaymentRequestID, which is
		// recorded as GatewayEventId by its verified payment callback.
		referenceValue = payment.GatewayEventId
	case PaymentProviderWaffoPancake:
		referenceKind = referralPaymentReferenceTrade
		referenceValue = topUp.TradeNo
	default:
		return "", "", false
	}

	referenceValue = strings.TrimSpace(referenceValue)
	if referenceValue == "" {
		return "", "", false
	}
	return referenceKind, referenceValue, true
}

func referralRewardClaimReference(paymentProvider string, referenceKind string, referenceValue string) (string, []interface{}, error) {
	paymentProvider = strings.TrimSpace(paymentProvider)
	referenceValue = strings.TrimSpace(referenceValue)
	if _, err := referralPaymentReferenceDigest(paymentProvider, referenceKind, referenceValue); err != nil {
		return "", nil, err
	}

	if referenceKind == referralPaymentReferenceTrade {
		if paymentProvider != PaymentProviderWaffoPancake {
			return "", nil, errors.New("invalid referral reward trade reversal provider")
		}
		return "payment_provider = ? AND trade_no = ?", []interface{}{paymentProvider, referenceValue}, nil
	}

	switch paymentProvider {
	case PaymentProviderEpay, PaymentProviderStripe, PaymentProviderCreem:
		return "payment_provider = ? AND gateway_payment_id = ?", []interface{}{paymentProvider, referenceValue}, nil
	case PaymentProviderWaffo:
		return "payment_provider = ? AND gateway_event_id = ?", []interface{}{paymentProvider, referenceValue}, nil
	default:
		return "", nil, errors.New("invalid referral reward gateway reversal provider")
	}
}

// InitializeReferralPaymentVerification performs a one-time compatibility
// migration. Successful external top-ups that predate this column retain their
// verified-payment classification. Future manual completions remain unverified.
func InitializeReferralPaymentVerification() error {
	var backfilled int64
	err := DB.Transaction(func(tx *gorm.DB) error {
		var marker Option
		err := tx.Where(&Option{Key: referralPaymentVerificationMigrationKey}).First(&marker).Error
		if err == nil {
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		result := tx.Model(&TopUp{}).
			Where("status = ? AND payment_provider IN ? AND referral_payment_verified = ?", common.TopUpStatusSuccess, referralRewardProviders(), false).
			Update("referral_payment_verified", true)
		if result.Error != nil {
			return result.Error
		}
		backfilled = result.RowsAffected

		return tx.Clauses(clause.OnConflict{DoNothing: true}).
			Create(&Option{Key: referralPaymentVerificationMigrationKey, Value: "done"}).Error
	})
	if err == nil && backfilled > 0 {
		common.SysLog("backfilled legacy verified referral payments: count=" + decimal.NewFromInt(backfilled).String())
	}
	return err
}

// grantPaidReferralRewardTx awards one referral reward for each qualifying
// signed production payment. It must be called inside the same transaction that
// marks the TopUp successful and credits the buyer.
func grantPaidReferralRewardTx(tx *gorm.DB, topUp *TopUp, payment VerifiedPayment) (bool, int, int, error) {
	if tx == nil || topUp == nil {
		return false, 0, 0, errors.New("missing referral reward transaction context")
	}
	if !payment.Production || !payment.Amount.IsPositive() || !isReferralRewardProvider(topUp.PaymentProvider) {
		return false, 0, 0, nil
	}
	if !isReferralRewardCurrency(payment.Currency) {
		common.SysError("skipped referral reward because verified payment currency is outside the configured billing basis: provider=" +
			topUp.PaymentProvider + " currency=" + strings.ToUpper(strings.TrimSpace(payment.Currency)))
		return false, 0, 0, nil
	}
	referenceKind, referenceValue, ok := referralRewardGrantReference(topUp, payment)
	if !ok {
		// A missing canonical provider reference must never turn a successful
		// buyer payment into a failed top-up. Skipping the reward is the safe
		// outcome because a later refund could not be correlated reliably.
		common.SysError("skipped referral reward because verified payment lacks canonical reference: provider=" + topUp.PaymentProvider)
		return false, 0, 0, nil
	}
	paymentState, err := lockReferralPaymentState(tx, topUp.PaymentProvider, referenceKind, referenceValue)
	if err != nil {
		return false, 0, 0, err
	}
	if paymentState.RefundedAt > 0 {
		// The signed refund/dispute callback won the race. Holding the same
		// payment-state lock makes this decision atomic with reversal handling.
		return false, 0, 0, nil
	}

	invitee := &User{}
	if err := lockForUpdate(tx).Select("id", "inviter_id").Where("id = ?", topUp.UserId).First(invitee).Error; err != nil {
		return false, 0, 0, err
	}
	if invitee.InviterId <= 0 || invitee.InviterId == invitee.Id {
		return false, 0, 0, nil
	}

	var inviter User
	if err := lockForUpdate(tx).
		Select("id", "status", "aff_count", "aff_quota", "aff_history").
		Where("id = ?", invitee.InviterId).
		First(&inviter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, 0, 0, nil
		}
		return false, 0, 0, err
	}
	if inviter.Status != common.UserStatusEnabled {
		return false, 0, 0, nil
	}

	rewardDecimal := payment.Amount.
		Mul(decimal.NewFromInt(ReferralRewardBasisPoints)).
		Div(decimal.NewFromInt(10000)).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Floor()
	if !rewardDecimal.IsPositive() {
		return false, 0, 0, nil
	}
	rewardQuota, clamp := common.QuotaFromDecimalChecked(rewardDecimal)
	if clamp != nil {
		return false, 0, 0, errors.New("referral reward quota exceeds supported range")
	}

	rewardStatus := ReferralRewardStatusAwarded
	if inviter.AffCount >= common.MaxQuota ||
		inviter.AffQuota > common.MaxQuota-rewardQuota ||
		inviter.AffHistoryQuota > common.MaxQuota-rewardQuota {
		// Referral accounting must never overflow a 32-bit quota column or
		// prevent the buyer's verified payment from completing. Preserve the
		// exact entitlement in the immutable ledger for manual settlement.
		rewardStatus = ReferralRewardStatusWithheld
	}

	claim := &ReferralRewardClaim{
		InviteeId:              topUp.UserId,
		InviterId:              inviter.Id,
		TopUpId:                topUp.Id,
		TradeNo:                topUp.TradeNo,
		PaymentReferenceDigest: &paymentState.ReferenceDigest,
		PaymentProvider:        topUp.PaymentProvider,
		PaidAmount:             payment.Amount.String(),
		PaidCurrency:           payment.Currency,
		RateBasisPoints:        ReferralRewardBasisPoints,
		RewardQuota:            rewardQuota,
		Status:                 rewardStatus,
		GatewayEventId:         payment.GatewayEventId,
		GatewayPaymentId:       payment.GatewayPaymentId,
	}
	result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(claim)
	if result.Error != nil {
		return false, 0, 0, result.Error
	}
	if result.RowsAffected == 0 {
		return false, 0, 0, nil
	}
	if rewardStatus == ReferralRewardStatusWithheld {
		common.SysError("referral reward withheld because inviter quota accounting reached its supported range: inviter_id=" +
			decimal.NewFromInt(int64(inviter.Id)).String() +
			" invitee_id=" + decimal.NewFromInt(int64(invitee.Id)).String() +
			" reward_quota=" + decimal.NewFromInt(int64(rewardQuota)).String())
		return false, inviter.Id, rewardQuota, nil
	}

	result = tx.Model(&User{}).
		Where("id = ? AND status = ?", inviter.Id, common.UserStatusEnabled).
		Updates(map[string]interface{}{
			"aff_count":   gorm.Expr("aff_count + 1"),
			"aff_quota":   gorm.Expr("aff_quota + ?", rewardQuota),
			"aff_history": gorm.Expr("aff_history + ?", rewardQuota),
		})
	if result.Error != nil {
		return false, 0, 0, result.Error
	}
	if result.RowsAffected != 1 {
		return false, 0, 0, errors.New("referral inviter became unavailable")
	}

	return true, inviter.Id, rewardQuota, nil
}

func GetQualifiedReferralPaymentCount(inviterId int) (int64, error) {
	var count int64
	err := DB.Model(&ReferralRewardClaim{}).
		Where("inviter_id = ? AND status IN ?", inviterId, []string{ReferralRewardStatusAwarded, ReferralRewardStatusWithheld}).
		Count(&count).Error
	return count, err
}

func truncateReferralReversalReason(reason string) string {
	runes := []rune(strings.TrimSpace(reason))
	if len(runes) > 200 {
		runes = runes[:200]
	}
	if len(runes) == 0 {
		return "payment refunded or disputed"
	}
	return string(runes)
}

func reverseReferralRewardClaimTx(tx *gorm.DB, where string, args []interface{}, reversalEventId string, reason string, outcome *ReferralRewardReversalResult) error {
	var claim ReferralRewardClaim
	err := lockForUpdate(tx).Where(where, args...).Order("id DESC").First(&claim).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	outcome.ClaimId = claim.Id
	outcome.InviterId = claim.InviterId
	outcome.RewardQuota = claim.RewardQuota
	if claim.Status == ReferralRewardStatusReversed {
		return nil
	}

	if claim.Status == ReferralRewardStatusAwarded {
		var inviter User
		err = lockForUpdate(tx.Unscoped()).Where("id = ?", claim.InviterId).First(&inviter).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err == nil {
			remaining := claim.RewardQuota
			fromAffQuota := 0
			if inviter.AffQuota > 0 {
				fromAffQuota = inviter.AffQuota
				if fromAffQuota > remaining {
					fromAffQuota = remaining
				}
			}
			remaining -= fromAffQuota

			newQuota := int64(inviter.Quota) - int64(remaining)
			if newQuota < int64(common.MinQuota) {
				outcome.UnrecoveredQuota = int(int64(common.MinQuota) - newQuota)
				newQuota = int64(common.MinQuota)
			}

			newAffHistory := inviter.AffHistoryQuota - claim.RewardQuota
			if newAffHistory < 0 {
				newAffHistory = 0
			}
			newAffCount := inviter.AffCount - 1
			if newAffCount < 0 {
				newAffCount = 0
			}

			if err := tx.Unscoped().Model(&User{}).Where("id = ?", inviter.Id).Updates(map[string]interface{}{
				"aff_quota":   inviter.AffQuota - fromAffQuota,
				"aff_history": newAffHistory,
				"aff_count":   newAffCount,
				"quota":       int(newQuota),
			}).Error; err != nil {
				return err
			}
		} else {
			outcome.UnrecoveredQuota = claim.RewardQuota
		}
	}

	claim.Status = ReferralRewardStatusReversed
	claim.ReversedQuota = claim.RewardQuota
	claim.ReversalEventId = reversalEventId
	claim.ReversalReason = reason
	claim.ReversedAt = common.GetTimestamp()
	claim.UpdatedAt = claim.ReversedAt
	if err := tx.Model(&claim).Select("status", "reversed_quota", "reversal_event_id", "reversal_reason", "reversed_at", "updated_at").Updates(&claim).Error; err != nil {
		return err
	}

	outcome.Changed = true
	return nil
}

func finishReferralRewardReversal(outcome ReferralRewardReversalResult, reason string) (ReferralRewardReversalResult, error) {
	// A reward may already have been transferred from AffQuota into the normal
	// spendable balance. The database transaction above is authoritative, so
	// discard any pre-refund Redis snapshot only after the commit succeeds.
	// This is also attempted for idempotent retries: if Redis was temporarily
	// unavailable after the first callback, the gateway retry can still repair
	// the stale cache without deducting the reward twice.
	if outcome.ClaimId > 0 && outcome.InviterId > 0 {
		if err := InvalidateUserCache(outcome.InviterId); err != nil {
			common.SysError("failed to invalidate inviter cache after referral reward reversal: claim_id=" +
				decimal.NewFromInt(int64(outcome.ClaimId)).String() +
				" inviter_id=" + decimal.NewFromInt(int64(outcome.InviterId)).String() +
				" error=" + err.Error())
			return outcome, fmt.Errorf("invalidate inviter cache after referral reward reversal: %w", err)
		}
	}
	if !outcome.Changed {
		return outcome, nil
	}

	RecordLog(outcome.InviterId, LogTypeSystem, fmt.Sprintf("邀请返利已撤销，金额: %s，原因: %s", logger.FormatQuota(outcome.RewardQuota), reason))
	if outcome.UnrecoveredQuota > 0 {
		common.SysError("referral reward reversal left unrecovered quota: claim_id=" +
			decimal.NewFromInt(int64(outcome.ClaimId)).String() +
			" inviter_id=" + decimal.NewFromInt(int64(outcome.InviterId)).String() +
			" unrecovered_quota=" + decimal.NewFromInt(int64(outcome.UnrecoveredQuota)).String())
	}
	return outcome, nil
}

func reverseReferralReward(where string, args []interface{}, reversalEventId string, reason string) (ReferralRewardReversalResult, error) {
	outcome := ReferralRewardReversalResult{}
	reason = truncateReferralReversalReason(reason)
	reversalEventId = strings.TrimSpace(reversalEventId)

	err := DB.Transaction(func(tx *gorm.DB) error {
		return reverseReferralRewardClaimTx(tx, where, args, reversalEventId, reason, &outcome)
	})
	if err != nil {
		return ReferralRewardReversalResult{}, err
	}
	return finishReferralRewardReversal(outcome, reason)
}

func reverseReferralRewardByPaymentReference(paymentProvider string, referenceKind string, referenceValue string, reversalEventId string, reason string) (ReferralRewardReversalResult, error) {
	where, args, err := referralRewardClaimReference(paymentProvider, referenceKind, referenceValue)
	if err != nil {
		return ReferralRewardReversalResult{}, err
	}
	reason = truncateReferralReversalReason(reason)
	reversalEventId = strings.TrimSpace(reversalEventId)
	outcome := ReferralRewardReversalResult{}

	err = DB.Transaction(func(tx *gorm.DB) error {
		paymentState, err := lockReferralPaymentState(tx, paymentProvider, referenceKind, referenceValue)
		if err != nil {
			return err
		}
		if paymentState.RefundedAt == 0 {
			eventDigest := ""
			if reversalEventId != "" {
				digest := sha256.Sum256([]byte(reversalEventId))
				eventDigest = fmt.Sprintf("%x", digest)
			}
			paymentState.RefundedAt = common.GetTimestamp()
			paymentState.ReversalEventDigest = eventDigest
			paymentState.ReversalReason = reason
			paymentState.UpdatedAt = paymentState.RefundedAt
			if err := tx.Model(paymentState).
				Select("refunded_at", "reversal_event_digest", "reversal_reason", "updated_at").
				Updates(paymentState).Error; err != nil {
				return err
			}
		}

		return reverseReferralRewardClaimTx(tx, where, args, reversalEventId, reason, &outcome)
	})
	if err != nil {
		return ReferralRewardReversalResult{}, err
	}
	return finishReferralRewardReversal(outcome, reason)
}

func ReverseReferralRewardByGatewayReference(paymentProvider string, gatewayReference string, reversalEventId string, reason string) (ReferralRewardReversalResult, error) {
	return reverseReferralRewardByPaymentReference(
		paymentProvider,
		referralPaymentReferenceGateway,
		gatewayReference,
		reversalEventId,
		reason,
	)
}

func ReverseReferralRewardByTradeNo(paymentProvider string, tradeNo string, reversalEventId string, reason string) (ReferralRewardReversalResult, error) {
	return reverseReferralRewardByPaymentReference(
		paymentProvider,
		referralPaymentReferenceTrade,
		tradeNo,
		reversalEventId,
		reason,
	)
}

func ReverseReferralRewardById(claimId int, reversalEventId string, reason string) (ReferralRewardReversalResult, error) {
	if claimId <= 0 {
		return ReferralRewardReversalResult{}, errors.New("invalid referral reward claim id")
	}
	return reverseReferralReward("id = ?", []interface{}{claimId}, reversalEventId, reason)
}

func maskReferralIdentifier(value string) string {
	runes := []rune(strings.TrimSpace(value))
	switch len(runes) {
	case 0:
		return ""
	case 1:
		return "***"
	case 2:
		return string(runes[0]) + "***"
	default:
		return string(runes[0]) + "***" + string(runes[len(runes)-1])
	}
}

func maskReferralEmail(email string) string {
	email = strings.TrimSpace(email)
	at := strings.LastIndex(email, "@")
	if at <= 0 || at == len(email)-1 {
		return maskReferralIdentifier(email)
	}
	return maskReferralIdentifier(email[:at]) + email[at:]
}

func maskedReferralInviteeLabel(identity referralRewardInviteeIdentity) string {
	if username := strings.TrimSpace(identity.Username); username != "" {
		if strings.Contains(username, "@") {
			return maskReferralEmail(username)
		}
		return maskReferralIdentifier(username)
	}
	return maskReferralEmail(identity.Email)
}

// GetReferralRewardHistory returns only the current inviter's privacy-safe
// referral ledger projection. Callers must supply the authenticated user ID;
// no invitee or inviter selector is accepted from request parameters.
func GetReferralRewardHistory(inviterId int, pageInfo *common.PageInfo) ([]ReferralRewardHistoryItem, int64, error) {
	var total int64
	var rows []referralRewardHistoryRow

	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	query := tx.Model(&ReferralRewardClaim{}).Where("inviter_id = ?", inviterId)
	if err := query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err := query.
		Select("id, invitee_id, payment_provider, paid_amount, paid_currency, reward_quota, rate_basis_points, status, created_at").
		Order("id DESC").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Scan(&rows).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	inviteeIds := make([]int, 0, len(rows))
	for _, row := range rows {
		inviteeIds = append(inviteeIds, row.InviteeId)
	}
	identities := make([]referralRewardInviteeIdentity, 0, len(inviteeIds))
	if len(inviteeIds) > 0 {
		if err := tx.Model(&User{}).
			Select("id, username, email").
			Where("id IN ?", inviteeIds).
			Scan(&identities).Error; err != nil {
			tx.Rollback()
			return nil, 0, err
		}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	identityById := make(map[int]referralRewardInviteeIdentity, len(identities))
	for _, identity := range identities {
		identityById[identity.Id] = identity
	}

	items := make([]ReferralRewardHistoryItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, ReferralRewardHistoryItem{
			Id:              row.Id,
			InviteeLabel:    maskedReferralInviteeLabel(identityById[row.InviteeId]),
			PaymentProvider: row.PaymentProvider,
			PaidAmount:      row.PaidAmount,
			PaidCurrency:    row.PaidCurrency,
			RewardQuota:     row.RewardQuota,
			RateBasisPoints: row.RateBasisPoints,
			Status:          row.Status,
			CreatedAt:       row.CreatedAt,
		})
	}

	return items, total, nil
}
