package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// TokenImportBatch records an idempotent import without copying secret keys.
type TokenImportBatch struct {
	UserId      int    `gorm:"primaryKey;autoIncrement:false"`
	RequestId   string `gorm:"primaryKey;size:64"`
	PayloadHash string `gorm:"size:64;not null"`
	TokenIds    string `gorm:"type:text;not null"`
	CreatedAt   int64
}

type TokenImportTemplate struct {
	Id        int    `json:"id"`
	UserId    int    `json:"-" gorm:"index;not null"`
	Name      string `json:"name" gorm:"size:100;not null"`
	Defaults  string `json:"-" gorm:"type:text;not null"`
	CreatedAt int64  `json:"created_at"`
}

func ImportUserTokens(userID int, requestID, payloadHash string, tokens []Token, allowExistingNames bool) ([]Token, error) {
	if userID <= 0 || len(tokens) < 1 || len(tokens) > 100 || len(requestID) < 16 || len(requestID) > 64 {
		return nil, errors.New("invalid import request")
	}
	var result []Token
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Select("id").First(&user, userID).Error; err != nil {
			return err
		}
		var receipt TokenImportBatch
		err := tx.Where("user_id = ? AND request_id = ?", userID, requestID).First(&receipt).Error
		if err == nil {
			if receipt.PayloadHash != payloadHash {
				return errors.New("Import request has changed. Start a new import.")
			}
			var ids []int
			if err := common.UnmarshalJsonStr(receipt.TokenIds, &ids); err != nil {
				return err
			}
			if err := tx.Where("user_id = ? AND id IN ?", userID, ids).Order("id").Find(&result).Error; err != nil {
				return err
			}
			if len(result) != len(ids) {
				return errors.New("Imported keys were removed. Start a new import.")
			}
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		var count int64
		if err := tx.Model(&Token{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
			return err
		}
		if count+int64(len(tokens)) > int64(operation_setting.GetMaxUserTokens()) {
			return errors.New("API key limit exceeded")
		}
		names := make([]string, len(tokens))
		for i := range tokens {
			names[i] = tokens[i].Name
		}
		if !allowExistingNames {
			var existing int64
			if err := tx.Model(&Token{}).Where("user_id = ? AND name IN ?", userID, names).Count(&existing).Error; err != nil {
				return err
			}
			if existing > 0 {
				return errors.New("API keys with these names already exist. Review the names before creating.")
			}
		}
		ids := make([]int, 0, len(tokens))
		for i := range tokens {
			tokens[i].UserId = userID
			key, err := common.GenerateKey()
			if err != nil {
				return err
			}
			tokens[i].Key = key
			tokens[i].CreatedTime = common.GetTimestamp()
			tokens[i].AccessedTime = tokens[i].CreatedTime
			tokens[i].Status = common.TokenStatusEnabled
			if normalized, changed := normalizeDeprecatedCompactModelList(tokens[i].ModelLimits); changed {
				tokens[i].ModelLimits = normalized
			}
			if err := tx.Create(&tokens[i]).Error; err != nil {
				return err
			}
			ids = append(ids, tokens[i].Id)
		}
		encoded, err := common.Marshal(ids)
		if err != nil {
			return err
		}
		receipt = TokenImportBatch{UserId: userID, RequestId: requestID, PayloadHash: payloadHash, TokenIds: string(encoded), CreatedAt: time.Now().Unix()}
		if err := tx.Create(&receipt).Error; err != nil {
			return err
		}
		result = tokens
		return nil
	})
	return result, err
}

// InsertUserToken shares the user lock with imports so both enforce the same limit.
func InsertUserToken(token *Token) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Select("id").First(&user, token.UserId).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&Token{}).Where("user_id = ?", token.UserId).Count(&count).Error; err != nil {
			return err
		}
		if count >= int64(operation_setting.GetMaxUserTokens()) {
			return errors.New("API key limit exceeded")
		}
		if normalized, changed := normalizeDeprecatedCompactModelList(token.ModelLimits); changed {
			token.ModelLimits = normalized
		}
		return tx.Create(token).Error
	})
}

func FindExistingTokenNames(userID int, names []string) ([]string, error) {
	result := make([]string, 0)
	err := DB.Model(&Token{}).Where("user_id = ? AND name IN ?", userID, names).Distinct().Pluck("name", &result).Error
	return result, err
}

func SaveTokenImportTemplate(template *TokenImportTemplate) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).Select("id").First(&user, template.UserId).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&TokenImportTemplate{}).Where("user_id = ?", template.UserId).Count(&count).Error; err != nil {
			return err
		}
		if count >= 20 {
			return errors.New("You can save up to 20 import templates")
		}
		if err := tx.Model(&TokenImportTemplate{}).Where("user_id = ? AND name = ?", template.UserId, template.Name).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return errors.New("A template with this name already exists")
		}
		template.CreatedAt = time.Now().Unix()
		return tx.Create(template).Error
	})
}

func ListTokenImportTemplates(userID int) ([]TokenImportTemplate, error) {
	result := make([]TokenImportTemplate, 0)
	err := DB.Where("user_id = ?", userID).Order("id desc").Limit(20).Find(&result).Error
	return result, err
}

func DeleteTokenImportTemplate(userID, id int) error {
	result := DB.Where("user_id = ? AND id = ?", userID, id).Delete(&TokenImportTemplate{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("Template not found")
	}
	return nil
}
