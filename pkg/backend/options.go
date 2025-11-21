package backend

// Options represents backend processing options that can be passed to LLM functions
type Options struct {
	UseSecureBuildImages bool `json:"useSecureBuildImages,omitempty"`
}