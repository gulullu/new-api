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

// workerCatalogBaseline preserves the existing English and Chinese output
// byte-for-byte while the additional five translations live beside each
// entry in catalog_announcements.go. It can be removed after the edge catalog
// is retired and this package becomes the sole content source.
var workerCatalogBaseline = map[string]map[Locale]string{
	"12": {
		LocaleEnglish: "# Notice on the Restoration of the codex-plus Channel\n\nThe `codex-plus` channel has been temporarily restored, and its billing multiplier has returned to the normal rate.\n\n**Note:**\nThe channel is currently less stable. Users who prioritize high availability and stability should use the `codex-pro` channel. Choose according to your business requirements. To protect the experience of `codex-pro` users, the platform will no longer use `codex-pro` as a fallback for other groups. Thank you for your understanding.",
	},
	"11": {
		LocaleEnglish: "# Notice on a Temporary Adjustment to the codex-plus Channel\n\nRecent tightening of OpenAI risk controls led to large-scale account bans.\nTo maintain normal service during weekdays, the platform temporarily used a `Pro` account pool. The channel had not yet recovered at the time of this notice, so the `Pro` pool remained in use.\nAccordingly, the `codex-plus` channel multiplier was adjusted to the `codex-pro` multiplier.\nWhether the multiplier could be reduced later depended on the recovery of the `codex-plus` channel. We apologize for the inconvenience.",
	},
	"9": {
		LocaleEnglish:           "## Price Adjustment · claude-max Group Multiplier Reduced\n\n**Due to lower costs, the claude-max group multiplier has been reduced effective immediately. No action is required.**\n\nThis adjustment affects only the billing multiplier. Keys, endpoints, and model names remain unchanged, while existing balances and the pricing of other groups are unaffected.\n\n- **Group**: claude-max\n- **Previous multiplier**: 2.5\n- **New multiplier**: 1.8\n- **Effective time**: Immediately",
		LocaleSimplifiedChinese: "## 价格调整 · claude-max 分组倍率下调\n\n**因成本下降，claude-max 分组倍率即时下调，无需任何操作。**\n\n本次调整仅涉及计费倍率，Key、端点、模型名均保持不变，历史余额与其它分组定价不受影响。\n\n- **分组**：claude-max\n- **原倍率**：2.5\n- **新倍率**：1.8\n- **生效时间**：即时生效",
	},
	"8": {
		LocaleEnglish: "## Model Retirement and Replacement Notice\n\n**Retired models**:\n\n* `gpt-5.2`\n* `gpt-5.3-codex`\n\n**Reason**: OpenAI officially retired these models, so they have also been deprecated on RelayBases.\n\n---\n\n**Replacement**:\nIf you require `gpt-5.3-codex`, reroute requests to:\n\n* **Target model**: `gpt-5.3-codex-spark`\n* **Group**: `codex-pro`\n\nUpdate the `model` parameter in your API requests and switch to the corresponding group configuration promptly to avoid service disruption.",
	},
	"7": {
		LocaleEnglish: "## New Model · claude-opus-4-8\n**Claude Opus 4.8 is now available through RelayBases, while Claude Opus 4.7 remains available.**\n- **Model**: Claude Opus 4.8 (model ID: `claude-opus-4-8`)\n- **Pricing**: Account usage charges are displayed in Ɍ (API Credits); the upstream official USD base price is the same as 4.7. Final deductions are subject to the bill in the console.\n- **How to access**: Keep your existing Key and base URL, and change the model name to `claude-opus-4-8`",
	},
	"6": {
		LocaleEnglish: "### Notice · Billing Multiplier Restored\n\n* **Rate restoration**: The limited-time **0.5x** multiplier promotion for `claude-lite` ended, and the default standard billing multiplier was restored.\n* **Service status**: `opus-4.7` remained available at the standard multiplier.",
	},
	"5": {
		LocaleEnglish: "### Limited-Time Price Reduction Notice\n\nA limited-time discount was made available for existing models:\n\n* The **`claude-lite`** multiplier was temporarily reduced to **0.5x**.\n* Direct calls to **opus-4.7** were supported.",
	},
	"1": {
		LocaleEnglish:           "\n<h3>🔐 Security Information</h3>\n<ul>\n  <li>API requests are encrypted with <strong>TLS</strong> in transit.</li>\n  <li>The gateway processes content only as needed to complete model requests and does not use API inputs or outputs for model training. See the Privacy Policy for data-handling and retention terms.</li>\n  <li>Keep your API Key secure and do not commit it to a public repository.</li>\n</ul>",
		LocaleSimplifiedChinese: "\n<h3>🔐 安全说明</h3>\n<ul>\n  <li>API 请求在传输过程中使用 <strong>TLS</strong> 加密。</li>\n  <li>网关仅为完成模型调用而处理中转内容，不将 API 输入或输出用于模型训练；数据处理与保留以隐私政策为准。</li>\n  <li>请妥善保管 API Key，勿写入公开仓库。</li>\n</ul>",
	},
}

func init() {
	for id, translationsByLocale := range workerCatalogBaseline {
		entry, ok := announcementCatalog[id]
		if !ok {
			continue
		}
		for locale, value := range translationsByLocale {
			entry.values[locale] = value
		}
		announcementCatalog[id] = entry
	}
}
