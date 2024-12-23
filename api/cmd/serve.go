package cmd

import (
	"fmt"

	"github.com/gin-gonic/gin"
	v1 "github.com/replicatedhq/chartsmith/api/pkg/handlers/v1"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func init() {
	rootCmd.AddCommand(serveCmd)

	serveCmd.Flags().Int("port", 8080, "Port to run the server on")
	viper.BindPFlag("port", serveCmd.Flags().Lookup("port"))
}

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the API server",
	RunE: func(cmd *cobra.Command, args []string) error {
		return runServer()
	},
}

func runServer() error {
	r := gin.Default()

	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		c.Writer.Header().Set("Access-Control-Allow-Origin", origin)      // Use specific origin instead of *
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true") // Add this line
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Length, Content-Type, content-type, Authorization, Accept, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Max-Age", "43200")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// API v1 routes
	v1Group := r.Group("/v1")
	{
		v1Group.POST("/new/prompt", v1.StartPromptHandler)
	}

	port := viper.GetInt("port")
	return r.Run(fmt.Sprintf(":%d", port))
}
