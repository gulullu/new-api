package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPrivatePartnerGroupVisibilityAndDescription(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"codex-pro":2.75}`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"默认分组","codex-pro":"GPT Pro 号池，适合高频生产环境使用，整体稳定性更高。"}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
	})

	userGroups := GetUserUsableGroupsForUser(PrivatePartnerUserID, "default")
	assert.Equal(t, "GPT Pro 号池，适合高频生产环境使用，整体稳定性更高。", userGroups[PrivatePartnerGroup])
	assert.True(t, CanUserUseGroup(PrivatePartnerUserID, "default", PrivatePartnerGroup))

	publicGroups := GetUserUsableGroupsForUser(0, "default")
	assert.NotContains(t, publicGroups, PrivatePartnerGroup)
	assert.False(t, CanUserUseGroup(0, "default", PrivatePartnerGroup))
}

func TestPrivatePartnerGroupIsExcludedFromPublicAutoRouting(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalAutoGroups := setting.AutoGroups2JsonString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"codex-pro":2.75}`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"默认分组","parnter":"private"}`))
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["parnter","default"]`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
	})

	assert.Equal(t, []string{"default"}, GetUserAutoGroup("default"))
	assert.Equal(t, []string{"parnter", "default"}, GetUserAutoGroupForUser(PrivatePartnerUserID, "default"))
}
