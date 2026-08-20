/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package contenti18n

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestContentSourceHashMatchesWorkerUTF16Contract(t *testing.T) {
	t.Parallel()
	assert.Equal(t, "b849f0e2", ContentSourceHash("RelayBases 是什么？"))
	assert.Equal(t, "e3d822cf", ContentSourceHash("自动"))
	assert.Equal(t, "e8552801", ContentSourceHash("A😀B"))
}

func TestNormalizeLocaleSupportsAllConsoleLanguages(t *testing.T) {
	t.Parallel()
	tests := map[string]Locale{
		"en-US": LocaleEnglish, "zhCN": LocaleSimplifiedChinese,
		"zh-Hant": LocaleTraditionalChinese, "fr-FR": LocaleFrench,
		"ja-JP": LocaleJapanese, "ru": LocaleRussian, "vi-VN": LocaleVietnamese,
	}
	for input, expected := range tests {
		locale, ok := NormalizeLocale(input)
		require.True(t, ok, input)
		assert.Equal(t, expected, locale, input)
	}
}

func TestResolveLocaleUsesExplicitRequestThenRawUserPreference(t *testing.T) {
	t.Parallel()
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest("GET", "/api/status?locale=ja", nil)
	context.Request.Header.Set("Accept-Language", "fr-FR, en;q=0.5")
	context.Set(string(constant.ContextKeyUserSetting), dto.UserSetting{Language: "vi"})
	assert.Equal(t, LocaleJapanese, ResolveLocale(context))

	userContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	userContext.Request = httptest.NewRequest("GET", "/api/status", nil)
	userContext.Set(string(constant.ContextKeyUserSetting), dto.UserSetting{Language: "vi"})
	assert.Equal(t, LocaleVietnamese, ResolveLocale(userContext))
}

func TestCatalogHasEverySupportedLocale(t *testing.T) {
	t.Parallel()
	leaves := make([]localizedLeaf, 0)
	for _, value := range announcementCatalog {
		leaves = append(leaves, value)
	}
	for _, value := range faqCatalog {
		leaves = append(leaves, value.question, value.answer)
	}
	for _, value := range apiInfoCatalog {
		leaves = append(leaves, value.route, value.description)
	}
	for _, value := range userGroupCatalog {
		leaves = append(leaves, value.description)
		if value.ratio != nil {
			leaves = append(leaves, *value.ratio)
		}
	}
	for index, value := range leaves {
		require.NotEmpty(t, value.sourceHash, "leaf %d", index)
		for _, locale := range SupportedLocales() {
			require.NotEmpty(t, value.values[locale], "leaf %d locale %s", index, locale)
		}
	}
	for _, locale := range SupportedLocales() {
		require.NotEmpty(t, noticeReplacements[locale], "notice locale %s", locale)
	}
}

func TestLocalizersRequireStableIDAndMatchingSourceHash(t *testing.T) {
	t.Parallel()
	items := []map[string]any{{
		"id":       1,
		"question": "RelayBases 是什么？",
		"answer":   "administrator edited this answer",
	}}
	localized := LocalizeFAQ(items, LocaleFrench)
	assert.Equal(t, "Qu’est-ce que RelayBases ?", localized[0]["question"])
	assert.Equal(t, "administrator edited this answer", localized[0]["answer"])
	assert.Equal(t, "RelayBases 是什么？", items[0]["question"], "input must not be mutated")
}

func TestLocalizeAnnouncementsArchivesKnownEntriesWithoutMutatingInput(t *testing.T) {
	t.Parallel()
	raw := "## 自动路由功能上线\n\n创建或编辑 API 密钥时，可将分组设为 `auto`。系统按优先级选择支持当前模型的可用分组。建议保留“继承全局 Auto 顺序”；如需在当前分组调用失败后继续尝试下一分组，请开启“跨分组重试”。\n\n按最终实际命中的分组倍率结算。现有密钥不会自动切换。\n\n[查看使用说明](https://site.relaybases.com/usage-doc.html?lang=zh#zh-auto-routing)"
	require.Equal(t, "fee8206f", ContentSourceHash(raw))
	archived := "### 【限时降费通知】\n\n现有模型开启限时折扣：\n\n* **`claude-lite`** 倍率限时下调至 **0.5x**。\n* 支持直接调用 **opus-4.7**。"
	require.Equal(t, archivedAnnouncementSourceHashes["5"], ContentSourceHash(archived))
	items := []map[string]any{
		{"id": 22, "content": raw},
		{"id": 5, "content": archived},
	}
	localized := LocalizeAnnouncements(items, LocaleJapanese)
	require.Len(t, localized, 1)
	assert.True(t, strings.HasPrefix(localized[0]["content"].(string), "## 自動ルーティング"))
	assert.Equal(t, raw, items[0]["content"])
}

func TestGemini37AnnouncementSourceHash(t *testing.T) {
	t.Parallel()
	require.Equal(t, "6de05c05", ContentSourceHash(announcement23Source))
	require.Equal(t, announcementCatalog["23"].sourceHash, ContentSourceHash(announcement23Source))
}

