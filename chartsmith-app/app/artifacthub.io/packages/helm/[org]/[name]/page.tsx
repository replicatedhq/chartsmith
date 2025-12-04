import { ImportChart } from "@/components/ImportChart";

export const dynamic = 'force-dynamic';

interface ArtifactHubImportPageProps {
  params: Promise<{
    org: string;
    name: string;
  }>;
}

export default async function ArtifactHubImportPage({ params }: ArtifactHubImportPageProps) {
  const { org, name } = await params;

  const url = `https://artifacthub.io/packages/helm/${org}/${name}`;

  if (!org || !name) {
    // show an error message
    return <div>Invalid URL</div>;
  }

  return (
    <div className="h-full w-full overflow-auto transition-all duration-300 ease-in-out">
      <ImportChart url={url} />
    </div>
  );
}
