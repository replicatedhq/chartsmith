package types

import "time"

type File struct {
	ID             string `json:"id"`
	RevisionNumber int    `json:"revision_number"`
	ChartID        string `json:"chart_id,omitempty"`
	WorkspaceID    string `json:"workspace_id"`
	FilePath       string `json:"filePath"`
	Content        string `json:"content"`
	Summary        string `json:"-"`
}

type Chart struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Files []File `json:"files"`
}

type Workspace struct {
	ID            string    `json:"id"`
	CreatedAt     time.Time `json:"created_at"`
	LastUpdatedAt time.Time `json:"last_updated_at"`
	Name          string    `json:"name"`

	CurrentRevision          int  `json:"current_revision"`
	IncompleteRevisionNumber *int `json:"incomplete_revision_number,omitempty"`

	Charts []Chart `json:"charts"`
	Files  []File  `json:"files"`

	CurrentPlans  []Plan `json:"current_plans"`
	PreviousPlans []Plan `json:"previous_plans"`
}

type Revision struct {
	WorkspaceID     string
	RevisionNumber  int
	CreatedAt       time.Time
	CreatedByUserID string
	CreatedType     string
	IsComplete      bool
}

type PlanStatus string

const (
	PlanStatusPending  PlanStatus = "pending"
	PlanStatusPlanning PlanStatus = "planning"
	PlanStatusReview   PlanStatus = "review"
	PlanStatusSuccess  PlanStatus = "success"
	PlanStatusError    PlanStatus = "error"
)

type Plan struct {
	ID             string     `json:"id"`
	WorkspaceID    string     `json:"workspaceId"`
	ChatMessageIDs []string   `json:"chatMessageIds"`
	Description    string     `json:"description"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"-"`
	Version        int        `json:"version"`
	Status         PlanStatus `json:"status"`
}
