package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const adminReferralSearchMaxLength = 100

// AdminReferralRewardFilter contains the bounded, allow-listed filters exposed
// by the site-wide referral ledger. Payment and gateway identifiers are never
// accepted as filters because they are deliberately absent from the response.
type AdminReferralRewardFilter struct {
	Keyword  string
	Status   string
	Provider string
}

// AdminReferralRewardSummary is a site-wide accounting snapshot. Quota totals
// use int64 because they aggregate many int32-compatible reward rows.
type AdminReferralRewardSummary struct {
	TotalRecords        int64 `json:"total_records"`
	AwardedRecords      int64 `json:"awarded_records"`
	WithheldRecords     int64 `json:"withheld_records"`
	ReversedRecords     int64 `json:"reversed_records"`
	AwardedRewardQuota  int64 `json:"awarded_reward_quota"`
	ActiveRewardQuota   int64 `json:"active_reward_quota"`
	ReversedRewardQuota int64 `json:"reversed_reward_quota"`
	UniqueInviters      int64 `json:"unique_inviters"`
	UniqueInvitees      int64 `json:"unique_invitees"`
}

// AdminReferralRewardItem is the privacy-aware projection used by the admin
// dashboard. User IDs remain available for operational follow-up, while names
// and email addresses are masked. Order, trade, payment, and gateway event
// identifiers are intentionally excluded.
type AdminReferralRewardItem struct {
	Id              int    `json:"id"`
	InviterId       int    `json:"inviter_id"`
	InviterLabel    string `json:"inviter_label"`
	InviteeId       int    `json:"invitee_id"`
	InviteeLabel    string `json:"invitee_label"`
	PaymentProvider string `json:"payment_provider"`
	PaidAmount      string `json:"paid_amount"`
	PaidCurrency    string `json:"paid_currency"`
	RateBasisPoints int    `json:"rate_basis_points"`
	RewardQuota     int    `json:"reward_quota"`
	ReversedQuota   int    `json:"reversed_quota"`
	Status          string `json:"status"`
	ReversalReason  string `json:"reversal_reason,omitempty"`
	ReversedAt      int64  `json:"reversed_at,omitempty"`
	CreatedAt       int64  `json:"created_at"`
}

type adminReferralRewardRow struct {
	Id              int
	InviterId       int
	InviterUsername string
	InviterEmail    string
	InviteeId       int
	InviteeUsername string
	InviteeEmail    string
	PaymentProvider string
	PaidAmount      string
	PaidCurrency    string
	RateBasisPoints int
	RewardQuota     int
	ReversedQuota   int
	Status          string
	ReversalReason  string
	ReversedAt      int64
	CreatedAt       int64
}

func normalizeAdminReferralRewardFilter(filter AdminReferralRewardFilter) (AdminReferralRewardFilter, error) {
	filter.Keyword = strings.TrimSpace(filter.Keyword)
	filter.Status = strings.ToLower(strings.TrimSpace(filter.Status))
	filter.Provider = strings.ToLower(strings.TrimSpace(filter.Provider))

	if len([]rune(filter.Keyword)) > adminReferralSearchMaxLength {
		return AdminReferralRewardFilter{}, errors.New("referral reward search is too long")
	}
	if filter.Status != "" {
		switch filter.Status {
		case ReferralRewardStatusAwarded, ReferralRewardStatusWithheld, ReferralRewardStatusReversed:
		default:
			return AdminReferralRewardFilter{}, errors.New("invalid referral reward status")
		}
	}
	if filter.Provider != "" && !isReferralRewardProvider(filter.Provider) {
		return AdminReferralRewardFilter{}, errors.New("invalid referral payment provider")
	}
	return filter, nil
}

func escapeAdminReferralLike(value string) string {
	value = strings.ReplaceAll(value, "!", "!!")
	value = strings.ReplaceAll(value, "%", "!%")
	value = strings.ReplaceAll(value, "_", "!_")
	return "%" + value + "%"
}

func applyAdminReferralRewardFilter(query *gorm.DB, filter AdminReferralRewardFilter) *gorm.DB {
	if filter.Status != "" {
		query = query.Where("rewards.status = ?", filter.Status)
	}
	if filter.Provider != "" {
		query = query.Where("rewards.payment_provider = ?", filter.Provider)
	}
	if filter.Keyword == "" {
		return query
	}

	pattern := escapeAdminReferralLike(filter.Keyword)
	identityFilter := "LOWER(inviters.username) LIKE LOWER(?) ESCAPE '!' OR LOWER(inviters.email) LIKE LOWER(?) ESCAPE '!' OR LOWER(invitees.username) LIKE LOWER(?) ESCAPE '!' OR LOWER(invitees.email) LIKE LOWER(?) ESCAPE '!'"
	args := []interface{}{pattern, pattern, pattern, pattern}
	if userId, err := strconv.Atoi(filter.Keyword); err == nil && userId > 0 {
		identityFilter += " OR rewards.inviter_id = ? OR rewards.invitee_id = ?"
		args = append(args, userId, userId)
	}
	return query.Where(identityFilter, args...)
}

