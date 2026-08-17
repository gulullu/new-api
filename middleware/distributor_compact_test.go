package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newCompactDistributorTestContext(t *testing.T, path, modelName string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"model":"`+modelName+`","input":"hello"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	t.Cleanup(func() { common.CleanupBodyStorage(ctx) })
	return ctx, recorder
}

func TestResponsesCompactDistributionKeepsBaseModelIdentity(t *testing.T) {
	ctx, _ := newCompactDistributorTestContext(t, "/v1/responses/compact", "gpt-5.5")

	request, shouldSelectChannel, err := getModelRequest(ctx)

	require.NoError(t, err)
	require.NotNil(t, request)
	assert.True(t, shouldSelectChannel)
	assert.Equal(t, "gpt-5.5", request.Model)
}

func TestDistributorRejectsDeprecatedCompactAliases(t *testing.T) {
	for _, path := range []string{"/v1/responses", "/v1/responses/compact"} {
		t.Run(path, func(t *testing.T) {
			ctx, recorder := newCompactDistributorTestContext(t, path, "gpt-5.5-openai-compact")

			Distribute()(ctx)

			assert.True(t, ctx.IsAborted())
			assert.Equal(t, http.StatusNotFound, recorder.Code)
			assert.Contains(t, recorder.Body.String(), string(types.ErrorCodeModelNotFound))
			assert.Contains(t, recorder.Body.String(), "use its base model name")
		})
	}
}
