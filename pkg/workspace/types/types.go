package types

import (
	"time"
)

type File struct {
	ID             string `json:"id"`
	RevisionNumber int    `json:"revision_number"`
	ChartID        string `json:"chart_id,omitempty"`
	WorkspaceID    string `json:"workspace_id"`
	FilePath       string `json:"filePath"`
	Content        string `json:"content"`
}

type Chart struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Files []File `json:"files"`
}

type BootstrapWorkspace struct {
	ID              string `json:"-"`
	Name            string `json:"-"`
	CurrentRevision int    `json:"-"`

	Charts []Chart `json:"-"`
	Files  []File  `json:"-"`
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
	WorkspaceID     string    `json:"workspaceId"`
	RevisionNumber  int       `json:"revisionNumber"`
	CreatedAt       time.Time `json:"-"`
	CreatedByUserID string    `json:"-"`
	CreatedType     string    `json:"-"`
	IsComplete      bool      `json:"isComplete"`
}

type PlanStatus string

const (
	PlanStatusPending  PlanStatus = "pending"
	PlanStatusPlanning PlanStatus = "planning"
	PlanStatusReview   PlanStatus = "review"
	PlanStatusApplying PlanStatus = "applying"
	PlanStatusApplied  PlanStatus = "applied"
)

type Plan struct {
	ID             string       `json:"id"`
	WorkspaceID    string       `json:"workspaceId"`
	ChatMessageIDs []string     `json:"chatMessageIds"`
	Description    string       `json:"description"`
	CreatedAt      time.Time    `json:"createdAt"`
	UpdatedAt      time.Time    `json:"-"`
	Version        int          `json:"version"`
	Status         PlanStatus   `json:"status"`
	ActionFiles    []ActionFile `json:"actionFiles"`
	IsComplete     bool         `json:"-"`
}

type ActionFile struct {
	Action string `json:"action"`
	Path   string `json:"path"`
	Status string `json:"status"`
}

type Chat struct {
	ID               string    `json:"id"`
	WorkspaceID      string    `json:"-"`
	Prompt           string    `json:"prompt"`
	Response         string    `json:"response"`
	CreatedAt        time.Time `json:"createdAt"`
	IsIntentComplete bool      `json:"isIntentComplete"`
	Intent           *Intent   `json:"intent"`
}

type Intent struct {
	IsOffTopic       bool `json:"isOffTopic"`
	IsPlan           bool `json:"isPlan"`
	IsConversational bool `json:"isConversational"`
	IsChartDeveloper bool `json:"isChartDeveloper"`
	IsChartOperator  bool `json:"isChartOperator"`
	IsProceed        bool `json:"isProceed"`
}
