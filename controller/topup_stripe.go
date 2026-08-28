package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
	"github.com/stripe/stripe-go/v81/price"
	"github.com/stripe/stripe-go/v81/webhook"
	"github.com/thanhpk/randstr"
)

var stripeAdaptor = &StripeAdaptor{}

// StripePayRequest represents a payment request for Stripe checkout.
type StripePayRequest struct {
	// Amount is the quantity of units to purchase.
	Amount int64 `json:"amount"`
	// PaymentMethod specifies the payment method (e.g., "stripe").
	PaymentMethod string `json:"payment_method"`
	// SuccessURL is the optional custom URL to redirect after successful payment.
	// If empty, defaults to the server's console log page.
	SuccessURL string `json:"success_url,omitempty"`
	// CancelURL is the optional custom URL to redirect when payment is canceled.
	// If empty, defaults to the server's console topup page.
	CancelURL string `json:"cancel_url,omitempty"`
}

type StripeAdaptor struct {
}

func (*StripeAdaptor) RequestAmount(c *gin.Context, req *StripePayRequest) {
	minimumTopup := relayBasesPaymentMethodTopupMinimum(c, model.PaymentMethodStripe, getStripeMinTopup())
	if req.Amount < minimumTopup {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": relayBasesTopupMinimumMessage(c, minimumTopup)})
		return
	}
	if req.Amount > 10000 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值数量不能大于 10000"})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	if rejectInvalidCreditedQuota(c, id, getStripeCreditedQuota(req.Amount, group)) {
		return
	}
	payMoney := getStripePayMoney(float64(req.Amount), group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func (*StripeAdaptor) RequestPay(c *gin.Context, req *StripePayRequest) {
	if req.PaymentMethod != model.PaymentMethodStripe {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付渠道"})
		return
	}
	minimumTopup := relayBasesPaymentMethodTopupMinimum(c, model.PaymentMethodStripe, getStripeMinTopup())
	if req.Amount < minimumTopup {
		c.JSON(http.StatusOK, gin.H{"message": relayBasesTopupMinimumMessage(c, minimumTopup), "data": 10})
		return
	}
	if req.Amount > 10000 {
		c.JSON(http.StatusOK, gin.H{"message": "充值数量不能大于 10000", "data": 10})
		return
	}

	if req.SuccessURL != "" && common.ValidateRedirectURL(req.SuccessURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "支付成功重定向URL不在可信任域名列表中", "data": ""})
		return
	}

	if req.CancelURL != "" && common.ValidateRedirectURL(req.CancelURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "支付取消重定向URL不在可信任域名列表中", "data": ""})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "用户不存在"})
		return
	}
	chargedMoney := GetChargedAmount(float64(req.Amount), *user)
	if rejectInvalidCreditedQuota(c, id,
		decimal.NewFromFloat(chargedMoney).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
	) {
		return
	}
	unitPrice := setting.StripeUnitPrice
	payMoney := getStripePayMoneyAtUnitPrice(float64(req.Amount), user.Group, unitPrice)
	if payMoney <= 0.01 || math.IsNaN(payMoney) || math.IsInf(payMoney, 0) {
		c.JSON(http.StatusOK, gin.H{"message": "充值金额过低", "data": 10})
		return
	}

	reference := fmt.Sprintf("new-api-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "ref_" + common.Sha1([]byte(reference))

	checkout, err := genStripeLinkForLocaleWithQuantity(
		referenceId,
		user.StripeCustomer,
		user.Email,
		payMoney,
		unitPrice,
		req.SuccessURL,
		req.CancelURL,
		req.Amount,
		appI18n.GetLangFromContext(c),
	)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 创建 Checkout Session 失败 user_id=%d trade_no=%s amount=%d error=%q", id, referenceId, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	topUp := &model.TopUp{
		UserId:            id,
		Amount:            req.Amount,
		Money:             chargedMoney,
		TradeNo:           referenceId,
		PaymentMethod:     model.PaymentMethodStripe,
		PaymentProvider:   model.PaymentProviderStripe,
		PaymentAmount:     checkout.PaymentAmount,
		PaymentCurrency:   checkout.PaymentCurrency,
		ReferralUnitPrice: checkout.ReferralUnitPrice,
		CreateTime:        time.Now().Unix(),
		Status:            common.TopUpStatusPending,
	}
	err = topUp.Insert()
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, referenceId, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Stripe 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f pay_money=%.2f", id, referenceId, req.Amount, chargedMoney, payMoney))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": checkout.URL,
		},
	})
}

