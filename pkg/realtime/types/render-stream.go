package types

type RenderStreamEvent struct {
	WorkspaceID         string `json:"workspaceId"`
	RenderID            string `json:"renderId"`
	RenderChartID       string `json:"renderChartId"`
	DepUpdateCommand    string `json:"depUpdateCommand,omitempty"`
	DepUpdateStdout     string `json:"depUpdateStdout,omitempty"`
	DepUpdateStderr     string `json:"depUpdateStderr,omitempty"`
	HelmTemplateCommand string `json:"helmTemplateCommand,omitempty"`
	HelmTemplateStdout  string `json:"helmTemplateStdout,omitempty"`
	HelmTemplateStderr  string `json:"helmTemplateStderr,omitempty"`
}

func (e RenderStreamEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId":         e.WorkspaceID,
		"eventType":           "render-stream",
		"renderId":            e.RenderID,
		"renderChartId":       e.RenderChartID,
		"depUpdateCommand":    e.DepUpdateCommand,
		"depUpdateStdout":     e.DepUpdateStdout,
		"depUpdateStderr":     e.DepUpdateStderr,
		"helmTemplateCommand": e.HelmTemplateCommand,
		"helmTemplateStdout":  e.HelmTemplateStdout,
		"helmTemplateStderr":  e.HelmTemplateStderr,
	}, nil
}

func (e RenderStreamEvent) GetChannelName() string {
	return e.WorkspaceID
}
