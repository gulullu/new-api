package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

const (
	PrivatePartnerGroup  = "parnter"
	PrivatePartnerUserID = 3
)

func GetUserUsableGroups(userGroup string) map[string]string {
	groupsCopy := setting.GetUserUsableGroupsCopy()
	if userGroup != "" {
		specialSettings, b := ratio_setting.GetGroupRatioSetting().GroupSpecialUsableGroup.Get(userGroup)
		if b {
			// 处理特殊可用分组
			for specialGroup, desc := range specialSettings {
				if strings.HasPrefix(specialGroup, "-:") {
					// 移除分组
					groupToRemove := strings.TrimPrefix(specialGroup, "-:")
					delete(groupsCopy, groupToRemove)
				} else if strings.HasPrefix(specialGroup, "+:") {
					// 添加分组
					groupToAdd := strings.TrimPrefix(specialGroup, "+:")
					groupsCopy[groupToAdd] = desc
				} else {
					// 直接添加分组
					groupsCopy[specialGroup] = desc
				}
			}
		}
		// 如果userGroup不在UserUsableGroups中，返回UserUsableGroups + userGroup
		if _, ok := groupsCopy[userGroup]; !ok {
			groupsCopy[userGroup] = "用户分组"
		}
	}
	return groupsCopy
}

// CanViewPrivateGroup centralizes the ACL for RelayBases' private partner group.
// It is deliberately independent from the global usable-group setting so that
// an accidental public setting entry cannot expose this group to other users.
func CanViewPrivateGroup(userID int, groupName string) bool {
	if !strings.EqualFold(strings.TrimSpace(groupName), PrivatePartnerGroup) {
		return true
	}
	return userID == PrivatePartnerUserID || model.IsAdmin(userID)
}

// GetUserUsableGroupsForUser returns the groups visible to a specific user.
// parnter inherits codex-pro's description and is only exposed to user 3 and
// administrators.
func GetUserUsableGroupsForUser(userID int, userGroup string) map[string]string {
	groups := GetUserUsableGroups(userGroup)
	if CanViewPrivateGroup(userID, PrivatePartnerGroup) && ratio_setting.ContainsGroupRatio(PrivatePartnerGroup) {
		groups[PrivatePartnerGroup] = setting.GetUsableGroupDescription("codex-pro")
	} else {
		delete(groups, PrivatePartnerGroup)
	}
	return groups
}

func GroupInUserUsableGroups(userGroup, groupName string) bool {
	_, ok := GetUserUsableGroups(userGroup)[groupName]
	return ok
}

func CanUserUseGroup(userID int, userGroup, groupName string) bool {
	if !CanViewPrivateGroup(userID, groupName) {
		return false
	}
	if groupName == "auto" {
		return GroupInUserUsableGroups(userGroup, groupName)
	}
	if strings.EqualFold(strings.TrimSpace(groupName), PrivatePartnerGroup) {
		return ratio_setting.ContainsGroupRatio(groupName)
	}
	return GroupInUserUsableGroups(userGroup, groupName) && ratio_setting.ContainsGroupRatio(groupName)
}

func IsUserSelectableGroupForUser(userID int, userGroup, groupName string) bool {
	if groupName == "" || groupName == "auto" || !CanViewPrivateGroup(userID, groupName) {
		return false
	}
	if strings.EqualFold(strings.TrimSpace(groupName), PrivatePartnerGroup) {
		return ratio_setting.ContainsGroupRatio(groupName)
	}
	return IsUserSelectableGroup(userGroup, groupName)
}

func IsUserSelectableGroup(userGroup, groupName string) bool {
	if groupName == "" || groupName == "auto" {
		return false
	}
	return GroupInUserUsableGroups(userGroup, groupName) && ratio_setting.ContainsGroupRatio(groupName)
}

// GetUserAutoGroup 根据用户分组获取自动分组设置
func GetUserAutoGroup(userGroup string) []string {
	return getUserAutoGroup(0, userGroup)
}

func GetUserAutoGroupForUser(userID int, userGroup string) []string {
	return getUserAutoGroup(userID, userGroup)
}

func getUserAutoGroup(userID int, userGroup string) []string {
	autoGroups := make([]string, 0)
	seen := make(map[string]struct{})
	for _, group := range setting.GetAutoGroups() {
		if !IsUserSelectableGroupForUser(userID, userGroup, group) {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		autoGroups = append(autoGroups, group)
	}
	return autoGroups
}

// FilterUserTokenAutoGroups applies current permissions before the current
// per-token limit. It intentionally does not fall back to the global Auto list.
func FilterUserTokenAutoGroups(userGroup string, groups []string) []string {
	return filterUserTokenAutoGroups(0, userGroup, groups)
}

func FilterUserTokenAutoGroupsForUser(userID int, userGroup string, groups []string) []string {
	return filterUserTokenAutoGroups(userID, userGroup, groups)
}

func filterUserTokenAutoGroups(userID int, userGroup string, groups []string) []string {
	maxCount := setting.GetMaxTokenAutoGroups()
	filtered := make([]string, 0, min(len(groups), maxCount))
	seen := make(map[string]struct{})
	for _, group := range groups {
		if !IsUserSelectableGroupForUser(userID, userGroup, group) {
			continue
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		filtered = append(filtered, group)
		if len(filtered) == maxCount {
			break
		}
	}
	return filtered
}

// GetRequestAutoGroups resolves the ordered Auto groups for the current token.
// The absence of the context value means that the token inherits the complete
// global Auto list; a present (even empty) value is an explicit token snapshot.
func GetRequestAutoGroups(c *gin.Context, userGroup string) []string {
	value, ok := common.GetContextKey(c, constant.ContextKeyTokenAutoGroups)
	if !ok {
		return GetUserAutoGroupForUser(c.GetInt("id"), userGroup)
	}
	groups, ok := value.([]string)
	if !ok {
		return []string{}
	}
	return FilterUserTokenAutoGroupsForUser(c.GetInt("id"), userGroup, groups)
}

// GetGroupsEnabledModels 按 groups 顺序获取各分组启用的模型并去重
func GetGroupsEnabledModels(groups []string) []string {
	seen := make(map[string]struct{})
	models := make([]string, 0)
	for _, group := range groups {
		for _, modelName := range model.GetGroupEnabledModels(group) {
			if _, ok := seen[modelName]; !ok {
				seen[modelName] = struct{}{}
				models = append(models, modelName)
			}
		}
	}
	return models
}

// GetUserGroupRatio 获取用户使用某个分组的倍率
// userGroup 用户分组
// group 需要获取倍率的分组
func GetUserGroupRatio(userGroup, group string) float64 {
	ratio, ok := ratio_setting.GetGroupGroupRatio(userGroup, group)
	if ok {
		return ratio
	}
	return ratio_setting.GetGroupRatio(group)
}