func RequestStripeAmount(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	stripeAdaptor.RequestAmount(c, &req)
}

func RequestStripePay(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	stripeAdaptor.RequestPay(c, &req)
}

func StripeWebhook(c *gin.Context) {
	ctx := c.Request.Context()
	if !isStripeWebhookEnabled() {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe webhook 读取请求体失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}

	signature := c.GetHeader("Stripe-Signature")
	logger.LogInfo(ctx, fmt.Sprintf("Stripe webhook 收到请求 path=%q client_ip=%s signature=%q body=%q", c.Request.RequestURI, c.ClientIP(), signature, string(payload)))
	event, err := webhook.ConstructEventWithOptions(payload, signature, setting.StripeWebhookSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})

	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe webhook 验签失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	callerIp := c.ClientIP()
	logger.LogInfo(ctx, fmt.Sprintf("Stripe webhook 验签成功 event_type=%s client_ip=%s path=%q", string(event.Type), callerIp, c.Request.RequestURI))
	var processingErr error
	switch event.Type {
	case stripe.EventTypeCheckoutSessionCompleted:
		processingErr = sessionCompleted(ctx, event, callerIp)
	case stripe.EventTypeCheckoutSessionExpired:
		sessionExpired(ctx, event)
	case stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded:
		processingErr = sessionAsyncPaymentSucceeded(ctx, event, callerIp)
	case stripe.EventTypeCheckoutSessionAsyncPaymentFailed:
		sessionAsyncPaymentFailed(ctx, event, callerIp)
	case stripe.EventTypeRefundCreated,
		stripe.EventType("refund.updated"),
		stripe.EventTypeChargeRefunded,
		stripe.EventTypeChargeDisputeCreated:
		processingErr = handleStripeReferralReversal(ctx, event, callerIp)
	default:
		logger.LogInfo(ctx, fmt.Sprintf("Stripe webhook 忽略事件 event_type=%s client_ip=%s", string(event.Type), callerIp))
	}
	if processingErr != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe webhook 处理失败 event_id=%s event_type=%s client_ip=%s error=%q", event.ID, string(event.Type), callerIp, processingErr.Error()))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	c.Status(http.StatusOK)
}

func handleStripeReferralReversal(ctx context.Context, event stripe.Event, callerIp string) error {
	if !event.Livemode {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 测试环境退款/拒付事件不撤销正式邀请返利 event_id=%s event_type=%s client_ip=%s", event.ID, string(event.Type), callerIp))
		return nil
	}
	if event.Type == stripe.EventTypeRefundCreated || event.Type == stripe.EventType("refund.updated") {
		refundStatus := strings.ToLower(strings.TrimSpace(event.GetObjectValue("status")))
		if refundStatus != "succeeded" {
			logger.LogInfo(ctx, fmt.Sprintf("Stripe 退款尚未成功，不撤销邀请返利 event_id=%s event_type=%s refund_status=%s client_ip=%s", event.ID, string(event.Type), refundStatus, callerIp))
			return nil
		}
	}

	eventId := strings.TrimSpace(event.ID)
	if eventId == "" {
		return errors.New("Stripe refund/dispute event is missing event id")
	}
	paymentIntent := strings.TrimSpace(event.GetObjectValue("payment_intent"))
	if paymentIntent == "" {
		// Some unrelated or legacy Stripe refund objects do not carry a
		// PaymentIntent. They cannot match a Checkout referral claim, and retrying
		// the same immutable event forever would not make them resolvable.
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 退款/拒付事件缺少 payment_intent，无法匹配邀请返利 event_id=%s event_type=%s client_ip=%s", eventId, string(event.Type), callerIp))
		return nil
	}

	outcome, err := model.ReverseReferralRewardByGatewayReference(
		model.PaymentProviderStripe,
		paymentIntent,
		eventId,
		string(event.Type),
	)
	if err != nil {
		return fmt.Errorf("reverse Stripe referral reward: %w", err)
	}
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 退款/拒付邀请返利撤销处理完成 event_id=%s event_type=%s payment_intent=%s changed=%t claim_id=%d client_ip=%s", eventId, string(event.Type), paymentIntent, outcome.Changed, outcome.ClaimId, callerIp))
	return nil
}

