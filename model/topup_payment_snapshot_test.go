package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestStripeRechargeStoresVerifiedPaymentWithoutChangingQuotaSettlement(t *testing.T) {
	truncateTables(t)

	user := &User{
		Id:       6101,
		Username: "stripe-payment-snapshot-user",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(user).Error)

	topUp := &TopUp{
		UserId:          user.Id,
		Amount:          100,
		Money:           100,
		TradeNo:         "stripe-payment-snapshot",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		PaymentAmount:   "14.25",
		PaymentCurrency: "USD",
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())

	payment, err := NewVerifiedPayment("13.54", "usd", "evt_snapshot", "pi_snapshot", true)
	require.NoError(t, err)
	require.NoError(t, Recharge(topUp.TradeNo, "cus_snapshot", "127.0.0.1", payment))

	stored := GetTopUpByTradeNo(topUp.TradeNo)
	require.NotNil(t, stored)
	assert.Equal(t, int64(100), stored.Amount)
	assert.Equal(t, float64(100), stored.Money)
	assert.Equal(t, "13.54", stored.PaymentAmount)
	assert.Equal(t, "USD", stored.PaymentCurrency)

	var storedUser User
	require.NoError(t, DB.Select("quota").First(&storedUser, user.Id).Error)
	assert.Equal(t, int(100*common.QuotaPerUnit), storedUser.Quota)
}

func TestManualCompletionClearsQuoteAndVerifiedCallbackOnlyReconcilesSnapshot(t *testing.T) {
	truncateTables(t)

	inviter := &User{
		Id:       6150,
		Username: "manual-payment-snapshot-inviter",
		AffCode:  "manual-snapshot-inviter",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(inviter).Error)
	user := &User{
		Id:        6151,
		Username:  "manual-payment-snapshot-user",
		AffCode:   "manual-snapshot-user",
		Status:    common.UserStatusEnabled,
		InviterId: inviter.Id,
	}
	require.NoError(t, DB.Create(user).Error)
	topUp := &TopUp{
		UserId:          user.Id,
		Amount:          100,
		Money:           100,
		TradeNo:         "manual-payment-snapshot",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		PaymentAmount:   "14.25",
		PaymentCurrency: "USD",
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())

	require.NoError(t, ManualCompleteTopUp(topUp.TradeNo, "127.0.0.1"))
	manuallyCompleted := GetTopUpByTradeNo(topUp.TradeNo)
	require.NotNil(t, manuallyCompleted)
	assert.Empty(t, manuallyCompleted.PaymentAmount)
	assert.Empty(t, manuallyCompleted.PaymentCurrency)

	var credited User
	require.NoError(t, DB.Select("quota").First(&credited, user.Id).Error)
	expectedQuota := int(100 * common.QuotaPerUnit)
	assert.Equal(t, expectedQuota, credited.Quota)

	payment, err := NewVerifiedPayment("13.54", "USD", "evt_manual", "pi_manual", true)
	require.NoError(t, err)
	require.NoError(t, Recharge(topUp.TradeNo, "cus_manual", "127.0.0.1", payment))

	reconciled := GetTopUpByTradeNo(topUp.TradeNo)
	require.NotNil(t, reconciled)
	assert.Equal(t, "13.54", reconciled.PaymentAmount)
	assert.Equal(t, "USD", reconciled.PaymentCurrency)
	require.NoError(t, DB.Select("quota").First(&credited, user.Id).Error)
	assert.Equal(t, expectedQuota, credited.Quota)
	var rewardClaims int64
	require.NoError(t, DB.Model(&ReferralRewardClaim{}).Count(&rewardClaims).Error)
	assert.Zero(t, rewardClaims)
}

