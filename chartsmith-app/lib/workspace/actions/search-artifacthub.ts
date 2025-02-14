"use server"

export async function searchArtifactHubAction(query: string): Promise<string[]> {
  // a well defined artifact hub url looks like:
  // https://artifacthub.io/packages/helm/org/name

  // but we support org/name also, and we will put the rest in

  // so parse the input and return an array of 0 or 1 URLs that work

  if (query.includes("artifacthub.io/packages/helm/")) {
    return [query];
  }

  if (query.includes("/")) {
    const [org, name] = query.split("/");
    if (org.indexOf(".") === -1 && name.indexOf(".") === -1) {
      // if the input is org/name, assume it's a package and put the url prefix on
      return [`https://artifacthub.io/packages/helm/${query}`];
    }
  }

  // otherwise, return an empty array
  return [];
}