func sessionCompleted(ctx context.Context, event stripe.Event, callerIp string) error {
	customerId := event.GetObjectValue("customer")
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if "complete" != status {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe checkout.completed 状态异常，忽略处理 trade_no=%s status=%s client_ip=%s", referenceId, status, callerIp))
		return nil
	}

	paymentStatus := event.GetObjectValue("payment_status")
	if paymentStatus != "paid" {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe Checkout 支付未完成，等待异步结果 trade_no=%s payment_status=%s client_ip=%s", referenceId, paymentStatus, callerIp))
		return nil
	}

	return fulfillOrder(ctx, event, referenceId, customerId, callerIp)
}

// sessionAsyncPaymentSucceeded handles delayed payment methods (bank transfer, SEPA, etc.)
// that confirm payment after the checkout session completes.
func sessionAsyncPaymentSucceeded(ctx context.Context, event stripe.Event, callerIp string) error {
	customerId := event.GetObjectValue("customer")
	referenceId := event.GetObjectValue("client_reference_id")
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 异步支付成功 trade_no=%s client_ip=%s", referenceId, callerIp))

	return fulfillOrder(ctx, event, referenceId, customerId, callerIp)
}

// sessionAsyncPaymentFailed marks orders as failed when delayed payment methods
// ultimately fail (e.g. bank transfer not received, SEPA rejected).
func sessionAsyncPaymentFailed(ctx context.Context, event stripe.Event, callerIp string) {
	referenceId := event.GetObjectValue("client_reference_id")
	logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败 trade_no=%s client_ip=%s", referenceId, callerIp))

	if len(referenceId) == 0 {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败事件缺少订单号 client_ip=%s", callerIp))
		return
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)

	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败但本地订单不存在 trade_no=%s client_ip=%s", referenceId, callerIp))
		return
	}

	if topUp.PaymentProvider != model.PaymentProviderStripe {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败但订单支付网关不匹配 trade_no=%s payment_provider=%s client_ip=%s", referenceId, topUp.PaymentProvider, callerIp))
		return
	}

	if topUp.Status != common.TopUpStatusPending {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 异步支付失败但订单状态非 pending，忽略处理 trade_no=%s status=%s client_ip=%s", referenceId, topUp.Status, callerIp))
		return
	}

	topUp.Status = common.TopUpStatusFailed
	if err := topUp.Update(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 标记充值订单失败状态失败 trade_no=%s client_ip=%s error=%q", referenceId, callerIp, err.Error()))
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值订单已标记为失败 trade_no=%s client_ip=%s", referenceId, callerIp))
}

// fulfillOrder is the shared logic for crediting quota after payment is confirmed.
func fulfillOrder(ctx context.Context, event stripe.Event, referenceId string, customerId string, callerIp string) error {
	if len(referenceId) == 0 {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 完成订单时缺少订单号 client_ip=%s", callerIp))
		return errors.New("stripe checkout session is missing client_reference_id")
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	payload := map[string]any{
		"customer":     customerId,
		"amount_total": event.GetObjectValue("amount_total"),
		"currency":     strings.ToUpper(event.GetObjectValue("currency")),
		"event_type":   string(event.Type),
	}
	if err := model.CompleteSubscriptionOrder(referenceId, common.GetJsonString(payload), model.PaymentProviderStripe, ""); err == nil {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 订阅订单处理成功 trade_no=%s event_type=%s client_ip=%s", referenceId, string(event.Type), callerIp))
		return nil
	} else if err != nil && !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		logger.LogError(ctx, fmt.Sprintf("Stripe 订阅订单处理失败 trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
		return err
	}

	amountMinor, err := strconv.ParseInt(strings.TrimSpace(event.GetObjectValue("amount_total")), 10, 64)
	if err != nil {
		return fmt.Errorf("invalid Stripe amount_total: %w", err)
	}
	currency := strings.ToUpper(strings.TrimSpace(event.GetObjectValue("currency")))
	payment, err := model.NewVerifiedMinorUnitPayment(
		amountMinor,
		currency,
		event.ID,
		event.GetObjectValue("payment_intent"),
		event.Livemode,
	)
	if err != nil {
		return fmt.Errorf("invalid Stripe verified payment: %w", err)
	}

	err = model.Recharge(referenceId, customerId, callerIp, payment)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 充值处理失败 trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
		return err
	}

	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值成功 trade_no=%s amount_total=%s currency=%s event_type=%s client_ip=%s", referenceId, payment.PaidAmountForLog(), payment.Currency, string(event.Type), callerIp))
	return nil
}

func sessionExpired(ctx context.Context, event stripe.Event) {
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if "expired" != status {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe checkout.expired 状态异常，忽略处理 trade_no=%s status=%s", referenceId, status))
		return
	}

	if len(referenceId) == 0 {
		logger.LogWarn(ctx, "Stripe checkout.expired 缺少订单号")
		return
	}

	// Subscription order expiration
	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	if err := model.ExpireSubscriptionOrder(referenceId, model.PaymentProviderStripe); err == nil {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 订阅订单已过期 trade_no=%s", referenceId))
		return
	} else if err != nil && !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		logger.LogError(ctx, fmt.Sprintf("Stripe 订阅订单过期处理失败 trade_no=%s error=%q", referenceId, err.Error()))
		return
	}

	err := model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusExpired)
	if errors.Is(err, model.ErrTopUpNotFound) {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 充值订单不存在，无法标记过期 trade_no=%s", referenceId))
		return
	}
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 充值订单过期处理失败 trade_no=%s error=%q", referenceId, err.Error()))
		return
	}

	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值订单已过期 trade_no=%s", referenceId))
}

