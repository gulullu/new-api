package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type AdminReverseReferralRewardRequest struct {
	Reason string `json:"reason"`
}

// GetReferralRewards returns only referral rewards owned by the authenticated
// user. The model projection deliberately excludes all invitee and payment
// identifiers that are not needed by the inviter.
func GetReferralRewards(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	if pageInfo.PageSize < 1 {
		pageInfo.PageSize = common.ItemsPerPage
	}
	items, total, err := model.GetReferralRewardHistory(c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// AdminReverseReferralReward is the audited fallback for gateways that do not
// deliver a machine-readable refund or dispute event (for example, Epay).
func AdminReverseReferralReward(c *gin.Context) {
	claimId, err := strconv.Atoi(c.Param("id"))
	if err != nil || claimId <= 0 {
		common.ApiErrorMsg(c, "invalid referral reward claim id")
		return
	}

	var req AdminReverseReferralRewardRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Reason) == "" {
		common.ApiErrorMsg(c, "reversal reason is required")
		return
	}

	outcome, err := model.ReverseReferralRewardById(
		claimId,
		"admin-"+strconv.Itoa(c.GetInt("id"))+"-"+strconv.FormatInt(common.GetTimestamp(), 10),
		req.Reason,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if outcome.ClaimId == 0 {
		common.ApiErrorMsg(c, "referral reward claim not found")
		return
	}

	recordManageAuditFor(c, outcome.InviterId, "referral_reward.reverse", map[string]interface{}{
		"claim_id":          outcome.ClaimId,
		"reason":            strings.TrimSpace(req.Reason),
		"changed":           outcome.Changed,
		"reward_quota":      outcome.RewardQuota,
		"unrecovered_quota": outcome.UnrecoveredQuota,
	})
	common.ApiSuccess(c, gin.H{
		"claim_id": outcome.ClaimId,
		"status":   model.ReferralRewardStatusReversed,
		"changed":  outcome.Changed,
	})
}
