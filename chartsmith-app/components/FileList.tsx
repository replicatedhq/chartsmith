import React, { useRef, useEffect, useMemo } from 'react';
import { FileSearch, FileCheck, Loader2, ArrowRight } from 'lucide-react';
import { ConversionFile, ConversionFileStatus } from '@/lib/types/workspace';

type FileListProps = {
  files: ConversionFile[];
  currentFileIndex: number;
  isTemplateStep?: boolean;
};

function truncateMiddle(str: string, maxLength: number) {
  if (str.length <= maxLength) return str;
  const start = Math.ceil(maxLength / 2);
  const end = Math.floor(maxLength / 2);
  return str.slice(0, start) + '...' + str.slice(-end);
}

export function FileList({ files, currentFileIndex, isTemplateStep = false }: FileListProps) {
  const activeFileRef = useRef<HTMLDivElement>(null);
  
  // Create a memoized status string to use in the dependency array
  const fileStatusString = useMemo(() => files.map(f => f.status).join(','), [files]);

  useEffect(() => {
    if (activeFileRef.current) {
      activeFileRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [fileStatusString]);

  const getVisibleFiles = () => {
    const windowSize = 30;

    // Find the index of the converting file
    const convertingIndex = files.findIndex(f => f.status === 'converting');
    if (convertingIndex === -1) return files.slice(0, windowSize);

    // Calculate start index to center the converting file
    let start = Math.max(0, convertingIndex - 1);
    // Adjust start if we're too close to the end
    if (start + windowSize > files.length) {
      start = Math.max(0, files.length - windowSize);
    }

    return files.slice(start, start + windowSize);
  };

  const getFileIcon = (status: ConversionFileStatus) => {
    switch (status) {
      case 'converting':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />;
      case 'converted':
      case 'completed':
        return <FileCheck className="w-4 h-4 text-green-400 flex-shrink-0" />;
      case 'pending':
      default:
        return <FileSearch className="w-4 h-4 text-gray-400 flex-shrink-0" />;
    }
  };

  return (
    <div className="pl-8">
      <div className="text-sm text-gray-400 mb-2">
        {isTemplateStep ? (
          `Converting file ${currentFileIndex + 1} of ${files.length}`
        ) : (
          `Optimizing template ${currentFileIndex + 1} of ${files.length}`
        )}
      </div>
      <div className="space-y-2">
        {getVisibleFiles().map((file, index) => {
          const isActive = file.status === 'converting';

          return (
            <div
              key={file.id}
              ref={isActive ? activeFileRef : null}
              className={`py-2 px-4 rounded transition-all duration-200 ${
                file.status === 'converting'
                  ? 'bg-gray-600/50'
                  : file.status === 'converted' || file.status === 'completed'
                  ? 'opacity-60'
                  : 'opacity-40'
              }`}
            >
              <div className="flex items-center gap-3 text-sm min-w-0">
                <div className="w-4 flex-shrink-0">
                  {getFileIcon(file.status)}
                </div>
                <span className="text-gray-300 truncate w-[300px]">
                  {truncateMiddle(file.filePath, 40)}
                </span>
                {isTemplateStep && (
                  <>
                    <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-400 truncate w-[200px]">
                      {'templates/' + truncateMiddle(file.filePath.split('/').pop() || '', 30)}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