// stripeCheckoutResult carries the created URL and the exact expected charge.
type stripeCheckoutResult struct {
	URL               string
	PaymentAmount     string
	PaymentCurrency   string
	ReferralUnitPrice string
}

// genStripeLink generates a Stripe Checkout session URL for payment.
// It creates a new checkout session with the specified parameters and returns the payment URL.
//
// Parameters:
//   - referenceId: unique reference identifier for the transaction
//   - customerId: existing Stripe customer ID (empty string if new customer)
//   - email: customer email address for new customer creation
//   - payMoney: final amount to charge after applying unit price, group ratio, and preset discount
//   - configuredUnitPrice: the immutable unit price captured by RequestPay for this order
//   - successURL: custom URL to redirect after successful payment (empty for default)
//   - cancelURL: custom URL to redirect when payment is canceled (empty for default)
//
// Returns the checkout session URL and the exact amount/currency sent to
// Stripe, or an error if the session creation fails.
func genStripeLink(referenceId string, customerId string, email string, payMoney float64, configuredUnitPrice float64, successURL string, cancelURL string) (stripeCheckoutResult, error) {
	return genStripeLinkWithPaymentMethodTypesAndQuantity(
		referenceId,
		customerId,
		email,
		payMoney,
		configuredUnitPrice,
		successURL,
		cancelURL,
		1,
		nil,
	)
}

// genStripeLinkForLocale keeps the existing Stripe gateway request unchanged
// while constraining one-time Checkout to Alipay for Chinese-language users.
// Non-Chinese requests pass nil payment method types and continue to use the
// payment methods configured in Stripe Dashboard. The legacy helper keeps a
// quantity of one for callers that do not have a top-up amount available.
func genStripeLinkForLocale(referenceId string, customerId string, email string, payMoney float64, configuredUnitPrice float64, successURL string, cancelURL string, locale string) (stripeCheckoutResult, error) {
	return genStripeLinkForLocaleWithQuantity(referenceId, customerId, email, payMoney, configuredUnitPrice, successURL, cancelURL, 1, locale)
}

func genStripeLinkForLocaleWithQuantity(referenceId string, customerId string, email string, payMoney float64, configuredUnitPrice float64, successURL string, cancelURL string, quantity int64, locale string) (stripeCheckoutResult, error) {
	return genStripeLinkWithPaymentMethodTypesAndQuantity(
		referenceId,
		customerId,
		email,
		payMoney,
		configuredUnitPrice,
		successURL,
		cancelURL,
		quantity,
		stripeCheckoutPaymentMethodTypesForLocale(locale),
	)
}

func stripeCheckoutPaymentMethodTypesForLocale(locale string) []*string {
	if !isChinesePaymentLocale(locale) {
		return nil
	}
	return stripe.StringSlice([]string{"alipay"})
}

