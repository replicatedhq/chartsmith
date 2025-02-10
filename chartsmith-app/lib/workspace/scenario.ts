import { Scenario } from "@/lib/types/workspace";

export async function createScenario(
  workspaceId: string,
  chartId: string,
  name: string,
  description: string,
  values: string
): Promise<Scenario> {
  return {
    id: `scenario-${Date.now()}`,
    name,
    description,
    values,
    chartId,
    workspaceId,
    enabled: true
  };
}
