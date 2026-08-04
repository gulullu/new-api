package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v81"
	"gorm.io/gorm"
)

func setupReferralPaymentReversalControllerTest(t *testing.T) *gorm.DB {
	t.Helper()

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	dsn := filepath.Join(t.TempDir(), "referral-payment-reversal.db")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.ReferralPaymentState{}, &model.ReferralRewardClaim{}, &model.Log{}))
	model.DB, model.LOG_DB = db, db

	t.Cleanup(func() {
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedisEnabled
	})
	return db
}

func seedControllerReferralReward(t *testing.T, db *gorm.DB, provider string, gatewayPaymentId string) (int, int) {
	t.Helper()

	const inviterId = 8801
	const rewardQuota = 150000
	require.NoError(t, db.Create(&model.User{
		Id:              inviterId,
		Username:        "refund-controller-inviter",
		Status:          common.UserStatusEnabled,
		AffCount:        1,
		AffQuota:        rewardQuota,
		AffHistoryQuota: rewardQuota,
	}).Error)
	claim := &model.ReferralRewardClaim{
		InviteeId:        8802,
		InviterId:        inviterId,
		TopUpId:          8803,
		TradeNo:          "refund-controller-trade",
		PaymentProvider:  provider,
		PaidAmount:       "100",
		PaidCurrency:     "CNY",
		RateBasisPoints:  model.ReferralRewardBasisPoints,
		RewardQuota:      rewardQuota,
		Status:           model.ReferralRewardStatusAwarded,
		GatewayEventId:   "original-payment-event",
		GatewayPaymentId: gatewayPaymentId,
	}
	require.NoError(t, db.Create(claim).Error)
	return inviterId, claim.Id
}

func assertControllerReferralRewardReversed(t *testing.T, db *gorm.DB, inviterId int, claimId int, reversalEventId string) {
	t.Helper()

	var inviter model.User
	require.NoError(t, db.First(&inviter, inviterId).Error)
	assert.Zero(t, inviter.AffCount)
	assert.Zero(t, inviter.AffQuota)
	assert.Zero(t, inviter.AffHistoryQuota)

	var claim model.ReferralRewardClaim
	require.NoError(t, db.First(&claim, claimId).Error)
	assert.Equal(t, model.ReferralRewardStatusReversed, claim.Status)
	assert.Equal(t, reversalEventId, claim.ReversalEventId)
}

func TestStripeProductionRefundAndDisputeEventsReverseReferralReward(t *testing.T) {
	eventTypes := []stripe.EventType{
		stripe.EventTypeRefundCreated,
		stripe.EventType("refund.updated"),
		stripe.EventTypeChargeRefunded,
		stripe.EventTypeChargeDisputeCreated,
	}

	for _, eventType := range eventTypes {
		t.Run(string(eventType), func(t *testing.T) {
			db := setupReferralPaymentReversalControllerTest(t)
			inviterId, claimId := seedControllerReferralReward(t, db, model.PaymentProviderStripe, "pi_referral_refund")
			eventId := "evt_" + strings.ReplaceAll(string(eventType), ".", "_")
			event := stripe.Event{
				ID:       eventId,
				Livemode: true,
				Type:     eventType,
				Data: &stripe.EventData{Object: map[string]interface{}{
					"payment_intent": "pi_referral_refund",
					"status":         "succeeded",
				}},
			}

			require.NoError(t, handleStripeReferralReversal(context.Background(), event, "127.0.0.1"))
			assertControllerReferralRewardReversed(t, db, inviterId, claimId, eventId)
		})
	}
}

func TestStripeIncompleteRefundDoesNotReverseReferralReward(t *testing.T) {
	for _, status := range []string{"pending", "requires_action", "failed", "canceled", ""} {
		t.Run(status, func(t *testing.T) {
			db := setupReferralPaymentReversalControllerTest(t)
			_, claimId := seedControllerReferralReward(t, db, model.PaymentProviderStripe, "pi_incomplete_refund")
			event := stripe.Event{
				ID:       "evt_incomplete_refund_" + status,
				Livemode: true,
				Type:     stripe.EventTypeRefundCreated,
				Data: &stripe.EventData{Object: map[string]interface{}{
					"payment_intent": "pi_incomplete_refund",
					"status":         status,
				}},
			}

			require.NoError(t, handleStripeReferralReversal(context.Background(), event, "127.0.0.1"))
			var claim model.ReferralRewardClaim
			require.NoError(t, db.First(&claim, claimId).Error)
			assert.Equal(t, model.ReferralRewardStatusAwarded, claim.Status)
		})
	}
}

