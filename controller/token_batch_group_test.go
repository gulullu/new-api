package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateTokenGroupBatch(t *testing.T) {
	for _, tc := range []struct {
		name    string
		group   string
		ids     string
		success bool
	}{
		{"owned tokens", "vip", "owned", true},
		{"duplicate ids counted once", "vip", "duplicate", true},
		{"auto uses global order", "auto", "owned", true},
		{"foreign token rejects entire batch", "vip", "foreign", false},
		{"missing token rejects entire batch", "vip", "missing", false},
		{"deleted token rejects entire batch", "vip", "deleted", false},
		{"unavailable group", "unknown", "owned", false},
		{"private group", "parnter", "owned", false},
		{"empty group", "", "owned", false},
		{"empty selection", "vip", "empty", false},
		{"invalid id", "vip", "negative", false},
		{"over batch limit", "vip", "oversized", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			user := setupTokenAutoGroupsControllerTest(t)
			configureTokenAutoGroupsTest(t, "3", `["default","vip"]`)
			require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","auto":"Auto"}`))
			first := seedToken(t, model.DB, user.Id, "first", "batch-first")
			first.Group = "auto"
			first.AutoGroups = `["vip"]`
			first.CrossGroupRetry = true
			first.RemainQuota = 321
			first.UsedQuota = 123
			first.Status = common.TokenStatusDisabled
			first.ModelLimits = "test-model"
			require.NoError(t, model.DB.Save(first).Error)
			second := seedToken(t, model.DB, user.Id, "second", "batch-second")
			foreign := seedToken(t, model.DB, user.Id+1, "foreign", "batch-foreign")
			deleted := seedToken(t, model.DB, user.Id, "deleted", "batch-deleted")
			require.NoError(t, model.DB.Delete(deleted).Error)
			ids := []int{first.Id, second.Id}
			switch tc.ids {
			case "duplicate":
				ids = []int{first.Id, first.Id, second.Id}
			case "foreign":
				ids = []int{first.Id, foreign.Id}
			case "missing":
				ids = []int{first.Id, 99999}
			case "deleted":
				ids = []int{first.Id, deleted.Id}
			case "empty":
				ids = nil
			case "negative":
				ids = []int{first.Id, -1}
			case "oversized":
				ids = make([]int, 101)
			}
			ctx, response := newAuthenticatedContext(t, http.MethodPut, "/api/token/batch/group", map[string]any{"ids": ids, "group": tc.group}, user.Id)
			ctx.Set(string(constant.ContextKeyUserGroup), user.Group)
			UpdateTokenGroupBatch(ctx)
			var result struct {
				Success bool `json:"success"`
				Data    int  `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, tc.success, result.Success)
			var updated model.Token
			require.NoError(t, model.DB.First(&updated, first.Id).Error)
			if tc.success {
				assert.Equal(t, 2, result.Data)
				expected := *first
				expected.Group = tc.group
				expected.AutoGroups = ""
				expected.CrossGroupRetry = tc.group == "auto"
				assert.Equal(t, expected, updated, "only group routing fields may change")
				updated = model.Token{}
				require.NoError(t, model.DB.First(&updated, second.Id).Error)
				assert.Equal(t, tc.group, updated.Group)
			} else {
				assert.Equal(t, *first, updated, "a rejected batch must leave all tokens unchanged")
			}
			var unchanged model.Token
			require.NoError(t, model.DB.First(&unchanged, foreign.Id).Error)
			assert.Equal(t, *foreign, unchanged)
		})
	}
}
