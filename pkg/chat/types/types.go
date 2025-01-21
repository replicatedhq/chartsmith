package types

type Chat struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"-"`
	Prompt      string `json:"prompt"`
	Response    string `json:"response"`
	IsComplete  bool   `json:"is_complete"`
	PlanID      string `json:"plan_id"`
}
