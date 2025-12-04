// Package api provides HTTP server functionality for AI SDK tool execution.
package api

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

// WriteError writes a standardized error response to the HTTP response writer
func WriteError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	
	response := ErrorResponse{
		Success: false,
		Message: message,
		Code:    code,
	}
	
	json.NewEncoder(w).Encode(response)
}

// WriteJSON writes a successful JSON response
func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// Common error response helpers

// WriteBadRequest writes a 400 Bad Request error
func WriteBadRequest(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusBadRequest, ErrCodeValidation, message)
}

// WriteNotFound writes a 404 Not Found error
func WriteNotFound(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusNotFound, ErrCodeNotFound, message)
}

// WriteUnauthorized writes a 401 Unauthorized error
func WriteUnauthorized(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusUnauthorized, ErrCodeUnauthorized, message)
}

// WriteInternalError writes a 500 Internal Server Error
func WriteInternalError(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusInternalServerError, ErrCodeInternal, message)
}

// WriteExternalAPIError writes a 502 Bad Gateway error for external API failures
func WriteExternalAPIError(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusBadGateway, ErrCodeExternalAPI, message)
}

