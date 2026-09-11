package controller

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

type tokenWorkbookLabels struct {
	Title        string   `json:"title"`
	Instructions string   `json:"instructions"`
	Headers      []string `json:"headers"`
	GroupHelp    string   `json:"group_help"`
	ExpiryHelp   string   `json:"expiry_help"`
}

var tokenWorkbookHeaders = []string{"name", "group", "quota", "expiry", "models", "ips"}

// Group choices are always derived from the authenticated user's permissions.
func DownloadTokenImportWorkbook(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	var labels tokenWorkbookLabels
	if c.ShouldBindJSON(&labels) != nil || len(labels.Headers) != 6 {
		common.ApiError(c, fmt.Errorf("Invalid import data"))
		return
	}
	userGroup, err := getTokenRequestUserGroup(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groups := service.GetUserUsableGroupsForUser(c.GetInt("id"), userGroup)
	for name := range groups {
		if !service.CanUserUseGroup(c.GetInt("id"), userGroup, name) {
			delete(groups, name)
		}
	}
	data, err := buildTokenImportWorkbook(labels, groups)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Header("Content-Disposition", `attachment; filename="api-key-template.xlsx"`)
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data)
}

func buildTokenImportWorkbook(labels tokenWorkbookLabels, groups map[string]string) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()
	const sheet = "API Keys"
	if err := f.SetSheetName("Sheet1", sheet); err != nil {
		return nil, err
	}
	if _, err := f.NewSheet("Groups"); err != nil {
		return nil, err
	}
	// Every input cell is text, preserving leading zeroes and ISO date strings.
	textStyle, err := f.NewStyle(&excelize.Style{NumFmt: 49, Alignment: &excelize.Alignment{Vertical: "top"}})
	if err != nil {
		return nil, err
	}
	headerStyle, err := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true, Color: "FFFFFF"}, Fill: excelize.Fill{Type: "pattern", Color: []string{"334155"}, Pattern: 1}, Alignment: &excelize.Alignment{WrapText: true}})
	if err != nil {
		return nil, err
	}
	for _, op := range []func() error{
		func() error { return f.SetCellStr(sheet, "A1", labels.Title) },
		func() error { return f.MergeCell(sheet, "A1", "F1") },
		func() error { return f.SetCellStr(sheet, "A2", labels.Instructions) },
		func() error { return f.MergeCell(sheet, "A2", "F3") },
		func() error { return f.SetCellStyle(sheet, "A6", "F105", textStyle) },
		func() error { return f.SetCellStyle(sheet, "A4", "F4", headerStyle) },
		func() error { return f.SetColWidth(sheet, "A", "F", 26) },
		func() error { return f.SetColWidth(sheet, "E", "F", 38) },
		func() error { return f.SetRowHeight(sheet, 4, 32) },
		func() error { return f.SetRowVisible(sheet, 5, false) },
		func() error {
			return f.SetPanes(sheet, &excelize.Panes{Freeze: true, YSplit: 5, TopLeftCell: "A6", ActivePane: "bottomLeft"})
		},
	} {
		if err := op(); err != nil {
			return nil, err
		}
	}
	wrap, err := f.NewStyle(&excelize.Style{Alignment: &excelize.Alignment{WrapText: true, Vertical: "top"}})
	if err != nil {
		return nil, err
	}
	if err = f.SetCellStyle(sheet, "A2", "F3", wrap); err != nil {
		return nil, err
	}
	if err = f.SetRowHeight(sheet, 2, 45); err != nil {
		return nil, err
	}
	for i, h := range tokenWorkbookHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 5)
		if err = f.SetCellStr(sheet, cell, h); err != nil {
			return nil, err
		}
		cell, _ = excelize.CoordinatesToCellName(i+1, 4)
		if err = f.SetCellStr(sheet, cell, labels.Headers[i]); err != nil {
			return nil, err
		}
	}
	names := make([]string, 0, len(groups))
	for name := range groups {
		names = append(names, name)
	}
	sort.Strings(names)
	if err = f.SetCellStr("Groups", "A1", labels.Headers[1]); err != nil {
		return nil, err
	}
	if err = f.SetCellStr("Groups", "B1", labels.GroupHelp); err != nil {
		return nil, err
	}
	for i, name := range names {
		if err = f.SetCellStr("Groups", fmt.Sprintf("A%d", i+2), name); err != nil {
			return nil, err
		}
		if err = f.SetCellStr("Groups", fmt.Sprintf("B%d", i+2), groups[name]); err != nil {
			return nil, err
		}
	}
	if err = f.SetColWidth("Groups", "A", "A", 30); err != nil {
		return nil, err
	}
	if err = f.SetColWidth("Groups", "B", "B", 80); err != nil {
		return nil, err
	}
	if len(names) > 0 {
		if err = f.SetDefinedName(&excelize.DefinedName{Name: "AvailableGroups", RefersTo: fmt.Sprintf("'Groups'!$A$2:$A$%d", len(names)+1)}); err != nil {
			return nil, err
		}
		dv := excelize.NewDataValidation(true)
		dv.SetSqref("B6:B105")
		dv.SetSqrefDropList("AvailableGroups")
		dv.SetInput(labels.Headers[1], labels.GroupHelp)
		dv.SetError(excelize.DataValidationErrorStyleStop, labels.Headers[1], labels.GroupHelp)
		if err = f.AddDataValidation(sheet, dv); err != nil {
			return nil, err
		}
	}
	dv := excelize.NewDataValidation(true)
	dv.SetSqref("D6:D105")
	if err = dv.SetDropList([]string{"7", "30", "never"}); err != nil {
		return nil, err
	}
	dv.SetInput(labels.Headers[3], labels.ExpiryHelp)
	// Dates are also allowed; do not reject values outside the quick-pick list.
	dv.ShowErrorMessage = false
	if err = f.AddDataValidation(sheet, dv); err != nil {
		return nil, err
	}
	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func ParseTokenImportWorkbook(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, (1<<20)+65536)
	if err := c.Request.ParseMultipartForm(1 << 20); err != nil {
		common.ApiError(c, fmt.Errorf("Import file must be smaller than 1 MB"))
		return
	}
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	}
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		common.ApiError(c, fmt.Errorf("Invalid import data"))
		return
	}
	defer file.Close()
	if header.Size > 1<<20 {
		common.ApiError(c, fmt.Errorf("Import file must be smaller than 1 MB"))
		return
	}
	data, err := parseTokenImportWorkbook(file)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"text": data})
}

