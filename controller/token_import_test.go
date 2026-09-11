package controller

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupImportTest(t *testing.T) *model.User {
	user := setupTokenAutoGroupsControllerTest(t)
	configureTokenAutoGroupsTest(t, "3", `["default","vip"]`)
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","auto":"Auto"}`))
	require.NoError(t, model.DB.AutoMigrate(&model.TokenImportBatch{}, &model.TokenImportTemplate{}))
	return user
}

func importTestItem(name string) tokenImportItem {
	return tokenImportItem{Name: name, Group: "default", RemainQuota: 123, ExpiredTime: -1}
}

func callImport(t *testing.T, userID int, request tokenImportRequest) (bool, string, []map[string]any) {
	t.Helper()
	ctx, recorder := newTokenAutoGroupsAuthenticatedContext(t, http.MethodPost, "/api/token/batch/import", request, userID)
	ImportTokens(ctx)
	assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	response := decodeAPIResponse(t, recorder)
	var result []map[string]any
	if response.Success {
		require.NoError(t, common.Unmarshal(response.Data, &result))
	}
	return response.Success, response.Message, result
}

func TestTokenImportValidationIsAtomic(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*tokenImportItem)
	}{
		{"empty name", func(i *tokenImportItem) { i.Name = " " }},
		{"long utf8 name", func(i *tokenImportItem) { i.Name = "这是超过五十个字节长度限制的密钥名称示例" }},
		{"duplicate name", func(i *tokenImportItem) { i.Name = "first" }},
		{"unavailable group", func(i *tokenImportItem) { i.Group = "unknown" }},
		{"private group", func(i *tokenImportItem) { i.Group = "parnter" }},
		{"negative quota", func(i *tokenImportItem) { i.RemainQuota = -1 }},
		{"quota too large", func(i *tokenImportItem) { i.RemainQuota = maxTokenQuota() + 1 }},
		{"past expiry", func(i *tokenImportItem) { i.ExpiredTime = 1 }},
		{"invalid ip", func(i *tokenImportItem) { i.AllowIps = "127.0.0.1\nnot-an-ip" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			user := setupImportTest(t)
			second := importTestItem("second")
			tc.change(&second)
			ok, _, _ := callImport(t, user.Id, tokenImportRequest{RequestId: "validation-request-1", Items: []tokenImportItem{importTestItem("first"), second}})
			assert.False(t, ok)
			count, err := model.CountUserTokens(user.Id)
			require.NoError(t, err)
			assert.Zero(t, count)
			var receipts int64
			require.NoError(t, model.DB.Model(&model.TokenImportBatch{}).Count(&receipts).Error)
			assert.Zero(t, receipts)
		})
	}
}

func TestTokenImportRetryAndExistingNames(t *testing.T) {
	user := setupImportTest(t)
	second := importTestItem("second")
	second.Group = "auto"
	second.UnlimitedQuota = true
	second.AllowIps = "127.0.0.1,10.0.0.0/8"
	second.ModelLimits = "test-model"
	request := tokenImportRequest{RequestId: "retry-request-0001", Items: []tokenImportItem{importTestItem("first"), second}}
	ok, message, result := callImport(t, user.Id, request)
	require.True(t, ok, message)
	require.Len(t, result, 2)
	var tokens []model.Token
	require.NoError(t, model.DB.Order("id").Find(&tokens).Error)
	assert.Equal(t, user.Id, tokens[0].UserId)
	assert.Equal(t, 123, tokens[0].RemainQuota)
	assert.Equal(t, common.TokenStatusEnabled, tokens[0].Status)
	assert.True(t, tokens[1].CrossGroupRetry)
	assert.Empty(t, tokens[1].AutoGroups)
	assert.Zero(t, tokens[1].RemainQuota)
	assert.True(t, tokens[1].ModelLimitsEnabled)
	assert.Equal(t, "127.0.0.1\n10.0.0.0/8", *tokens[1].AllowIps)
	assert.Equal(t, "sk-"+tokens[0].GetFullKey(), result[0]["key"])
	ok, message, replayed := callImport(t, user.Id, request)
	require.True(t, ok, message)
	assert.Equal(t, result, replayed)
	request.Items[0].Name = "changed"
	ok, _, _ = callImport(t, user.Id, request)
	assert.False(t, ok)
	request.Items[0].Name = "first"
	request.RequestId = "retry-request-0002"
	ok, _, _ = callImport(t, user.Id, request)
	assert.False(t, ok)
	request.AllowExistingNames = true
	ok, message, _ = callImport(t, user.Id, request)
	require.True(t, ok, message)
	count, err := model.CountUserTokens(user.Id)
	require.NoError(t, err)
	assert.EqualValues(t, 4, count)
	// The same request ID is scoped to its owner and never returns another user's keys.
	other := model.User{Id: 202, Username: "other-import-user", AffCode: "other-import", Password: "password", Group: "default"}
	require.NoError(t, model.DB.Create(&other).Error)
	request.RequestId = "retry-request-0001"
	request.AllowExistingNames = false
	ok, message, foreign := callImport(t, other.Id, request)
	require.True(t, ok, message)
	assert.NotEqual(t, result[0]["key"], foreign[0]["key"])
}