func isChinesePaymentLocale(locale string) bool {
	normalized := strings.ToLower(strings.TrimSpace(strings.ReplaceAll(locale, "_", "-")))
	switch normalized {
	case "zh", "zh-cn", "zhcn", "zh-hans", "zh-hans-cn",
		"zh-tw", "zhtw", "zh-hant", "zh-hant-tw", "zh-hk", "zh-mo":
		return true
	default:
		return false
	}
}

func genStripeLinkWithPaymentMethodTypes(referenceId string, customerId string, email string, payMoney float64, configuredUnitPrice float64, successURL string, cancelURL string, paymentMethodTypes []*string) (stripeCheckoutResult, error) {
	return genStripeLinkWithPaymentMethodTypesAndQuantity(referenceId, customerId, email, payMoney, configuredUnitPrice, successURL, cancelURL, 1, paymentMethodTypes)
}

func genStripeLinkWithPaymentMethodTypesAndQuantity(referenceId string, customerId string, email string, payMoney float64, configuredUnitPrice float64, successURL string, cancelURL string, quantity int64, paymentMethodTypes []*string) (stripeCheckoutResult, error) {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return stripeCheckoutResult{}, fmt.Errorf("无效的Stripe API密钥")
	}

	stripe.Key = setting.StripeApiSecret

	if configuredUnitPrice <= 0 {
		return stripeCheckoutResult{}, fmt.Errorf("StripeUnitPrice 必须大于 0")
	}

	configuredPrice, err := price.Get(setting.StripePriceId, nil)
	if err != nil {
		return stripeCheckoutResult{}, fmt.Errorf("获取 Stripe Price 失败: %w", err)
	}
	if !configuredPrice.Active {
		return stripeCheckoutResult{}, fmt.Errorf("Stripe Price 未启用")
	}
	if configuredPrice.Type != stripe.PriceTypeOneTime || configuredPrice.BillingScheme != stripe.PriceBillingSchemePerUnit {
		return stripeCheckoutResult{}, fmt.Errorf("Stripe Price 必须是一次性按单位计价")
	}
	if configuredPrice.CustomUnitAmount != nil || configuredPrice.TransformQuantity != nil {
		return stripeCheckoutResult{}, fmt.Errorf("Stripe Price 不支持自定义金额或数量转换")
	}
	if configuredPrice.Product == nil || configuredPrice.Product.ID == "" || configuredPrice.Currency == "" {
		return stripeCheckoutResult{}, fmt.Errorf("Stripe Price 缺少产品或币种信息")
	}

	priceUnitAmount := configuredPrice.UnitAmountDecimal
	if priceUnitAmount <= 0 {
		priceUnitAmount = float64(configuredPrice.UnitAmount)
	}
	unitAmount, expectedPayment, err := stripeCheckoutPaymentSnapshot(
		payMoney,
		priceUnitAmount,
		configuredUnitPrice,
		string(configuredPrice.Currency),
	)
	if err != nil {
		return stripeCheckoutResult{}, fmt.Errorf("Stripe 支付快照无效: %w", err)
	}
	lineItemUnitAmount, lineItemUnitAmountDecimal, err := stripeCheckoutLineItemAmount(unitAmount, quantity)
	if err != nil {
		return stripeCheckoutResult{}, fmt.Errorf("Stripe 商品数量无效: %w", err)
	}

	priceData := &stripe.CheckoutSessionLineItemPriceDataParams{
		Currency:   stripe.String(string(configuredPrice.Currency)),
		Product:    stripe.String(configuredPrice.Product.ID),
		UnitAmount: lineItemUnitAmount,
	}
	if lineItemUnitAmountDecimal != nil {
		priceData.UnitAmountDecimal = stripe.Float64(*lineItemUnitAmountDecimal)
	}
	if configuredPrice.TaxBehavior != "" {
		priceData.TaxBehavior = stripe.String(string(configuredPrice.TaxBehavior))
	}

	// Use custom URLs if provided, otherwise use defaults
	if successURL == "" {
		successURL = paymentReturnPath("/usage-logs")
	}
	if cancelURL == "" {
		cancelURL = paymentReturnPath("/wallet")
	}

	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceId),
		SuccessURL:        stripe.String(successURL),
		CancelURL:         stripe.String(cancelURL),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: priceData,
				Quantity:  stripe.Int64(quantity),
			},
		},
		Mode:                stripe.String(string(stripe.CheckoutSessionModePayment)),
		AllowPromotionCodes: stripe.Bool(setting.StripePromotionCodesEnabled),
	}
	if len(paymentMethodTypes) > 0 {
		params.PaymentMethodTypes = paymentMethodTypes
	}

	if "" == customerId {
		if "" != email {
			params.CustomerEmail = stripe.String(email)
		}

		params.CustomerCreation = stripe.String(string(stripe.CheckoutSessionCustomerCreationAlways))
	} else {
		params.Customer = stripe.String(customerId)
	}

	result, err := session.New(params)
	if err != nil {
		return stripeCheckoutResult{}, err
	}

	return stripeCheckoutResult{
		URL:               result.URL,
		PaymentAmount:     expectedPayment.PaidAmountForLog(),
		PaymentCurrency:   expectedPayment.Currency,
		ReferralUnitPrice: strconv.FormatFloat(configuredUnitPrice, 'f', -1, 64),
	}, nil
}