func parseTokenImportWorkbook(reader io.Reader) (string, error) {
	invalid := fmt.Errorf("Invalid import data")
	f, err := excelize.OpenReader(io.LimitReader(reader, (1<<20)+1), excelize.Options{UnzipSizeLimit: 8 << 20, UnzipXMLSizeLimit: 8 << 20})
	if err != nil {
		return "", invalid
	}
	defer f.Close()
	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return "", invalid
	}
	sheet := sheets[0]
	rows, err := f.Rows(sheet)
	if err != nil {
		return "", invalid
	}
	defer rows.Close()
	var out bytes.Buffer
	writer := csv.NewWriter(&out)
	found := false
	count := 0
	rowNumber := 0
	for rows.Next() {
		rowNumber++
		if rowNumber > 110 {
			return "", fmt.Errorf("Import between 1 and 100 API keys")
		}
		cells, err := rows.Columns()
		if err != nil {
			return "", invalid
		}
		if !found {
			if len(cells) >= 6 {
				match := true
				for i, h := range tokenWorkbookHeaders {
					if strings.TrimSpace(cells[i]) != h {
						match = false
					}
				}
				if match {
					found = true
					if err = writer.Write(tokenWorkbookHeaders); err != nil {
						return "", err
					}
					continue
				}
			}
			if rowNumber >= 5 {
				return "", invalid
			}
			continue
		}
		for col := 1; col <= 6; col++ {
			cell, _ := excelize.CoordinatesToCellName(col, rowNumber)
			formula, err := f.GetCellFormula(sheet, cell)
			if err != nil || formula != "" {
				return "", fmt.Errorf("Spreadsheet formulas are not supported")
			}
		}
		populated := false
		for _, s := range cells {
			if strings.TrimSpace(s) != "" {
				populated = true
			}
		}
		if !populated {
			continue
		}
		if len(cells) > 6 {
			return "", invalid
		}
		count++
		if count > 100 {
			return "", fmt.Errorf("Import between 1 and 100 API keys")
		}
		record := make([]string, 6)
		copy(record, cells)
		if err = writer.Write(record); err != nil {
			return "", err
		}
	}
	if rows.Error() != nil || !found {
		return "", invalid
	}
	if count == 0 {
		return "", fmt.Errorf("Import between 1 and 100 API keys")
	}
	writer.Flush()
	return out.String(), writer.Error()
}
