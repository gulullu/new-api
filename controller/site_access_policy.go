package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type siteAccessPolicyResponse struct {
	Enabled    bool `json:"enabled"`
	Configured bool `json:"configured"`
	Degraded   bool `json:"degraded"`
}

func mainlandSiteBlockEnabled() bool {
	common.OptionMapRWMutex.RLock()
	raw, ok := common.OptionMap[common.MainlandSiteBlockOptionKey]
	common.OptionMapRWMutex.RUnlock()
	if !ok {
		return true
	}
	enabled, err := strconv.ParseBool(strings.TrimSpace(raw))
	if err != nil {
		return true
	}
	return enabled
}

// GetSiteAccessPolicy is intentionally a small read-only endpoint. The edge
// Worker uses it to evaluate the website boundary; it exposes no credentials
// or administrator identity.
func GetSiteAccessPolicy(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": siteAccessPolicyResponse{
			Enabled:    mainlandSiteBlockEnabled(),
			Configured: true,
			Degraded:   false,
		},
	})
}

// UpdateSiteAccessPolicy is root-only and is called by the authenticated
// control-panel Worker route. API traffic and payment callbacks do not use
// this setting.
func UpdateSiteAccessPolicy(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	if c.GetBool("use_access_token") {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "This operation requires dashboard session authentication.",
		})
		return
	}

	var request struct {
		Enabled *bool `json:"enabled"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || request.Enabled == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "The enabled field must be a boolean.",
		})
		return
	}

	if err := model.UpdateOption(
		common.MainlandSiteBlockOptionKey,
		strconv.FormatBool(*request.Enabled),
	); err != nil {
		common.ApiError(c, err)
		return
	}

	recordManageAudit(c, "site.access_policy_update", map[string]interface{}{
		"enabled": *request.Enabled,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": siteAccessPolicyResponse{
			Enabled:    *request.Enabled,
			Configured: true,
			Degraded:   false,
		},
	})
}
