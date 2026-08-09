package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStripeCheckoutPaymentSnapshotUsesLineItemMinorUnitRounding(t *testing.T) {
	minorAmount, payment, err := stripeCheckoutPaymentSnapshot(13.5375, 14.25, 0.1425, "usd")
	require.NoError(t, err)

	assert.Equal(t, int64(1354), minorAmount)
	assert.Equal(t, "13.54", payment.PaidAmountForLog())
	assert.Equal(t, "USD", payment.Currency)
}
