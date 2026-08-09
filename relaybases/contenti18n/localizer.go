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
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

type Locale string

const (
	LocaleEnglish            Locale = "en"
	LocaleSimplifiedChinese  Locale = "zh-CN"
	LocaleTraditionalChinese Locale = "zh-TW"
	LocaleFrench             Locale = "fr"
	LocaleJapanese           Locale = "ja"
	LocaleRussian            Locale = "ru"
	LocaleVietnamese         Locale = "vi"
)

var supportedLocales = [...]Locale{
	LocaleEnglish,
	LocaleSimplifiedChinese,
	LocaleTraditionalChinese,
	LocaleFrench,
	LocaleJapanese,
	LocaleRussian,
	LocaleVietnamese,
}

type localizedLeaf struct {
	sourceHash string
	values     map[Locale]string
}

type faqTranslation struct {
	question localizedLeaf
	answer   localizedLeaf
}

type apiInfoTranslation struct {
	route       localizedLeaf
	description localizedLeaf
}

type groupTranslation struct {
	description localizedLeaf
	ratio       *localizedLeaf
}

func leaf(sourceHash string, values map[Locale]string) localizedLeaf {
	return localizedLeaf{sourceHash: sourceHash, values: values}
}

func SupportedLocales() []Locale {
	locales := make([]Locale, len(supportedLocales))
	copy(locales, supportedLocales[:])
	return locales
}

func NormalizeLocale(value string) (Locale, bool) {
	normalized := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(value), "_", "-"))
	if separator := strings.IndexByte(normalized, ';'); separator >= 0 {
		normalized = strings.TrimSpace(normalized[:separator])
	}
	switch {
	case normalized == "zh-tw", normalized == "zh-hk", normalized == "zh-mo",
		strings.HasPrefix(normalized, "zh-hant"), normalized == "zhtw":
		return LocaleTraditionalChinese, true
	case normalized == "zh", normalized == "zh-cn", normalized == "zh-sg",
		strings.HasPrefix(normalized, "zh-hans"), normalized == "zhcn":
		return LocaleSimplifiedChinese, true
	case normalized == "en" || strings.HasPrefix(normalized, "en-"):
		return LocaleEnglish, true
	case normalized == "fr" || strings.HasPrefix(normalized, "fr-"):
		return LocaleFrench, true
	case normalized == "ja" || strings.HasPrefix(normalized, "ja-"):
		return LocaleJapanese, true
	case normalized == "ru" || strings.HasPrefix(normalized, "ru-"):
		return LocaleRussian, true
	case normalized == "vi" || strings.HasPrefix(normalized, "vi-"):
		return LocaleVietnamese, true
	default:
		return LocaleEnglish, false
	}
}

func firstSupportedLocale(values ...string) (Locale, bool) {
	for _, value := range values {
		if locale, ok := NormalizeLocale(value); ok {
			return locale, true
		}
	}
	return LocaleEnglish, false
}

func preferredAcceptLanguage(value string) (Locale, bool) {
	type preference struct {
		locale Locale
		q      float64
	}
	preferences := make([]preference, 0)
	for _, part := range strings.Split(value, ",") {
		segments := strings.Split(strings.TrimSpace(part), ";")
		locale, ok := NormalizeLocale(segments[0])
		if !ok {
			continue
		}
		q := 1.0
		for _, parameter := range segments[1:] {
			keyValue := strings.SplitN(strings.TrimSpace(parameter), "=", 2)
			if len(keyValue) != 2 || !strings.EqualFold(keyValue[0], "q") {
				continue
			}
			if parsed, err := strconv.ParseFloat(keyValue[1], 64); err == nil {
				q = parsed
			}
		}
		if q > 0 {
			preferences = append(preferences, preference{locale: locale, q: q})
		}
	}
	sort.SliceStable(preferences, func(i, j int) bool {
		return preferences[i].q > preferences[j].q
	})
	if len(preferences) == 0 {
		return LocaleEnglish, false
	}
	return preferences[0].locale, true
}

// ResolveLocale keeps the content-only locale independent of the core error
// message bundle, which currently supports fewer interface languages.
func ResolveLocale(c *gin.Context) Locale {
	if c == nil {
		return LocaleEnglish
	}
	if locale, ok := firstSupportedLocale(
		c.Query("lang"),
		c.Query("locale"),
		c.GetHeader("X-Language"),
		c.GetHeader("X-Locale"),
	); ok {
		return locale
	}
	if userSetting, ok := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting); ok {
		if locale, supported := NormalizeLocale(userSetting.Language); supported {
			return locale
		}
	}
	if cookie, err := c.Cookie("rb_lang"); err == nil {
		if locale, ok := NormalizeLocale(cookie); ok {
			return locale
		}
	}
	if locale, ok := preferredAcceptLanguage(c.GetHeader("Accept-Language")); ok {
		return locale
	}
	return LocaleEnglish
}

// ContentSourceHash reproduces the Worker's FNV-1a hash over JavaScript
// UTF-16 code units. Matching the exact source prevents stale translations
// from overwriting content that an administrator has edited.
func ContentSourceHash(value string) string {
	hash := uint32(2166136261)
	for _, codeUnit := range utf16.Encode([]rune(value)) {
		hash ^= uint32(codeUnit)
		hash *= 16777619
	}
	return fmt.Sprintf("%08x", hash)
}

