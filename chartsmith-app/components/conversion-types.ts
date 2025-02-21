export interface ConversionStep {
  id: number;
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'complete';
}

export interface FileConversion {
  id: string;
  sourceFile: string;
  templateFile: string;
  status: 'pending' | 'processing' | 'complete';
}
