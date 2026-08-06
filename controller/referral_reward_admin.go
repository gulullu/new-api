package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// AdminGetReferralRewards returns site-wide referral accounting and a
// privacy-aware, filterable ledger. The route is protected by AdminAuth.
func AdminGetReferralRewards(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	if pageInfo.Page < 1 {
		pageInfo.Page = 1
	}
	if pageInfo.PageSize < 1 {
		pageInfo.PageSize = common.ItemsPerPage
	}
	items, total, summary, err := model.GetAdminReferralRewardDashboard(
		model.AdminReferralRewardFilter{
			Keyword:  c.Query("keyword"),
			Status:   c.Query("status"),
			Provider: c.Query("provider"),
		},
		pageInfo,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      pageInfo.Page,
		"page_size": pageInfo.PageSize,
		"summary":   summary,
	})
}
