import { useTheme } from "@/contexts/ThemeContext";
import { RenderedChart } from "@/lib/types/workspace";

interface TerminalProps {
  chart: RenderedChart;
  depUpdateCommandStreamed?: string;
  depUpdateStderrStreamed?: string;
  depUpdateStdoutStreamed?: string;
  helmTemplateCommandStreamed?: string;
  helmTemplateStderrStreamed?: string;
  'data-testid'?: string;
  isCollapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
}

export function Terminal({
  chart,
  depUpdateCommandStreamed,
  depUpdateStderrStreamed,
  depUpdateStdoutStreamed,
  helmTemplateCommandStreamed,
  helmTemplateStderrStreamed,
  isCollapsed,
  onCollapse,
  onExpand,
  'data-testid': testId
}: TerminalProps) {
  const { theme } = useTheme();

  const depUpdateCommandToShow = depUpdateCommandStreamed || chart.depUpdateCommand;
  const depUpdateStderrToShow = depUpdateStderrStreamed || chart.depUpdateStderr;
  const depUpdateStdoutToShow = depUpdateStdoutStreamed || chart.depUpdateStdout;
  const helmTemplateCommandToShow = helmTemplateCommandStreamed || chart.helmTemplateCommand;
  const helmTemplateStderrToShow = helmTemplateStderrStreamed || chart.helmTemplateStderr;

  return (
    <div
      data-testid={testId}
      className={`mt-2 rounded-md overflow-hidden font-mono ${theme === "dark" ? "bg-[#1e1e1e]" : "bg-[#282a36]"}`}
    >
      <div className={`flex items-center px-3 py-1.5 ${theme === "dark" ? "bg-[#323232]" : "bg-[#44475a]"}`}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
          <button
            onClick={onCollapse}
            className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] hover:opacity-80 transition-opacity"
          />
          <button
            onClick={onExpand}
            className="w-2.5 h-2.5 rounded-full bg-[#27c93f] hover:opacity-80 transition-opacity"
          />
        </div>
        <div className={`flex-1 text-center text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-300"}`}>
          {chart.chartName}
        </div>
      </div>
      {isCollapsed ? (
        <div className={`px-3 py-2 text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
          Terminal output hidden. Click the green button to expand.
        </div>
      ) : (
        <div className={`p-3 text-[11px] ${theme === "dark" ? "text-gray-300" : "text-gray-100"}`}>
          {!depUpdateCommandToShow && !helmTemplateCommandToShow ? (
            <div className="mt-1 flex items-center">
              <span className="w-2 h-4 bg-gray-300 animate-pulse"></span>
            </div>
          ) : (
            <>
              {depUpdateCommandToShow && (
                <div className="flex gap-2">
                  <span className="flex-shrink-0 text-primary/70">% </span>
                  <span className="text-primary/70">{depUpdateCommandToShow}</span>
                </div>
              )}
              {depUpdateStderrToShow ? (
                <div className="mt-2 text-red-400 whitespace-pre-wrap">
                  {depUpdateStderrToShow}
                </div>
              ) : depUpdateStdoutToShow ? (
                <div className="mt-2 whitespace-pre-wrap">
                  {depUpdateStdoutToShow}
                  <div className="mt-1 flex items-center">
                    <span className="w-2 h-4 bg-gray-300 animate-pulse"></span>
                  </div>
                </div>
              ) : (
                <div className="mt-1 flex items-center">
                  <span className="w-2 h-4 bg-gray-300 animate-pulse"></span>
                </div>
              )}
              {helmTemplateCommandToShow && (
                <div className="flex gap-2 mt-4">
                  <span className="flex-shrink-0 text-primary/70">% </span>
                  <span className="text-primary/70 whitespace-pre-wrap">{helmTemplateCommandToShow}</span>
                </div>
              )}
              {helmTemplateStderrToShow ? (
                <div className="mt-2 text-red-400 whitespace-pre-wrap">
                  {helmTemplateStderrToShow}
                </div>
              ) : null}
              {chart.renderedFiles?.length > 0 && (
                <div className="mt-4 space-y-1">
                  {chart.renderedFiles.map((file, index) => (
                    <div
                      key={`${chart.id}-${file.id}-${file.filePath}-${index}`}
                      className="flex items-center gap-2 pl-2"
                    >
                      <span className="text-green-500">✓</span>
                      <span>{file.filePath}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
