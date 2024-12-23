import { FileNode, ValuesScenario } from '../../types/files';

export interface HelmService {
  renderTemplate(files: FileNode[], scenario?: ValuesScenario): Promise<FileNode[]>;
  validateChart(files: FileNode[]): Promise<ValidationResult[]>;
  getChartMetadata(files: FileNode[]): Promise<ChartMetadata>;
}

export interface ValidationResult {
  path: string;
  line: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ChartMetadata {
  name: string;
  version: string;
  description: string;
  maintainers: string[];
}