package types

import (
	"time"
)

type File struct {
	ID             string   `json:"id"`
	RevisionNumber int      `json:"revision_number"`
	ChartID        string   `json:"chart_id,omitempty"`
	WorkspaceID    string   `json:"workspace_id"`
	FilePath       string   `json:"filePath"`
	Content        string   `json:"content"`
	PendingPatches []string `json:"pending_patches"`
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
	IsRendered      bool      `json:"isRendered"`
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
	ProceedAt      *time.Time   `json:"proceedAt"`
}

type ActionFile struct {
	Action string `json:"action"`
	Path   string `json:"path"`
	Status string `json:"status"`
}

type Chat struct {
	ID                               string           `json:"id"`
	WorkspaceID                      string           `json:"-"`
	Prompt                           string           `json:"prompt"`
	Response                         string           `json:"response"`
	CreatedAt                        time.Time        `json:"createdAt"`
	IsIntentComplete                 bool             `json:"isIntentComplete"`
	Intent                           *Intent          `json:"0"`
	FollowupActions                  []FollowupAction `json:"followupActions"`
	ResponseRenderID                 string           `json:"responseRenderId"`
	ResponsePlanID                   string           `json:"responsePlanId"`
	ResponseConversionID             string           `json:"responseConversionId"`
	ResponseRollbackToRevisionNumber *int             `json:"responseRollbackToRevisionNumber"`
	RevisionNumber                   int              `json:"revisionNumber"`
}

type FollowupAction struct {
	Action string `json:"action"`
	Label  string `json:"label"`
}

type Intent struct {
	IsOffTopic       bool `json:"isOffTopic"`
	IsPlan           bool `json:"isPlan"`
	IsConversational bool `json:"isConversational"`
	IsChartDeveloper bool `json:"isChartDeveloper"`
	IsChartOperator  bool `json:"isChartOperator"`
	IsProceed        bool `json:"isProceed"`
	IsRender         bool `json:"isRender"`
}

type Rendered struct {
	ID             string     `json:"id"`
	WorkspaceID    string     `json:"-"`
	RevisionNumber int        `json:"-"`
	CreatedAt      time.Time  `json:"createdAt"`
	CompletedAt    *time.Time `json:"completedAt"`

	Charts []RenderedChart `json:"charts"`
}

type RenderedChart struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"-"`
	ChartID     string `json:"-"`
	Name        string `json:"name"`

	IsSuccess bool `json:"isSuccess"`

	DepupdateCommand string `json:"depupdateCommand,omitempty"`
	DepupdateStdout  string `json:"depupdateStdout,omitempty"`
	DepupdateStderr  string `json:"depupdateStderr,omitempty"`

	HelmTemplateCommand string `json:"helmTemplateCommand,omitempty"`
	HelmTemplateStdout  string `json:"helmTemplateStdout,omitempty"`
	HelmTemplateStderr  string `json:"helmTemplateStderr,omitempty"`

	CreatedAt   time.Time  `json:"createdAt"`
	CompletedAt *time.Time `json:"completedAt"`
}

type RenderedFile struct {
	ID              string `json:"id"`
	RevisionNumber  int    `json:"revision_number"`
	ChartID         string `json:"chart_id,omitempty"`
	WorkspaceID     string `json:"workspace_id"`
	FilePath        string `json:"filePath"`
	RenderedContent string `json:"renderedContent"`
}

type ConversionStatus string

const (
	ConversionStatusPending     ConversionStatus = "pending"
	ConversionStatusAnalyzing   ConversionStatus = "analyzing"
	ConversionStatusSorting     ConversionStatus = "sorting"
	ConversionStatusTemplating  ConversionStatus = "templating"
	ConversionStatusNormalizing ConversionStatus = "normalizing"
	ConversionStatusSimplifying ConversionStatus = "simplifying"
	ConversionStatusFinalizing  ConversionStatus = "finalizing"
	ConversionStatusComplete    ConversionStatus = "complete"
)

type Conversion struct {
	ID             string           `json:"id"`
	WorkspaceID    string           `json:"workspaceId"`
	ChatMessageIDs []string         `json:"chatMessageIds"`
	CreatedAt      time.Time        `json:"createdAt"`
	Status         ConversionStatus `json:"status"`
	ChartYAML      string           `json:"chartYAML"`
	ValuesYAML     string           `json:"valuesYAML"`
}

type ConversionFileStatus string

const (
	ConversionFileStatusPending     ConversionFileStatus = "pending"
	ConversionFileStatusConverting  ConversionFileStatus = "converting"
	ConversionFileStatusConverted   ConversionFileStatus = "converted"
	ConversionFileStatusSimplifying ConversionFileStatus = "simplifying"
	ConversionFileStatusCompleted   ConversionFileStatus = "completed"
)

type ConversionFile struct {
	ID             string               `json:"id"`
	ConversionID   string               `json:"conversionId"`
	FilePath       string               `json:"filePath"`
	FileContent    string               `json:"content"`
	FileStatus     ConversionFileStatus `json:"status"`
	ConvertedFiles map[string]string    `json:"convertedFiles"`
}