func TestTokenImportDatabaseFailureRollsBack(t *testing.T) {
	user := setupImportTest(t)
	var attempted int
	require.NoError(t, model.DB.Callback().Create().Before("gorm:create").Register("import-test-failure", func(tx *gorm.DB) {
		if tx.Statement.Table == "tokens" {
			attempted++
			if attempted == 2 {
				tx.AddError(errors.New("injected second-row failure"))
			}
		}
	}))
	t.Cleanup(func() { model.DB.Callback().Create().Remove("import-test-failure") })
	request := tokenImportRequest{RequestId: "rollback-request-1", Items: []tokenImportItem{importTestItem("first"), importTestItem("second")}}
	ok, _, _ := callImport(t, user.Id, request)
	assert.False(t, ok)
	count, err := model.CountUserTokens(user.Id)
	require.NoError(t, err)
	assert.Zero(t, count)
	var receipts int64
	require.NoError(t, model.DB.Model(&model.TokenImportBatch{}).Count(&receipts).Error)
	assert.Zero(t, receipts)
	require.NoError(t, model.DB.Callback().Create().Remove("import-test-failure"))
	ok, message, _ := callImport(t, user.Id, request)
	require.True(t, ok, message)
}

func TestTokenImportLimitAndPreview(t *testing.T) {
	user := setupImportTest(t)
	old := operation_setting.GetMaxUserTokens()
	operation_setting.GetTokenSetting().MaxUserTokens = 2
	t.Cleanup(func() { operation_setting.GetTokenSetting().MaxUserTokens = old })
	seedToken(t, model.DB, user.Id, "first", "seed-import-limit")
	request := tokenImportRequest{RequestId: "limit-request-0001", Items: []tokenImportItem{importTestItem("first"), importTestItem("second")}, AllowExistingNames: true}
	ctx, rec := newTokenAutoGroupsAuthenticatedContext(t, http.MethodPost, "/api/token/batch/import/preview", request, user.Id)
	PreviewTokenImport(ctx)
	response := decodeAPIResponse(t, rec)
	require.True(t, response.Success, response.Message)
	var preview struct {
		ExistingNames []string `json:"existing_names"`
		Remaining     int      `json:"remaining"`
	}
	require.NoError(t, common.Unmarshal(response.Data, &preview))
	assert.Equal(t, []string{"first"}, preview.ExistingNames)
	assert.Equal(t, 1, preview.Remaining)
	ok, _, _ := callImport(t, user.Id, request)
	assert.False(t, ok)
	request.Items = request.Items[1:]
	ok, message, _ := callImport(t, user.Id, request)
	require.True(t, ok, message)
	single := importTestItem("third")
	singleContext, singleRec := newTokenAutoGroupsAuthenticatedContext(t, http.MethodPost, "/api/token/", single, user.Id)
	AddToken(singleContext)
	assert.False(t, decodeAPIResponse(t, singleRec).Success)
	for _, size := range []int{0, 101} {
		request.RequestId = fmt.Sprintf("size-request-%04d", size)
		request.Items = make([]tokenImportItem, size)
		ok, _, _ = callImport(t, user.Id, request)
		assert.False(t, ok)
	}
	count, err := model.CountUserTokens(user.Id)
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
}

