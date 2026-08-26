package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPrivatePartnerGroupMirrorsCodexProRatio(t *testing.T) {
	originalRatios := GroupRatio2JSONString()
	require.NoError(t, UpdateGroupRatioByJSONString(`{"default":1,"codex-pro":2.75}`))
	t.Cleanup(func() {
		require.NoError(t, UpdateGroupRatioByJSONString(originalRatios))
	})

	assert.True(t, ContainsGroupRatio("parnter"))
	assert.Equal(t, 2.75, GetGroupRatio("parnter"))
	assert.Equal(t, 2.75, GetGroupRatioCopy()["parnter"])
}
