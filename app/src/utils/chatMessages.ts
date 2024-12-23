import { Message } from '../components/editor/types';

export function getInitialMessage(): Message | null {
  // Check for chart prompt
  const chartPrompt = sessionStorage.getItem('chartPrompt');
  if (chartPrompt) {
    sessionStorage.removeItem('chartPrompt');
    return {
      role: 'user',
      content: `Please help me create a Helm chart for the following application:\n\n${chartPrompt}`
    };
  }

  // Check for uploaded file
  const uploadedFile = sessionStorage.getItem('uploadedFile');
  if (uploadedFile) {
    sessionStorage.removeItem('uploadedFile');
    return {
      role: 'user',
      content: `I've uploaded a Helm chart named "${uploadedFile}". Please analyze it and help me improve it.`
    };
  }

  // Check for Replicated chart
  const replicatedChart = sessionStorage.getItem('replicatedChart');
  if (replicatedChart) {
    const chartData = JSON.parse(replicatedChart);
    sessionStorage.removeItem('replicatedChart');
    return {
      role: 'user',
      content: `I've imported the "${chartData.name}" chart from my Replicated app "${chartData.appName}". Please help me understand and modify this chart.`
    };
  }

  return null;
}