func TestStripeTestRefundDoesNotReverseProductionReferralReward(t *testing.T) {
	db := setupReferralPaymentReversalControllerTest(t)
	_, claimId := seedControllerReferralReward(t, db, model.PaymentProviderStripe, "pi_test_refund")
	event := stripe.Event{
		ID:       "evt_test_refund",
		Livemode: false,
		Type:     stripe.EventTypeRefundCreated,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"payment_intent": "pi_test_refund",
		}},
	}

	require.NoError(t, handleStripeReferralReversal(context.Background(), event, "127.0.0.1"))
	var claim model.ReferralRewardClaim
	require.NoError(t, db.First(&claim, claimId).Error)
	assert.Equal(t, model.ReferralRewardStatusAwarded, claim.Status)
}

func TestStripeUnrelatedRefundWithoutPaymentIntentIsAcknowledged(t *testing.T) {
	event := stripe.Event{
		ID:       "evt_refund_without_payment_intent",
		Livemode: true,
		Type:     stripe.EventTypeRefundCreated,
		Data: &stripe.EventData{Object: map[string]interface{}{
			"status": "succeeded",
		}},
	}

	require.NoError(t, handleStripeReferralReversal(context.Background(), event, "127.0.0.1"))
}

func TestValidateCreemWebhookModeUsesSignedEnvironment(t *testing.T) {
	previousTestMode := setting.CreemTestMode
	t.Cleanup(func() { setting.CreemTestMode = previousTestMode })

	tests := []struct {
		name           string
		configuredTest bool
		modes          []string
		wantProduction bool
		wantError      bool
	}{
		{name: "production", modes: []string{"prod", "prod"}, wantProduction: true},
		{name: "test", configuredTest: true, modes: []string{"test", "sandbox"}},
		{name: "local test", configuredTest: true, modes: []string{"local"}},
		{name: "missing", modes: []string{""}, wantError: true},
		{name: "unknown", modes: []string{"preview"}, wantError: true},
		{name: "conflicting signed modes", configuredTest: true, modes: []string{"test", "prod"}, wantError: true},
		{name: "configuration mismatch", modes: []string{"sandbox"}, wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setting.CreemTestMode = test.configuredTest
			production, err := validateCreemWebhookMode(test.modes...)
			if test.wantError {
				require.ErrorIs(t, err, errInvalidCreemWebhookMode)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.wantProduction, production)
		})
	}
}

func TestCreemProductionRefundAndDisputeEventsReverseReferralReward(t *testing.T) {
	previousTestMode := setting.CreemTestMode
	setting.CreemTestMode = false
	t.Cleanup(func() { setting.CreemTestMode = previousTestMode })

	for _, eventType := range []string{"refund.created", "dispute.created"} {
		t.Run(eventType, func(t *testing.T) {
			db := setupReferralPaymentReversalControllerTest(t)
			inviterId, claimId := seedControllerReferralReward(t, db, model.PaymentProviderCreem, "tran_referral_refund")
			eventId := "evt_" + strings.ReplaceAll(eventType, ".", "_")
			event := CreemWebhookEvent{Id: eventId, EventType: eventType}
			event.Object.Mode = "prod"
			event.Object.Transaction.Id = "tran_referral_refund"
			event.Object.Transaction.Mode = "prod"

			recorder := httptest.NewRecorder()
			ginContext, _ := gin.CreateTestContext(recorder)
			ginContext.Request = httptest.NewRequest(http.MethodPost, "/api/user/creem/callback", nil)
			handleCreemReferralReversal(ginContext, &event)

			assert.Equal(t, http.StatusOK, recorder.Code)
			assertControllerReferralRewardReversed(t, db, inviterId, claimId, eventId)
		})
	}
}

func TestCreemTestRefundDoesNotReverseProductionReferralReward(t *testing.T) {
	previousTestMode := setting.CreemTestMode
	setting.CreemTestMode = true
	t.Cleanup(func() { setting.CreemTestMode = previousTestMode })

	db := setupReferralPaymentReversalControllerTest(t)
	_, claimId := seedControllerReferralReward(t, db, model.PaymentProviderCreem, "tran_test_refund")
	event := CreemWebhookEvent{Id: "evt_test_refund", EventType: "refund.created"}
	event.Object.Mode = "sandbox"
	event.Object.Transaction.Id = "tran_test_refund"
	event.Object.Transaction.Mode = "sandbox"

	recorder := httptest.NewRecorder()
	ginContext, _ := gin.CreateTestContext(recorder)
	ginContext.Request = httptest.NewRequest(http.MethodPost, "/api/user/creem/callback", nil)
	handleCreemReferralReversal(ginContext, &event)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var claim model.ReferralRewardClaim
	require.NoError(t, db.First(&claim, claimId).Error)
	assert.Equal(t, model.ReferralRewardStatusAwarded, claim.Status)
}
