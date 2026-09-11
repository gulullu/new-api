package controller

import (
	"crypto/sha256"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

type tokenImportItem struct {
	Name           string `json:"name"`
	Group          string `json:"group"`
	RemainQuota    int    `json:"remain_quota"`
	UnlimitedQuota bool   `json:"unlimited_quota"`
	ExpiredTime    int64  `json:"expired_time"`
	ModelLimits    string `json:"model_limits"`
	AllowIps       string `json:"allow_ips"`
}

type tokenImportRequest struct {
	RequestId          string            `json:"request_id"`
	Items              []tokenImportItem `json:"items"`
	AllowExistingNames bool              `json:"allow_existing_names"`
}

func validateTokenImport(c *gin.Context, items []tokenImportItem) ([]model.Token, error) {
	if len(items) == 0 || len(items) > 100 {
		return nil, fmt.Errorf("Import between 1 and 100 API keys")
	}
	userGroup, err := getTokenRequestUserGroup(c)
	if err != nil {
		return nil, err
	}
	result := make([]model.Token, 0, len(items))
	seen := map[string]bool{}
	for i, item := range items {
		item.Name = strings.TrimSpace(item.Name)
		if len(item.Name) == 0 || len(item.Name) > 50 {
			return nil, fmt.Errorf("Row %d: name must contain 1 to 50 bytes", i+1)
		}
		if seen[item.Name] {
			return nil, fmt.Errorf("Row %d: duplicate name", i+1)
		}
		seen[item.Name] = true
		if !service.CanUserUseGroup(c.GetInt("id"), userGroup, item.Group) {
			return nil, fmt.Errorf("Row %d: group is not available", i+1)
		}
		if item.RemainQuota < 0 || item.RemainQuota > maxTokenQuota() {
			return nil, fmt.Errorf("Row %d: quota is out of range", i+1)
		}
		if item.ExpiredTime != -1 && (item.ExpiredTime <= time.Now().Unix() || item.ExpiredTime > 253402300799) {
			return nil, fmt.Errorf("Row %d: expiration must be in the future", i+1)
		}
		if len(item.ModelLimits) > 10000 || len(item.AllowIps) > 4000 {
			return nil, fmt.Errorf("Row %d: model or IP list is too long", i+1)
		}
		for _, ip := range strings.FieldsFunc(item.AllowIps, func(r rune) bool { return r == '\n' || r == ',' || r == '\r' }) {
			ip = strings.TrimSpace(ip)
			if ip == "" {
				continue
			}
			if net.ParseIP(ip) == nil {
				if _, _, err := net.ParseCIDR(ip); err != nil {
					return nil, fmt.Errorf("Row %d: invalid IP address or CIDR", i+1)
				}
			}
		}
		ips := strings.ReplaceAll(item.AllowIps, ",", "\n")
		quota := item.RemainQuota
		if item.UnlimitedQuota {
			quota = 0
		}
		result = append(result, model.Token{Name: item.Name, UserId: c.GetInt("id"), Group: item.Group, RemainQuota: quota, UnlimitedQuota: item.UnlimitedQuota, ExpiredTime: item.ExpiredTime, ModelLimits: item.ModelLimits, ModelLimitsEnabled: strings.TrimSpace(item.ModelLimits) != "", AllowIps: &ips, CrossGroupRetry: item.Group == "auto"})
	}
	return result, nil
}

func PreviewTokenImport(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<20)
	var request tokenImportRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, fmt.Errorf("Invalid import data"))
		return
	}
	tokens, err := validateTokenImport(c, request.Items)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	names := make([]string, len(tokens))
	for i := range tokens {
		names[i] = tokens[i].Name
	}
	existing, err := model.FindExistingTokenNames(c.GetInt("id"), names)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	count, err := model.CountUserTokens(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"existing_names": existing, "remaining": int64(operation_setting.GetMaxUserTokens()) - count})
}

