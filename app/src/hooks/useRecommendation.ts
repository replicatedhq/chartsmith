import { useState, useEffect } from 'react';

interface Recommendation {
  id: number;
  title: string;
  description: string;
  files: string[];
  importance: 'high' | 'medium' | 'low';
  type: 'warning' | 'error' | 'info';
}

const mockRecommendations: Record<string, Recommendation> = {
  '1': {
    id: 1,
    title: 'Resource Limits Not Set',
    description: 'Your deployment.yaml is missing resource limits. This is important for proper resource management.',
    files: ['templates/deployment.yaml'],
    importance: 'high',
    type: 'warning',
  },
  // Add more mock recommendations as needed
};

const mockExplanations: Record<string, string> = {
  '1': `Resource limits are crucial for maintaining the stability and reliability of your Kubernetes cluster. They help prevent resource contention and ensure fair resource allocation among pods.

Here's why this is important:

1. **Prevent Resource Hogging**: Without limits, a single pod could potentially consume all available resources on a node.
2. **Better Scheduling**: The Kubernetes scheduler can make better decisions when resource requirements are clearly defined.
3. **Cost Management**: Resource limits help with capacity planning and cost optimization.

To fix this, you should add both resource requests and limits to your deployment:

\`\`\`yaml
resources:
  limits:
    cpu: "1"
    memory: "1Gi"
  requests:
    cpu: "500m"
    memory: "512Mi"
\`\`\`
`,
  // Add more explanations as needed
};

export function useRecommendation(id?: string) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      // Simulate API call
      setRecommendation(mockRecommendations[id] || null);
      setExplanation(mockExplanations[id] || null);
    }
  }, [id]);

  return { recommendation, explanation };
}