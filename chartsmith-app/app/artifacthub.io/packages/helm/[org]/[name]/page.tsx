import { ImportChart } from "@/components/ImportChart";

interface ArtifactHubImportPageProps {
  params: {
    org: string;
    name: string;
  };
}

export default async function ArtifactHubImportPage({ params }: ArtifactHubImportPageProps) {
  const resolvedParams = await params;
  const { org, name } = resolvedParams;

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
