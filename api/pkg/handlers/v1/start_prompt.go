package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/replicatedhq/chartsmith/api/pkg/prompt"
)

type StartPromptRequest struct {
	Prompt string `json:"prompt"`
}

type StartPromptResponse struct {
	Files map[string]string `json:"files"`
}

func StartPromptHandler(c *gin.Context) {
	request := StartPromptRequest{}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	files, err := prompt.CreateHelmChart(c.Request.Context(), request.Prompt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, StartPromptResponse{Files: files})
}