func ImportTokens(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	var request tokenImportRequest
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<20)
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, fmt.Errorf("Invalid import data"))
		return
	}
	if len(request.RequestId) < 16 || len(request.RequestId) > 64 {
		common.ApiError(c, fmt.Errorf("Invalid import request ID"))
		return
	}
	tokens, err := validateTokenImport(c, request.Items)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	encoded, err := common.Marshal(struct {
		Items              []tokenImportItem
		AllowExistingNames bool
	}{request.Items, request.AllowExistingNames})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	hash := fmt.Sprintf("%x", sha256.Sum256(encoded))
	result, err := model.ImportUserTokens(c.GetInt("id"), request.RequestId, hash, tokens, request.AllowExistingNames)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response := make([]gin.H, 0, len(result))
	for _, token := range result {
		response = append(response, gin.H{"id": token.Id, "name": token.Name, "group": token.Group, "key": "sk-" + token.GetFullKey(), "remain_quota": token.RemainQuota, "unlimited_quota": token.UnlimitedQuota, "expired_time": token.ExpiredTime, "model_limits": token.ModelLimits, "allow_ips": token.AllowIps})
	}
	common.ApiSuccess(c, response)
}

type tokenTemplateDefaults struct {
	Group          string `json:"group"`
	RemainQuota    int    `json:"remain_quota"`
	UnlimitedQuota bool   `json:"unlimited_quota"`
	Expiry         string `json:"expiry"`
	ModelLimits    string `json:"model_limits"`
	AllowIps       string `json:"allow_ips"`
}

type tokenTemplateResponse struct {
	Id       int                   `json:"id"`
	Name     string                `json:"name"`
	Defaults tokenTemplateDefaults `json:"defaults"`
}

func GetTokenImportTemplates(c *gin.Context) {
	templates, err := model.ListTokenImportTemplates(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result := make([]tokenTemplateResponse, 0, len(templates))
	for _, template := range templates {
		var defaults tokenTemplateDefaults
		if err := common.UnmarshalJsonStr(template.Defaults, &defaults); err != nil {
			common.ApiError(c, err)
			return
		}
		result = append(result, tokenTemplateResponse{template.Id, template.Name, defaults})
	}
	common.ApiSuccess(c, result)
}

func SaveTokenImportTemplate(c *gin.Context) {
	var request struct {
		Name     string                `json:"name"`
		Defaults tokenTemplateDefaults `json:"defaults"`
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 32000)
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, fmt.Errorf("Invalid template"))
		return
	}
	request.Name = strings.TrimSpace(request.Name)
	if request.Name == "" || len(request.Name) > 100 {
		common.ApiError(c, fmt.Errorf("Template name must contain 1 to 100 bytes"))
		return
	}
	d := request.Defaults
	expiry := int64(-1)
	if d.Expiry != "never" {
		if days, err := strconv.Atoi(d.Expiry); err == nil && (days == 7 || days == 30) {
			expiry = time.Now().Add(time.Duration(days) * 24 * time.Hour).Unix()
		} else if parsed, err := time.Parse("2006-01-02", d.Expiry); err == nil {
			expiry = parsed.Add(24*time.Hour - time.Second).Unix()
		} else {
			common.ApiError(c, fmt.Errorf("Invalid expiration"))
			return
		}
	}
	if _, err := validateTokenImport(c, []tokenImportItem{{Name: "template", Group: d.Group, RemainQuota: d.RemainQuota, UnlimitedQuota: d.UnlimitedQuota, ExpiredTime: expiry, ModelLimits: d.ModelLimits, AllowIps: d.AllowIps}}); err != nil {
		common.ApiError(c, err)
		return
	}
	encoded, err := common.Marshal(d)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	template := model.TokenImportTemplate{UserId: c.GetInt("id"), Name: request.Name, Defaults: string(encoded)}
	if err := model.SaveTokenImportTemplate(&template); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, tokenTemplateResponse{template.Id, template.Name, d})
}

func RemoveTokenImportTemplate(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiError(c, fmt.Errorf("Invalid template ID"))
		return
	}
	if err := model.DeleteTokenImportTemplate(c.GetInt("id"), id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