func TestLocalizeAnnouncementsKeepsAdministratorEditsAndUnknownContent(t *testing.T) {
	t.Parallel()
	items := []map[string]any{
		{"id": 5, "content": "administrator edited this archived row"},
		{"id": 6},
		{"id": 11, "content": 42},
		{"id": 21, "content": "no verified archive source"},
	}
	localized := LocalizeAnnouncements(items, LocaleFrench)
	require.Len(t, localized, len(items))
	assert.Equal(t, items, localized)
}

func TestLocalizeUserGroupsUsesHashGuardAndEnglishFallbackEntry(t *testing.T) {
	t.Parallel()
	groups := map[string]map[string]any{
		"auto":    {"desc": "按优先级自动选择可用分组", "ratio": "自动"},
		"unknown": {"desc": "用户分组", "ratio": 1.0},
		"edited":  {"desc": "custom administrator text", "ratio": 1.0},
	}
	localized := LocalizeUserGroups(groups, LocaleVietnamese)
	assert.Equal(t, "Tự động", localized["auto"]["ratio"])
	assert.Equal(t, "Nhóm người dùng", localized["unknown"]["desc"])
	assert.Equal(t, "custom administrator text", localized["edited"]["desc"])
}

func TestLocalizeClaudeMaxGroupsUsesCurrentAdministratorDescriptions(t *testing.T) {
	t.Parallel()
	const claudeMax = "Claude 纯 Max 路线，适合高频生产环境使用，禁止蒸馏。"
	const claudeMaxUltra = "Claude 纯 Max 路线，适合高频生产环境使用，可蒸馏。"
	require.Equal(t, "7fe34730", ContentSourceHash(claudeMax))
	require.Equal(t, "3ef7ac4e", ContentSourceHash(claudeMaxUltra))

	groups := map[string]map[string]any{
		"claude-max":       {"desc": claudeMax, "ratio": 1.8},
		"claude-max-ultra": {"desc": claudeMaxUltra, "ratio": 2.1},
	}
	localized := LocalizeUserGroups(groups, LocaleEnglish)
	assert.Equal(t, "Pure Claude Max route for high-frequency production use; distillation is prohibited.", localized["claude-max"]["desc"])
	assert.Equal(t, "Pure Claude Max route for high-frequency production use; distillation is permitted.", localized["claude-max-ultra"]["desc"])
	assert.Equal(t, claudeMax, groups["claude-max"]["desc"], "input must not be mutated")
	assert.Equal(t, claudeMaxUltra, groups["claude-max-ultra"]["desc"], "input must not be mutated")
}

func TestLocalizeNoticeLeavesUnknownSourceUntouched(t *testing.T) {
	t.Parallel()
	const edited = "administrator changed this notice"
	assert.Equal(t, edited, LocalizeNotice(edited, LocaleFrench))
}

func TestLocalizeNoticeUsesLocaleOnlyWhenSourceHashMatches(t *testing.T) {
	t.Parallel()
	const source = "新功能上线 · 打开无限画布"
	replacements := map[Locale][]replacementPair{
		LocaleEnglish: {
			{"新功能上线", "Now Available"},
			{"打开无限画布", "Open Infinite Canvas"},
		},
		LocaleFrench: {
			{"新功能上线", "Nouveau"},
			{"打开无限画布", "Ouvrir Infinite Canvas"},
		},
	}
	assert.Equal(
		t,
		"Nouveau · Ouvrir Infinite Canvas",
		localizeNotice(source, LocaleFrench, ContentSourceHash(source), "", replacements),
	)
	assert.Equal(
		t,
		source,
		localizeNotice(source, LocaleFrench, "00000000", "", replacements),
	)
}

func TestLocalizeNoticeOnlyStripsTheExactLegacySource(t *testing.T) {
	t.Parallel()
	const source = "新功能上线 · 打开无限画布"
	const legacyBlock = `<div style="display:grid;gap:7px;margin-top:11px"><div>三步开始</div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr))"></div></div>`
	legacy := source + legacyBlock
	replacements := map[Locale][]replacementPair{
		LocaleEnglish: {{"新功能上线", "Now Available"}},
	}

	assert.Equal(
		t,
		"Now Available · 打开无限画布",
		localizeNotice(
			legacy,
			LocaleEnglish,
			ContentSourceHash(source),
			ContentSourceHash(legacy),
			replacements,
		),
	)
	for _, edited := range []string{
		source + strings.Replace(legacyBlock, "三步开始", "管理员的新步骤", 1),
		"管理员前缀" + legacy,
		legacy + legacyBlock,
		legacy[:len(legacy)-6],
	} {
		assert.Equal(
			t,
			edited,
			localizeNotice(
				edited,
				LocaleEnglish,
				ContentSourceHash(source),
				ContentSourceHash(legacy),
				replacements,
			),
		)
	}
}
