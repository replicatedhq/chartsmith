import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chartService } from '../services/chart';
import type { NewChartResponse } from '../services/chart/types';
import { convertFilesToTree } from '../utils/files/convert';

interface ChartCreationState {
  isLoading: boolean;
  error: string | null;
}

export function useChartCreation() {
  const navigate = useNavigate();
  const [state, setState] = useState<ChartCreationState>({
    isLoading: false,
    error: null,
  });

  const handleSuccess = (result: NewChartResponse) => {
    // Convert flat files object to tree structure
    const fileTree = convertFilesToTree(result.files);
    
    // Store chart data and navigate to editor
    sessionStorage.setItem('chartFiles', JSON.stringify(fileTree));
    navigate('/editor');
  };

  const createFromPrompt = async (prompt: string) => {
    setState({ isLoading: true, error: null });
    try {
      const result = await chartService.createFromPrompt(prompt);
      handleSuccess(result);
    } catch (error) {
      setState({ isLoading: false, error: (error as Error).message });
    }
  };

  const createFromUpload = async (file: File) => {
    setState({ isLoading: true, error: null });
    try {
      const result = await chartService.createFromUpload(file);
      handleSuccess(result);
    } catch (error) {
      setState({ isLoading: false, error: (error as Error).message });
    }
  };

  const createFromReplicated = async (appId: string, chartId: string) => {
    setState({ isLoading: true, error: null });
    try {
      const result = await chartService.createFromReplicated(appId, chartId);
      handleSuccess(result);
    } catch (error) {
      setState({ isLoading: false, error: (error as Error).message });
    }
  };

  return {
    ...state,
    createFromPrompt,
    createFromUpload,
    createFromReplicated,
  };
}