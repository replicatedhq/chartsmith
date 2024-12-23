interface Params {
  isLoaded: boolean;
  DBUri: string;

  authMethod?: string;
}

let params: Params = {
  isLoaded: false,
  DBUri: process.env["CHARTSMITH_PG_URI"] || process.env["DB_URI"]!
};

export async function loadParams() {
  params.isLoaded = true;
}

// return params, if empty will try to get
export async function getParam(key: string): Promise<any> {
  if (!params.isLoaded) {
    await loadParams();
  }

  switch (key) {
    case "DB_URI":
      return params.DBUri;
    default:
      throw new Error(`unknown param ${key}`);
  }
}
