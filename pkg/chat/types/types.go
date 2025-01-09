package types

type Chat struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"-"`
	Prompt      string `json:"prompt"`
	Response    string `json:"response"`
	IsComplete  bool   `json:"is_complete"`
	IsApplied   bool   `json:"is_applied"`
	IsApplying  bool   `json:"is_applying"`
}
