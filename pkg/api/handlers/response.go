// Package handlers contains HTTP handlers for AI SDK tool execution endpoints.
package handlers

import (
	"encoding/json"
	"net/http"
)

// Error codes for standardized error responses
const (
	ErrCodeValidation    = "VALIDATION_ERROR"
	ErrCodeNotFound      = "NOT_FOUND"
	ErrCodeUnauthorized  = "UNAUTHORIZED"
	ErrCodeDatabase      = "DATABASE_ERROR"
	ErrCodeExternalAPI   = "EXTERNAL_API_ERROR"
	ErrCodeInternal      = "INTERNAL_ERROR"
)

// ErrorResponse represents a standardized error response format
type ErrorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}

// writeError writes a standardized error response to the HTTP response writer
func writeError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	
	response := ErrorResponse{
		Success: false,
		Message: message,
		Code:    code,
	}
	
	json.NewEncoder(w).Encode(response)
}

// writeJSON writes a successful JSON response
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// Common error response helpers

// writeBadRequest writes a 400 Bad Request error
func writeBadRequest(w http.ResponseWriter, message string) {
	writeError(w, http.StatusBadRequest, ErrCodeValidation, message)
}

// writeNotFound writes a 404 Not Found error
func writeNotFound(w http.ResponseWriter, message string) {
	writeError(w, http.StatusNotFound, ErrCodeNotFound, message)
}

// writeUnauthorized writes a 401 Unauthorized error
func writeUnauthorized(w http.ResponseWriter, message string) {
	writeError(w, http.StatusUnauthorized, ErrCodeUnauthorized, message)
}

// writeInternalError writes a 500 Internal Server Error
func writeInternalError(w http.ResponseWriter, message string) {
	writeError(w, http.StatusInternalServerError, ErrCodeInternal, message)
}

// writeExternalAPIError writes a 502 Bad Gateway error for external API failures
func writeExternalAPIError(w http.ResponseWriter, message string) {
	writeError(w, http.StatusBadGateway, ErrCodeExternalAPI, message)
}