func TestTokenImportTemplatesAreOwnerScoped(t *testing.T) {
	user := setupImportTest(t)
	defaults := tokenTemplateDefaults{Group: "vip", RemainQuota: 500000, Expiry: "30", ModelLimits: "model", AllowIps: "10.0.0.0/8"}
	payload := map[string]any{"name": "Team template", "defaults": defaults, "key": "must-not-be-saved"}
	ctx, rec := newTokenAutoGroupsAuthenticatedContext(t, http.MethodPost, "/api/token/import-templates", payload, user.Id)
	SaveTokenImportTemplate(ctx)
	response := decodeAPIResponse(t, rec)
	require.True(t, response.Success, response.Message)
	var saved tokenTemplateResponse
	require.NoError(t, common.Unmarshal(response.Data, &saved))
	assert.Equal(t, defaults, saved.Defaults)
	ctx, rec = newTokenAutoGroupsAuthenticatedContext(t, http.MethodGet, "/api/token/import-templates", nil, user.Id+1)
	GetTokenImportTemplates(ctx)
	response = decodeAPIResponse(t, rec)
	require.True(t, response.Success)
	assert.JSONEq(t, "[]", string(response.Data))
	ctx, rec = newTokenAutoGroupsAuthenticatedContext(t, http.MethodDelete, "/api/token/import-templates/1", nil, user.Id+1)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprint(saved.Id)}}
	RemoveTokenImportTemplate(ctx)
	assert.False(t, decodeAPIResponse(t, rec).Success)
	var stored model.TokenImportTemplate
	require.NoError(t, model.DB.First(&stored, saved.Id).Error)
	assert.NotContains(t, stored.Defaults, "must-not-be-saved")
	ctx, rec = newTokenAutoGroupsAuthenticatedContext(t, http.MethodPost, "/api/token/import-templates", payload, user.Id)
	SaveTokenImportTemplate(ctx)
	assert.False(t, decodeAPIResponse(t, rec).Success)
	ctx, rec = newTokenAutoGroupsAuthenticatedContext(t, http.MethodDelete, "/api/token/import-templates/1", nil, user.Id)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprint(saved.Id)}}
	RemoveTokenImportTemplate(ctx)
	assert.True(t, decodeAPIResponse(t, rec).Success)
}

func TestTokenImportConcurrentSingleCreateRespectsLimit(t *testing.T) {
	user := setupImportTest(t)
	sqlDB, err := model.DB.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	old := operation_setting.GetMaxUserTokens()
	operation_setting.GetTokenSetting().MaxUserTokens = 2
	t.Cleanup(func() { operation_setting.GetTokenSetting().MaxUserTokens = old })
	results := make(chan error, 2)
	go func() {
		_, err := model.ImportUserTokens(user.Id, "concurrent-import-1", "hash", []model.Token{{Name: "batch-1", ExpiredTime: -1}, {Name: "batch-2", ExpiredTime: -1}}, false)
		results <- err
	}()
	go func() {
		results <- model.InsertUserToken(&model.Token{UserId: user.Id, Name: "single", Key: "concurrent-single-fixture", ExpiredTime: -1})
	}()
	first, second := <-results, <-results
	assert.NotEqual(t, first == nil, second == nil, "only one competing creation may fit the limit")
	count, err := model.CountUserTokens(user.Id)
	require.NoError(t, err)
	assert.LessOrEqual(t, count, int64(2))
	assert.GreaterOrEqual(t, count, int64(1))
}

func TestTokenImportIgnoresOwnershipAndSecretOverrides(t *testing.T) {
	user := setupImportTest(t)
	payload := map[string]any{"request_id": "override-request-1", "items": []map[string]any{{"name": "owned", "group": "default", "expired_time": -1, "user_id": 999, "id": 999, "key": "attacker-chosen", "status": 2, "used_quota": 123, "auto_groups": []string{"private"}}}}
	ctx, rec := newTokenAutoGroupsAuthenticatedContext(t, http.MethodPost, "/api/token/batch/import", payload, user.Id)
	ImportTokens(ctx)
	response := decodeAPIResponse(t, rec)
	require.True(t, response.Success, response.Message)
	var token model.Token
	require.NoError(t, model.DB.First(&token).Error)
	assert.Equal(t, user.Id, token.UserId)
	assert.NotEqual(t, 999, token.Id)
	assert.NotEqual(t, "attacker-chosen", token.GetFullKey())
	assert.Equal(t, common.TokenStatusEnabled, token.Status)
	assert.Zero(t, token.UsedQuota)
	assert.Empty(t, token.AutoGroups)
}
