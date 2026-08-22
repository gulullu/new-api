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
package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetStatusLocalizesConfiguredContentByExplicitLocale(t *testing.T) {
	settings := console_setting.GetConsoleSetting()
	originalSettings := *settings
	originalOptions := common.OptionMap
	t.Cleanup(func() {
		*settings = originalSettings
		common.OptionMap = originalOptions
	})

	settings.ApiInfoEnabled = true
	settings.AnnouncementsEnabled = false
	settings.FAQEnabled = true
	settings.ApiInfo = `[{"id":1,"route":"标准","description":"经 Cloudflare 加速。"}]`
	settings.FAQ = `[{"id":1,"question":"RelayBases 是什么？","answer":"RelayBases 是面向开发者的 <strong>AI 模型统一接入网关</strong>。你只需要一个 API Key，就能在 Codex、VSCode、Cursor、Chatbox 等各种客户端中调用 GPT-5.4、Claude Opus 4.6 等模型——不用分别注册多个平台、管理多套密钥，也不用处理不同协议的兼容问题。网关层会自动完成 <strong>OpenAI ↔ Anthropic 的双向协议转换</strong>。"}]`
	common.OptionMap = map[string]string{}

	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/status?locale=fr", nil)
	GetStatus(context)

	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			APIInfo []map[string]any `json:"api_info"`
			FAQ     []map[string]any `json:"faq"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	require.Len(t, payload.Data.APIInfo, 1)
	require.Len(t, payload.Data.FAQ, 1)
	assert.Equal(t, "Standard", payload.Data.APIInfo[0]["route"])
	assert.Equal(t, "Qu’est-ce que RelayBases ?", payload.Data.FAQ[0]["question"])
	assert.Contains(t, payload.Data.FAQ[0]["answer"], "passerelle unifiée")
	assert.Equal(t, "fr", response.Header().Get("Content-Language"))
	assert.Equal(t, "private, no-store", response.Header().Get("Cache-Control"))
}

func TestGetNoticePreservesAdministratorEditWhenHashDoesNotMatch(t *testing.T) {
	originalOptions := common.OptionMap
	t.Cleanup(func() { common.OptionMap = originalOptions })
	common.OptionMap = map[string]string{"Notice": "administrator edited notice"}

	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/notice?locale=ja", nil)
	GetNotice(context)

	var payload struct {
		Success bool   `json:"success"`
		Data    string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
	assert.True(t, payload.Success)
	assert.Equal(t, "administrator edited notice", payload.Data)
	assert.Equal(t, "ja", response.Header().Get("Content-Language"))
}
