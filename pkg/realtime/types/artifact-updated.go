package types

var _ Event = ArtifactUpdatedEvent{}

type Artifact struct {
	RevisionNumber int    `json:"revisionNumber"`
	Path           string `json:"path"`
	Content        string `json:"content"`
}

type ArtifactUpdatedEvent struct {
	WorkspaceID string   `json:"workspaceId"`
	Artifact    Artifact `json:"artifact"`
}

func (e ArtifactUpdatedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId": e.WorkspaceID,
		"artifact":    e.Artifact,
	}, nil
}

func (e ArtifactUpdatedEvent) GetChannelName() string {
	return e.WorkspaceID
}

// Add new event type for file deletion
type ArtifactDeletedEvent struct {
	WorkspaceID string   `json:"workspaceId"`
	Artifact    Artifact `json:"artifact"`
}

func (e ArtifactDeletedEvent) GetMessageData() (map[string]interface{}, error) {
	return map[string]interface{}{
		"workspaceId": e.WorkspaceID,
		"artifact":    e.Artifact,
	}, nil
}

func (e ArtifactDeletedEvent) GetChannelName() string {
	return e.WorkspaceID
}

var _ Event = ArtifactDeletedEvent{}
