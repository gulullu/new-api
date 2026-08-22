package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// RegistrationIPReward is the durable claim ledger for the one-time
// registration credit. The normalized IP primary key makes the policy safe
// across concurrent requests and application restarts without relying on a
// Redis TTL or an in-memory process-local map.
type RegistrationIPReward struct {
	IP        string `json:"ip" gorm:"primaryKey;type:varchar(64)"`
	UserID    int    `json:"user_id" gorm:"index;not null"`
	Quota     int    `json:"quota" gorm:"not null"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
}

func registrationIPBonusQuota() int {
	return common.QuotaFromFloat(common.RegistrationIPBonusCredits * common.QuotaPerUnit)
}

// claimRegistrationIPBonus inserts the IP claim exactly once in the caller's
// transaction. A duplicate claim is a normal no-op, not an error.
func claimRegistrationIPBonus(tx *gorm.DB, ip string, userID int) (int, bool, error) {
	normalized, ok := common.NormalizeIP(ip)
	if !ok || userID <= 0 {
		return 0, false, nil
	}
	quota := registrationIPBonusQuota()
	if quota <= 0 {
		return 0, false, errors.New("registration IP bonus quota must be positive")
	}
	claim := &RegistrationIPReward{
		IP:     normalized,
		UserID: userID,
		Quota:  quota,
	}
	result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(claim)
	if result.Error != nil {
		return 0, false, result.Error
	}
	return quota, result.RowsAffected == 1, nil
}