// stripeCheckoutLineItemAmount preserves the exact rounded Checkout total
// while exposing the requested credit count as the line-item quantity. Stripe
// accepts unit_amount_decimal in minor units, so non-divisible totals can be
// represented without changing the amount charged (for example, 286 cents ÷
// 20 credits = 14.3 cents per credit).
func stripeCheckoutLineItemAmount(minorAmount int64, quantity int64) (*int64, *float64, error) {
	if minorAmount < 1 {
		return nil, nil, errors.New("invalid Stripe line item amount")
	}
	if quantity < 1 {
		return nil, nil, errors.New("quantity must be positive")
	}
	if minorAmount%quantity == 0 {
		unitAmount := minorAmount / quantity
		return &unitAmount, nil, nil
	}
	unitAmountDecimal := float64(minorAmount) / float64(quantity)
	if math.IsNaN(unitAmountDecimal) || math.IsInf(unitAmountDecimal, 0) || unitAmountDecimal <= 0 {
		return nil, nil, errors.New("invalid Stripe decimal line item amount")
	}
	return nil, &unitAmountDecimal, nil
}

// stripeCheckoutPaymentSnapshot applies the same minor-unit rounding used by
// the Stripe line item and returns the corresponding major-unit audit value.
func stripeCheckoutPaymentSnapshot(payMoney float64, priceUnitAmount float64, configuredUnitPrice float64, currency string) (int64, model.VerifiedPayment, error) {
	if configuredUnitPrice <= 0 {
		return 0, model.VerifiedPayment{}, errors.New("configured Stripe unit price must be positive")
	}
	unitAmount := math.Round(payMoney * priceUnitAmount / configuredUnitPrice)
	if unitAmount < 1 || math.IsNaN(unitAmount) || math.IsInf(unitAmount, 0) || unitAmount >= float64(math.MaxInt64) {
		return 0, model.VerifiedPayment{}, errors.New("invalid Stripe payment amount")
	}
	payment, err := model.NewVerifiedMinorUnitPayment(int64(unitAmount), currency, "", "", false)
	if err != nil {
		return 0, model.VerifiedPayment{}, err
	}
	return int64(unitAmount), payment, nil
}

func GetChargedAmount(count float64, user model.User) float64 {
	topUpGroupRatio := common.GetTopupGroupRatio(user.Group)
	if topUpGroupRatio == 0 {
		topUpGroupRatio = 1
	}

	return count * topUpGroupRatio
}

func getStripeCreditedQuota(amount int64, group string) decimal.Decimal {
	topUpGroupRatio := common.GetTopupGroupRatio(group)
	if topUpGroupRatio == 0 {
		topUpGroupRatio = 1
	}
	return decimal.NewFromInt(amount).
		Mul(decimal.NewFromFloat(topUpGroupRatio)).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit))
}

func getStripePayMoney(amount float64, group string) float64 {
	return getStripePayMoneyAtUnitPrice(amount, group, setting.StripeUnitPrice)
}

func getStripePayMoneyAtUnitPrice(amount float64, group string, unitPrice float64) float64 {
	originalAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	// Using float64 for monetary calculations is acceptable here due to the small amounts involved
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	// apply optional preset discount by the original request amount (if configured), default 1.0
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	payMoney := amount * unitPrice * topupGroupRatio * discount
	return payMoney
}

func getStripeMinTopup() int64 {
	minTopup := setting.StripeMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}
