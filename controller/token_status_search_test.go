package controller

import (
	"fmt"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"net/http"
	"testing"
)

func TestSearchTokensStatusAcrossPages(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	disabled := seedToken(t, db, 101, "older-disabled", "old-disabled-key")
	require.NoError(t, db.Model(disabled).Updates(map[string]any{"status": common.TokenStatusDisabled, "group": "vip"}).Error)
	expired := seedToken(t, db, 101, "older-expired", "old-expired-key")
	require.NoError(t, db.Model(expired).Update("status", common.TokenStatusExpired).Error)
	for i := 0; i < 25; i++ {
		seedToken(t, db, 101, fmt.Sprintf("enabled-%d", i), fmt.Sprintf("enabled-key-%d", i))
	}
	foreign := seedToken(t, db, 102, "foreign-disabled", "foreign-disabled-key")
	require.NoError(t, db.Model(foreign).Update("status", common.TokenStatusDisabled).Error)
	for _, tc := range []struct {
		query string
		total int
		ids   []int
	}{
		{"status=2", 1, []int{disabled.Id}},
		{"status=2,3&size=1", 2, []int{expired.Id}},
		{"status=2,3&size=1&p=2", 2, []int{disabled.Id}},
		{"status=2&group=vip&keyword=older%25", 1, []int{disabled.Id}},
		{"status=2&group=default", 0, []int{}},
		{"status=1", 25, nil},
		{"", 27, nil},
	} {
		t.Run(tc.query, func(t *testing.T) {
			ctx, rec := newAuthenticatedContext(t, http.MethodGet, "/api/token/search?"+tc.query, nil, 101)
			SearchTokens(ctx)
			response := decodeAPIResponse(t, rec)
			require.True(t, response.Success, response.Message)
			var page struct {
				Items  []model.Token     `json:"items"`
				Total  int               `json:"total"`
				Facets model.TokenFacets `json:"facets"`
			}
			require.NoError(t, common.Unmarshal(response.Data, &page))
			require.EqualValues(t, tc.total, page.Total)
			if tc.query == "status=2" {
				require.EqualValues(t, 1, page.Facets.Groups["vip"])
				require.EqualValues(t, 25, page.Facets.Statuses["1"])
				require.EqualValues(t, 1, page.Facets.Statuses["2"])
			}
			if tc.query == "" {
				require.EqualValues(t, 26, page.Facets.Groups["default"])
			}
			if tc.ids != nil {
				ids := []int{}
				for _, item := range page.Items {
					ids = append(ids, item.Id)
				}
				require.Equal(t, tc.ids, ids)
			}
			for _, item := range page.Items {
				require.Equal(t, 101, item.UserId)
			}
		})
	}
	for _, value := range []string{"0", "5", "2,x", "2,,3", "1,2,3,4,2"} {
		ctx, rec := newAuthenticatedContext(t, http.MethodGet, "/api/token/search?status="+value, nil, 101)
		SearchTokens(ctx)
		require.False(t, decodeAPIResponse(t, rec).Success)
	}
	var count int64
	require.NoError(t, db.Model(&model.Token{}).Count(&count).Error)
	require.EqualValues(t, 28, count)
}
