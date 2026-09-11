package controller

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"
)

func workbookTestLabels() tokenWorkbookLabels {
	return tokenWorkbookLabels{Title: "API 密钥导入模板", Headers: []string{"名称", "分组", "额度 (USD)", "有效期", "模型限制", "IP 白名单"}}
}

func TestTokenWorkbookDropdownAndRoundTrip(t *testing.T) {
	groups := map[string]string{}
	for i := 0; i < 40; i++ {
		groups[fmt.Sprintf("group-%02d-long-name", i)] = "分组说明"
	}
	data, err := buildTokenImportWorkbook(workbookTestLabels(), groups)
	require.NoError(t, err)
	f, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer f.Close()
	validations, err := f.GetDataValidations("API Keys")
	require.NoError(t, err)
	require.Len(t, validations, 2)
	require.Equal(t, "B6:B105", validations[0].Sqref)
	require.Equal(t, "AvailableGroups", validations[0].Formula1)
	require.True(t, validations[0].ShowErrorMessage)
	require.False(t, validations[0].ShowInputMessage)
	visible, err := f.GetSheetVisible("Groups")
	require.NoError(t, err)
	require.False(t, visible)
	instructions, err := f.GetCellValue("API Keys", "A2")
	require.NoError(t, err)
	require.Empty(t, instructions)
	description, err := f.GetCellValue("Groups", "B2")
	require.NoError(t, err)
	require.Empty(t, description)
	require.Contains(t, f.GetDefinedName()[0].RefersTo, "$A$41")
	require.NoError(t, f.SetCellStr("API Keys", "A6", "001 张三,研发"))
	require.NoError(t, f.SetCellStr("API Keys", "B6", "group-03-long-name"))
	require.NoError(t, f.SetCellStr("API Keys", "D6", "2030-12-31"))
	require.NoError(t, f.SetCellStr("API Keys", "A7", "=literal-name"))
	buf, err := f.WriteToBuffer()
	require.NoError(t, err)
	result, err := parseTokenImportWorkbook(buf)
	require.NoError(t, err)
	records, err := csv.NewReader(strings.NewReader(result)).ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 3)
	require.Equal(t, "001 张三,研发", records[1][0])
	require.Equal(t, "2030-12-31", records[1][3])
	require.Equal(t, "=literal-name", records[2][0])
	require.NoError(t, f.SetCellFormula("API Keys", "B6", "1+1"))
	buf, err = f.WriteToBuffer()
	require.NoError(t, err)
	_, err = parseTokenImportWorkbook(buf)
	require.ErrorContains(t, err, "formulas")
}

func TestTokenWorkbookUserGroups(t *testing.T) {
	user := setupImportTest(t)
	require.NoError(t, model.DB.Model(user).Update("role", common.RoleRootUser).Error)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1,"codex-pro":1,"parnter":1}`))
	ctx, recorder := newTokenAutoGroupsAuthenticatedContext(t, http.MethodPost, "/api/token/import-template.xlsx", workbookTestLabels(), user.Id)
	DownloadTokenImportWorkbook(ctx)
	require.Contains(t, recorder.Header().Get("Content-Type"), "spreadsheetml")
	f, err := excelize.OpenReader(bytes.NewReader(recorder.Body.Bytes()))
	require.NoError(t, err)
	defer f.Close()
	rows, err := f.GetRows("Groups")
	require.NoError(t, err)
	names := []string{}
	for _, row := range rows[1:] {
		names = append(names, row[0])
	}
	require.Contains(t, names, "default")
	require.NotContains(t, names, "parnter")
}

func TestTokenWorkbookRejectsInvalidAndTooManyRows(t *testing.T) {
	_, err := parseTokenImportWorkbook(strings.NewReader("not a workbook"))
	require.Error(t, err)
	data, err := buildTokenImportWorkbook(workbookTestLabels(), map[string]string{"default": "默认"})
	require.NoError(t, err)
	_, err = parseTokenImportWorkbook(bytes.NewReader(data))
	require.Error(t, err)
	f, err := excelize.OpenReader(bytes.NewReader(data))
	require.NoError(t, err)
	defer f.Close()
	for row := 6; row <= 106; row++ {
		require.NoError(t, f.SetCellStr("API Keys", fmt.Sprintf("A%d", row), "name"))
	}
	buf, err := f.WriteToBuffer()
	require.NoError(t, err)
	_, err = parseTokenImportWorkbook(buf)
	require.ErrorContains(t, err, "100")
}

func TestUserGroupDropdownHidesInternalGroupFromAdmin(t *testing.T) {
	user := setupImportTest(t)
	require.NoError(t, model.DB.Model(user).Update("role", common.RoleRootUser).Error)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1,"codex-pro":1,"parnter":1}`))
	ctx, recorder := newTokenAutoGroupsAuthenticatedContext(t, http.MethodGet, "/api/user/self/groups", nil, user.Id)
	GetUserGroups(ctx)
	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success)
	var groups map[string]any
	require.NoError(t, common.Unmarshal(response.Data, &groups))
	require.Contains(t, groups, "default")
	require.NotContains(t, groups, "parnter")
}
