package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const (
	partnerWithdrawalCreateProofScope = "partner.withdrawal.create"
	partnerWithdrawalReviewProofScope = "partner.withdrawal.review"
	partnerWithdrawalRevealProofScope = "partner.withdrawal.reveal"
)

type partnerTransferRequest struct {
	AmountUsdMicros int64  `json:"amount_usd_micros" binding:"required"`
	RequestID       string `json:"request_id" binding:"required"`
}

type partnerWithdrawalRequest struct {
	AmountUsdMicros int64  `json:"amount_usd_micros" binding:"required"`
	Method          string `json:"method" binding:"required"`
	AlipayAccount   string `json:"alipay_account"`
	AlipayName      string `json:"alipay_name"`
	BSCAddress      string `json:"bsc_address"`
}

type partnerConfigureRequest struct {
	UserId                int `json:"user_id" binding:"required"`
	CommissionBasisPoints int `json:"commission_basis_points" binding:"required"`
}

type partnerWithdrawalReviewRequest struct {
	PayoutReference string `json:"payout_reference"`
	AdminNote       string `json:"admin_note"`
}

func GetPartnerWalletSummary(c *gin.Context) {
	summary, err := model.GetPartnerWalletSummary(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func TransferPartnerCommission(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	var req partnerTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	quota, err := model.TransferPartnerCommissionToQuota(c.GetInt("id"), req.AmountUsdMicros, req.RequestID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordUserSecurityAudit(c, c.GetInt("id"), "partner.balance_transfer", map[string]interface{}{
		"amount_usd_micros": req.AmountUsdMicros,
		"request_id":        req.RequestID,
		"quota":             quota,
	})
	common.ApiSuccess(c, gin.H{"quota": quota})
}

func CreatePartnerWithdrawal(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	if !middleware.RequireSecurityProof(c, partnerWithdrawalCreateProofScope, []string{"2fa", "passkey"}) {
		return
	}
	var req partnerWithdrawalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	withdrawal, err := model.CreatePartnerWithdrawal(c.GetInt("id"), req.AmountUsdMicros, req.Method, model.PartnerPayoutDestination{
		AlipayAccount: req.AlipayAccount,
		AlipayName:    req.AlipayName,
		BSCAddress:    req.BSCAddress,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordUserSecurityAudit(c, c.GetInt("id"), "partner.withdrawal_create", map[string]interface{}{
		"withdrawal_id":     withdrawal.Id,
		"amount_usd_micros": withdrawal.AmountUsdMicros,
		"method":            withdrawal.Method,
	})
	common.ApiSuccess(c, withdrawal)
}

func GetPartnerWithdrawals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	if pageInfo.PageSize < 1 {
		pageInfo.PageSize = common.ItemsPerPage
	}
	items, total, err := model.GetPartnerWithdrawals(c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetPartnerCommissions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	if pageInfo.PageSize < 1 {
		pageInfo.PageSize = common.ItemsPerPage
	}
	items, total, err := model.GetPartnerCommissionHistory(c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminConfigurePartner(c *gin.Context) {
	var req partnerConfigureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	profile, err := model.ConfigurePartner(req.UserId, req.CommissionBasisPoints, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAuditFor(c, req.UserId, "partner.configure", map[string]interface{}{
		"commission_basis_points": req.CommissionBasisPoints,
		"commission_rate_percent": float64(req.CommissionBasisPoints) / 100,
	})
	common.ApiSuccess(c, profile)
}

func AdminListPartnerProfiles(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	if pageInfo.PageSize < 1 {
		pageInfo.PageSize = common.ItemsPerPage
	}
	items, total, err := model.ListPartnerProfiles(c.Query("keyword"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      pageInfo.Page,
		"page_size": pageInfo.PageSize,
	})
}

func AdminListPartnerWithdrawals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	if pageInfo.PageSize < 1 {
		pageInfo.PageSize = common.ItemsPerPage
	}
	items, total, err := model.ListPartnerWithdrawals(c.Query("status"), c.Query("keyword"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      pageInfo.Page,
		"page_size": pageInfo.PageSize,
	})
}

func partnerWithdrawalId(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid partner withdrawal id")
		return 0, false
	}
	return id, true
}

func AdminRevealPartnerWithdrawal(c *gin.Context) {
	if !middleware.RequireSecurityProof(c, partnerWithdrawalRevealProofScope, []string{"2fa", "passkey"}) {
		return
	}
	id, ok := partnerWithdrawalId(c)
	if !ok {
		return
	}
	destination, err := model.GetPartnerWithdrawalDestination(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "partner.withdrawal_reveal", map[string]interface{}{"withdrawal_id": id})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": destination})
}

func reviewPartnerWithdrawal(c *gin.Context, approve bool) {
	if !middleware.RequireSecurityProof(c, partnerWithdrawalReviewProofScope, []string{"2fa", "passkey"}) {
		return
	}
	id, ok := partnerWithdrawalId(c)
	if !ok {
		return
	}
	var req partnerWithdrawalReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	withdrawal, err := model.ReviewPartnerWithdrawal(id, c.GetInt("id"), approve, req.PayoutReference, req.AdminNote)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	action := "partner.withdrawal_reject"
	if approve {
		action = "partner.withdrawal_paid"
	}
	recordManageAuditFor(c, withdrawal.UserId, action, map[string]interface{}{
		"withdrawal_id":     withdrawal.Id,
		"amount_usd_micros": withdrawal.AmountUsdMicros,
		"method":            withdrawal.Method,
		"payout_reference":  strings.TrimSpace(req.PayoutReference),
	})
	common.ApiSuccess(c, withdrawal)
}

func AdminMarkPartnerWithdrawalPaid(c *gin.Context) {
	reviewPartnerWithdrawal(c, true)
}

func AdminRejectPartnerWithdrawal(c *gin.Context) {
	reviewPartnerWithdrawal(c, false)
}
