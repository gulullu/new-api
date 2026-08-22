package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// IPBlocklist is installed at the engine level so a blocked source cannot use
// the website, API, relay endpoints, or admin routes. Payment callback
// handlers and their signature checks are unchanged; only the source-IP gate
// runs before routing.
func IPBlocklist() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Payment providers call these endpoints server-to-server. Keep their
		// existing signature verification and idempotency path reachable even if
		// an operator later blocks a provider's source address; an invalid
		// callback is still rejected by the handler itself.
		isPaymentCallback := strings.HasPrefix(c.Request.URL.Path, "/api/stripe/webhook") ||
			strings.HasPrefix(c.Request.URL.Path, "/api/creem/webhook") ||
			strings.HasPrefix(c.Request.URL.Path, "/api/waffo/webhook") ||
			strings.HasPrefix(c.Request.URL.Path, "/api/waffo-pancake/webhook") ||
			strings.HasPrefix(c.Request.URL.Path, "/api/user/epay/notify")
		if !isPaymentCallback && common.IsIPBlocked(c.ClientIP()) {
			c.Header("Cache-Control", "no-store")
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "request blocked",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
