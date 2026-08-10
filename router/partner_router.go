package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func registerPartnerRoutes(apiRouter *gin.RouterGroup) {
	partnerRoute := apiRouter.Group("/partner")
	partnerRoute.Use(middleware.UserAuth(), middleware.DisableCache())
	{
		partnerRoute.GET("/summary", controller.GetPartnerWalletSummary)
		partnerRoute.GET("/commissions", controller.GetPartnerCommissions)
		partnerRoute.GET("/withdrawals", controller.GetPartnerWithdrawals)
		partnerRoute.POST("/transfer", middleware.UserCriticalRateLimit("partner-transfer"), controller.TransferPartnerCommission)
		partnerRoute.POST("/withdrawals", middleware.UserCriticalRateLimit("partner-withdrawal"), controller.CreatePartnerWithdrawal)
	}

	adminRoute := apiRouter.Group("/partner/admin")
	adminRoute.Use(middleware.AdminAuth(), middleware.DisableCache())
	{
		adminRoute.GET("/profiles", controller.AdminListPartnerProfiles)
		adminRoute.POST("/profiles", middleware.CriticalRateLimit(), controller.AdminConfigurePartner)
		adminRoute.GET("/withdrawals", controller.AdminListPartnerWithdrawals)
		adminRoute.POST("/withdrawals/:id/reveal", middleware.CriticalRateLimit(), controller.AdminRevealPartnerWithdrawal)
		adminRoute.POST("/withdrawals/:id/paid", middleware.CriticalRateLimit(), controller.AdminMarkPartnerWithdrawalPaid)
		adminRoute.POST("/withdrawals/:id/reject", middleware.CriticalRateLimit(), controller.AdminRejectPartnerWithdrawal)
	}
}