func localizeString(value any, translation localizedLeaf, locale Locale) any {
	text, ok := value.(string)
	if !ok || ContentSourceHash(text) != translation.sourceHash {
		return value
	}
	if localized, exists := translation.values[locale]; exists {
		return localized
	}
	if fallback, exists := translation.values[LocaleEnglish]; exists {
		return fallback
	}
	return value
}

func cloneMap(source map[string]any) map[string]any {
	result := make(map[string]any, len(source))
	for key, value := range source {
		result[key] = value
	}
	return result
}

func itemID(item map[string]any) string {
	return fmt.Sprint(item["id"])
}

func LocalizeAnnouncements(items []map[string]any, locale Locale) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		id := itemID(item)
		if sourceHash, archived := archivedAnnouncementSourceHashes[id]; archived {
			if content, ok := item["content"].(string); ok && ContentSourceHash(content) == sourceHash {
				continue
			}
		}
		cloned := cloneMap(item)
		if translation, ok := announcementCatalog[id]; ok {
			if content, exists := cloned["content"]; exists {
				cloned["content"] = localizeString(content, translation, locale)
			}
		}
		result = append(result, cloned)
	}
	return result
}

func LocalizeFAQ(items []map[string]any, locale Locale) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		cloned := cloneMap(item)
		if translation, ok := faqCatalog[itemID(item)]; ok {
			cloned["question"] = localizeString(cloned["question"], translation.question, locale)
			cloned["answer"] = localizeString(cloned["answer"], translation.answer, locale)
		}
		result = append(result, cloned)
	}
	return result
}

func LocalizeAPIInfo(items []map[string]any, locale Locale) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		cloned := cloneMap(item)
		if translation, ok := apiInfoCatalog[itemID(item)]; ok {
			cloned["route"] = localizeString(cloned["route"], translation.route, locale)
			cloned["description"] = localizeString(cloned["description"], translation.description, locale)
		}
		result = append(result, cloned)
	}
	return result
}

func LocalizeUserGroups(groups map[string]map[string]any, locale Locale) map[string]map[string]any {
	result := make(map[string]map[string]any, len(groups))
	for group, entry := range groups {
		cloned := cloneMap(entry)
		translation, ok := userGroupCatalog[strings.ToLower(strings.TrimSpace(group))]
		if !ok {
			translation = userGroupCatalog["__user_group__"]
		}
		if description, exists := cloned["desc"]; exists {
			cloned["desc"] = localizeString(description, translation.description, locale)
		}
		if description, exists := cloned["description"]; exists {
			cloned["description"] = localizeString(description, translation.description, locale)
		}
		if translation.ratio != nil {
			if ratio, exists := cloned["ratio"]; exists {
				cloned["ratio"] = localizeString(ratio, *translation.ratio, locale)
			}
		}
		result[group] = cloned
	}
	return result
}

func LocalizeNotice(value string, locale Locale) string {
	return localizeNotice(
		value,
		locale,
		noticeSourceHash,
		noticeLegacySourceHash,
		noticeReplacements,
	)
}

func localizeNotice(
	value string,
	locale Locale,
	sourceHash string,
	legacySourceHash string,
	replacementsByLocale map[Locale][]replacementPair,
) string {
	candidate := value
	if ContentSourceHash(candidate) != sourceHash {
		if legacySourceHash == "" || ContentSourceHash(value) != legacySourceHash {
			return value
		}
		candidate = stripAnnouncementThreeStepBlock(value)
	}
	if ContentSourceHash(candidate) != sourceHash {
		return value
	}
	replacements := replacementsByLocale[locale]
	if len(replacements) == 0 {
		replacements = replacementsByLocale[LocaleEnglish]
	}
	result := candidate
	for _, replacement := range replacements {
		result = strings.ReplaceAll(result, replacement[0], replacement[1])
	}
	return result
}

var divTagPattern = regexp.MustCompile(`(?i)</?div\b[^>]*>`)

func removeBalancedDivBlock(value string, start int) string {
	if start < 0 || start >= len(value) {
		return value
	}
	indices := divTagPattern.FindAllStringIndex(value[start:], -1)
	depth := 0
	for index, bounds := range indices {
		absoluteStart := start + bounds[0]
		if index == 0 && absoluteStart != start {
			return value
		}
		tag := value[absoluteStart : start+bounds[1]]
		if strings.HasPrefix(strings.ToLower(tag), "</") {
			depth--
		} else {
			depth++
		}
		if depth == 0 {
			return value[:start] + value[start+bounds[1]:]
		}
	}
	return value
}

func stripAnnouncementThreeStepBlock(value string) string {
	const title = "三步开始"
	const grid = "grid-template-columns:repeat(3,minmax(0,1fr))"
	const blockPrefix = `<div style="display:grid;gap:7px;`
	result := value
	for strings.Contains(result, title) && strings.Contains(result, grid) {
		titleIndex := strings.Index(result, title)
		blockStart := strings.LastIndex(result[:titleIndex], blockPrefix)
		if blockStart < 0 {
			break
		}
		next := removeBalancedDivBlock(result, blockStart)
		if next == result {
			break
		}
		result = next
	}
	return result
}

func SetLocalizedResponseHeaders(c *gin.Context, locale Locale) {
	c.Header("Content-Language", string(locale))
	c.Header("Cache-Control", "private, no-store")
	c.Header("Vary", "Accept-Language, Cookie, X-Language, X-Locale")
	c.Header("X-RelayBases-Content-Language", string(locale))
}