// GetAdminReferralRewardDashboard returns a globally scoped summary and a
// filtered ledger page. The summary intentionally remains site-wide when the
// table is filtered so operators always retain the overall accounting view.
func GetAdminReferralRewardDashboard(filter AdminReferralRewardFilter, pageInfo *common.PageInfo) ([]AdminReferralRewardItem, int64, AdminReferralRewardSummary, error) {
	if pageInfo == nil {
		return nil, 0, AdminReferralRewardSummary{}, errors.New("missing referral reward pagination")
	}
	page := pageInfo.GetPage()
	if page < 1 {
		page = 1
	}
	pageSize := pageInfo.GetPageSize()
	if pageSize < 1 {
		pageSize = common.ItemsPerPage
	}
	if pageSize > 100 {
		pageSize = 100
	}
	startIdx := (page - 1) * pageSize

	filter, err := normalizeAdminReferralRewardFilter(filter)
	if err != nil {
		return nil, 0, AdminReferralRewardSummary{}, err
	}

	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, AdminReferralRewardSummary{}, tx.Error
	}
	defer func() {
		if recovered := recover(); recovered != nil {
			tx.Rollback()
			panic(recovered)
		}
	}()

	summary := AdminReferralRewardSummary{}
	if err := tx.Model(&ReferralRewardClaim{}).
		Select(
			"COUNT(*) AS total_records, "+
				"COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS awarded_records, "+
				"COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS withheld_records, "+
				"COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) AS reversed_records, "+
				"COALESCE(SUM(CASE WHEN status IN ? THEN reward_quota ELSE 0 END), 0) AS awarded_reward_quota, "+
				"COALESCE(SUM(CASE WHEN status = ? THEN reward_quota ELSE 0 END), 0) AS active_reward_quota, "+
				"COALESCE(SUM(reversed_quota), 0) AS reversed_reward_quota, "+
				"COUNT(DISTINCT inviter_id) AS unique_inviters, "+
				"COUNT(DISTINCT invitee_id) AS unique_invitees",
			ReferralRewardStatusAwarded,
			ReferralRewardStatusWithheld,
			ReferralRewardStatusReversed,
			[]string{ReferralRewardStatusAwarded, ReferralRewardStatusReversed},
			ReferralRewardStatusAwarded,
		).
		Scan(&summary).Error; err != nil {
		tx.Rollback()
		return nil, 0, AdminReferralRewardSummary{}, err
	}

	query := tx.Table("referral_reward_claims AS rewards").
		Joins("LEFT JOIN users AS inviters ON inviters.id = rewards.inviter_id").
		Joins("LEFT JOIN users AS invitees ON invitees.id = rewards.invitee_id")
	query = applyAdminReferralRewardFilter(query, filter)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, AdminReferralRewardSummary{}, err
	}

	rows := make([]adminReferralRewardRow, 0, pageSize)
	if err := query.
		Select(
			"rewards.id, rewards.inviter_id, rewards.invitee_id, rewards.payment_provider, rewards.paid_amount, rewards.paid_currency, " +
				"rewards.rate_basis_points, rewards.reward_quota, rewards.reversed_quota, rewards.status, rewards.reversal_reason, " +
				"rewards.reversed_at, rewards.created_at, inviters.username AS inviter_username, inviters.email AS inviter_email, " +
				"invitees.username AS invitee_username, invitees.email AS invitee_email",
		).
		Order("rewards.id DESC").
		Limit(pageSize).
		Offset(startIdx).
		Scan(&rows).Error; err != nil {
		tx.Rollback()
		return nil, 0, AdminReferralRewardSummary{}, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, 0, AdminReferralRewardSummary{}, err
	}

	items := make([]AdminReferralRewardItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, AdminReferralRewardItem{
			Id:              row.Id,
			InviterId:       row.InviterId,
			InviterLabel:    maskedReferralInviteeLabel(referralRewardInviteeIdentity{Username: row.InviterUsername, Email: row.InviterEmail}),
			InviteeId:       row.InviteeId,
			InviteeLabel:    maskedReferralInviteeLabel(referralRewardInviteeIdentity{Username: row.InviteeUsername, Email: row.InviteeEmail}),
			PaymentProvider: row.PaymentProvider,
			PaidAmount:      row.PaidAmount,
			PaidCurrency:    row.PaidCurrency,
			RateBasisPoints: row.RateBasisPoints,
			RewardQuota:     row.RewardQuota,
			ReversedQuota:   row.ReversedQuota,
			Status:          row.Status,
			ReversalReason:  row.ReversalReason,
			ReversedAt:      row.ReversedAt,
			CreatedAt:       row.CreatedAt,
		})
	}

	return items, total, summary, nil
}
