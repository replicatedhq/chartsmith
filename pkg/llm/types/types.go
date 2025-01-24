package types

type ActionPlanWithPath struct {
	Path       string `json:"path"`
	ActionPlan `json:",inline"`
}

type ActionPlanStatus string

const (
	ActionPlanStatusPending  ActionPlanStatus = "pending"
	ActionPlanStatusCreating ActionPlanStatus = "creating"
	ActionPlanStatusCreated  ActionPlanStatus = "created"
)

type ActionPlan struct {
	Type   string           `json:"type"`
	Action string           `json:"action"`
	Status ActionPlanStatus `json:"status"`
}

type HelmFile struct {
	Path           string
	Content        string
	PartialContent string
}
