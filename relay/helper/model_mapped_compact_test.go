package helper

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResponsesCompactModelMappingUsesBaseModelForIdentityAndBilling(t *testing.T) {
	ctx, _ := gin.CreateTestContext(nil)
	ctx.Set("model_mapping", `{"gpt-5.5":"upstream-gpt-5.5"}`)
	request := &dto.OpenAIResponsesCompactionRequest{Model: "gpt-5.5"}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponsesCompact,
		OriginModelName: "gpt-5.5",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-5.5",
		},
	}

	err := ModelMappedHelper(ctx, info, request)

	require.NoError(t, err)
	assert.True(t, info.IsModelMapped)
	assert.Equal(t, "gpt-5.5", info.OriginModelName)
	assert.Equal(t, "upstream-gpt-5.5", info.UpstreamModelName)
	assert.Equal(t, "upstream-gpt-5.5", request.Model)
}
