package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// IPBlocklist is installed at the engine level so a blocked source cannot use
// the website, API, relay endpoints, or admin routes. Payment callback
// handlers and their signature checks are unchanged; only the source-IP gate
// runs before routing.
func IPBlocklist() gin.HandlerFunc {
	return func(c *gin.Context) {
		if common.IsIPBlocked(c.ClientIP()) {
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