func TestCompletedTopUpPaymentSnapshotReconcile(t *testing.T) {
	newSuccessfulTopUp := func(t *testing.T, tradeNo string, paymentAmount string, paymentCurrency string) (*User, *TopUp) {
		t.Helper()
		user := &User{
			Id:       6201,
			Username: "stripe-payment-reconcile-user",
			Status:   common.UserStatusEnabled,
			Quota:    12345,
		}
		require.NoError(t, DB.Create(user).Error)
		topUp := &TopUp{
			UserId:          user.Id,
			Amount:          100,
			Money:           100,
			TradeNo:         tradeNo,
			PaymentMethod:   PaymentMethodStripe,
			PaymentProvider: PaymentProviderStripe,
			PaymentAmount:   paymentAmount,
			PaymentCurrency: paymentCurrency,
			Status:          common.TopUpStatusSuccess,
		}
		require.NoError(t, topUp.Insert())
		return user, topUp
	}

	t.Run("fills both missing legacy fields without crediting again", func(t *testing.T) {
		truncateTables(t)
		user, topUp := newSuccessfulTopUp(t, "stripe-reconcile-empty", "", "")
		payment, err := NewVerifiedPayment("13.54", "usd", "evt_empty", "pi_empty", true)
		require.NoError(t, err)

		require.NoError(t, Recharge(topUp.TradeNo, "cus_empty", "127.0.0.1", payment))

		stored := GetTopUpByTradeNo(topUp.TradeNo)
		require.NotNil(t, stored)
		assert.Equal(t, "13.54", stored.PaymentAmount)
		assert.Equal(t, "USD", stored.PaymentCurrency)
		var storedUser User
		require.NoError(t, DB.Select("quota").First(&storedUser, user.Id).Error)
		assert.Equal(t, 12345, storedUser.Quota)
	})

	t.Run("accepts decimal-equivalent existing snapshot without rewriting", func(t *testing.T) {
		truncateTables(t)
		_, topUp := newSuccessfulTopUp(t, "stripe-reconcile-equal", "13.5400", "USD")
		payment, err := NewVerifiedPayment("13.54", "usd", "evt_equal", "pi_equal", true)
		require.NoError(t, err)

		require.NoError(t, Recharge(topUp.TradeNo, "cus_equal", "127.0.0.1", payment))

		stored := GetTopUpByTradeNo(topUp.TradeNo)
		require.NotNil(t, stored)
		assert.Equal(t, "13.5400", stored.PaymentAmount)
		assert.Equal(t, "USD", stored.PaymentCurrency)
	})

	conflicts := []struct {
		name             string
		storedAmount     string
		storedCurrency   string
		callbackAmount   string
		callbackCurrency string
	}{
		{
			name:             "amount mismatch",
			storedAmount:     "13.54",
			storedCurrency:   "USD",
			callbackAmount:   "13.55",
			callbackCurrency: "USD",
		},
		{
			name:             "currency mismatch",
			storedAmount:     "13.54",
			storedCurrency:   "USD",
			callbackAmount:   "13.54",
			callbackCurrency: "CNY",
		},
		{
			name:             "partial snapshot",
			storedAmount:     "13.54",
			storedCurrency:   "",
			callbackAmount:   "13.54",
			callbackCurrency: "USD",
		},
	}
	for index, test := range conflicts {
		t.Run(test.name, func(t *testing.T) {
			truncateTables(t)
			_, topUp := newSuccessfulTopUp(t, "stripe-reconcile-conflict-"+string(rune('a'+index)), test.storedAmount, test.storedCurrency)
			payment, err := NewVerifiedPayment(test.callbackAmount, test.callbackCurrency, "evt_conflict", "pi_conflict", true)
			require.NoError(t, err)

			err = Recharge(topUp.TradeNo, "cus_conflict", "127.0.0.1", payment)
			require.ErrorIs(t, err, ErrTopUpPaymentSnapshotConflict)

			stored := GetTopUpByTradeNo(topUp.TradeNo)
			require.NotNil(t, stored)
			assert.Equal(t, test.storedAmount, stored.PaymentAmount)
			assert.Equal(t, test.storedCurrency, stored.PaymentCurrency)
		})
	}
}

type legacyTopUpWithoutPaymentSnapshot struct {
	Id              int
	UserId          int
	Amount          int64
	Money           float64
	TradeNo         string `gorm:"unique;type:varchar(255);index"`
	PaymentMethod   string `gorm:"type:varchar(50)"`
	PaymentProvider string `gorm:"type:varchar(50);default:''"`
	CreateTime      int64
	CompleteTime    int64
	Status          string
}

func (legacyTopUpWithoutPaymentSnapshot) TableName() string {
	return "top_ups"
}

func TestTopUpAutoMigrateAddsEmptyPaymentSnapshotToLegacyRows(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&legacyTopUpWithoutPaymentSnapshot{}))
	require.NoError(t, db.Create(&legacyTopUpWithoutPaymentSnapshot{
		Id:              1,
		UserId:          7,
		Amount:          100,
		Money:           100,
		TradeNo:         "legacy-payment-snapshot",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          common.TopUpStatusSuccess,
	}).Error)

	require.NoError(t, db.AutoMigrate(&TopUp{}))
	assert.True(t, db.Migrator().HasColumn(&TopUp{}, "payment_amount"))
	assert.True(t, db.Migrator().HasColumn(&TopUp{}, "payment_currency"))

	var migrated TopUp
	require.NoError(t, db.First(&migrated, 1).Error)
	assert.Equal(t, int64(100), migrated.Amount)
	assert.Equal(t, float64(100), migrated.Money)
	assert.Empty(t, migrated.PaymentAmount)
	assert.Empty(t, migrated.PaymentCurrency)
}
