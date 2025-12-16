import { Parser, createParser } from '../parser';
import { ActionPlan, Artifact } from '../types';

describe('Parser', () => {
  describe('parsePlan', () => {
    it('parses wordpress plan', () => {
      const input = `<chartsmithArtifactPlan id="wordpress-chart-implementation" title="WordPress Helm Chart Implementation Plan">

<chartsmithActionPlan type="file" action="update" path="Chart.yaml">
- Update chart metadata for WordPress
- Add MariaDB dependency
- Set appropriate versions
</chartsmithActionPlan>

<chartsmithActionPlan type="file" action="create" path="templates/wordpress-deployment.yaml">
- Create WordPress deployment template
- Include security contexts
- Add volume mounts
- Configure health checks
</chartsmithActionPlan>`;

      const parser = createParser();
      parser.parsePlan(input);
      const result = parser.getResult();

      expect(result.title).toBe('WordPress Helm Chart Implementation Plan');
      expect(Object.keys(result.actions)).toHaveLength(2);

      expect(result.actions['Chart.yaml']).toEqual({
        type: 'file',
        action: 'update',
      });

      expect(result.actions['templates/wordpress-deployment.yaml']).toEqual({
        type: 'file',
        action: 'create',
      });
    });

    it('strips leading slashes from paths', () => {
      const input = `<chartsmithArtifactPlan title="Test Plan">
<chartsmithActionPlan type="file" action="create" path="/templates/test.yaml">
</chartsmithActionPlan>`;

      const parser = createParser();
      parser.parsePlan(input);
      const result = parser.getResult();

      expect(result.actions['templates/test.yaml']).toBeDefined();
      expect(result.actions['/templates/test.yaml']).toBeUndefined();
    });
  });

  describe('parseArtifacts', () => {
    it('parses complete Chart.yaml', () => {
      const input = `<chartsmithArtifact path="Chart.yaml">
apiVersion: v2
name: wordpress
description: A Helm chart for WordPress
version: 1.0.0
</chartsmithArtifact>`;

      const parser = createParser();
      parser.parseArtifacts(input);
      const result = parser.getResult();

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].path).toBe('Chart.yaml');
      expect(result.artifacts[0].content.trim()).toBe(
        'apiVersion: v2\nname: wordpress\ndescription: A Helm chart for WordPress\nversion: 1.0.0'
      );
    });

    it('parses partial artifact', () => {
      const input = `<chartsmithArtifact path="Chart.yaml">
apiVersion: v2
name: wordpress
description: A Helm chart`;

      const parser = createParser();
      parser.parseArtifacts(input);
      const result = parser.getResult();

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].path).toBe('Chart.yaml');
      expect(result.artifacts[0].content.trim()).toContain('apiVersion: v2');
      expect(result.artifacts[0].content.trim()).toContain('name: wordpress');
    });

    it('handles multiple artifacts with partial', () => {
      const input = `<chartsmithArtifact path="Chart.yaml">
apiVersion: v2
name: chart1
</chartsmithArtifact>
<chartsmithArtifact path="values.yaml">
apiVersion: v2
name: chart2`;

      const parser = createParser();
      parser.parseArtifacts(input);
      const result = parser.getResult();

      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts[0].path).toBe('Chart.yaml');
      expect(result.artifacts[0].content.trim()).toContain('name: chart1');
      expect(result.artifacts[1].path).toBe('values.yaml');
      expect(result.artifacts[1].content.trim()).toContain('name: chart2');
    });

    it('handles streaming chunks', () => {
      const input = `<chartsmithArtifact path="Chart.yaml">
apiVersion: v2
name: wordpr`;

      const parser = createParser();
      parser.parseArtifacts(input);
      const result = parser.getResult();

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].path).toBe('Chart.yaml');
      expect(result.artifacts[0].content.trim()).toContain('name: wordpr');
    });

    it('ignores artifacts without content', () => {
      const input = `<chartsmithArtifact path="empty.yaml">
</chartsmithArtifact>`;

      const parser = createParser();
      parser.parseArtifacts(input);
      const result = parser.getResult();

      // Empty content should not be added
      expect(result.artifacts).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('clears all parser state', () => {
      const parser = createParser();

      parser.parsePlan('<chartsmithArtifactPlan title="Test">');
      parser.parseArtifacts('<chartsmithArtifact path="test.yaml">content</chartsmithArtifact>');

      expect(parser.getResult().title).toBe('Test');
      expect(parser.getResult().artifacts).toHaveLength(1);

      parser.reset();

      expect(parser.getResult().title).toBe('');
      expect(parser.getResult().artifacts).toHaveLength(0);
      expect(Object.keys(parser.getResult().actions)).toHaveLength(0);
    });
  });
});
