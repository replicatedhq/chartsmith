import * as srs from "secure-random-string";
import { Chart, WorkspaceFile } from "../types/workspace";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as tar from 'tar';
import gunzip from 'gunzip-maybe';
import fetch from 'node-fetch';
import yaml from 'yaml';

export async function getArchiveFromBytes(bytes: ArrayBuffer, fileName: string): Promise<Chart> {
  const id = srs.default({ length: 12, alphanumeric: true });

  // save the bytes to a tmp file
  const tmpDir = path.join(os.tmpdir(), 'chartsmith-chart-archive-' + Date.now());
  await fs.mkdir(tmpDir);

  // write the bytes to a file
  const filePath = path.join(tmpDir, fileName);
  await fs.writeFile(filePath, Buffer.from(bytes));

  // Create extraction directory with base name (without .tgz extension)
  const extractPath = path.join(tmpDir, 'extracted');
  await fs.mkdir(extractPath);

  // Extract the tar.gz file
  await new Promise<void>((resolve, reject) => {
    fsSync.createReadStream(filePath)
      .pipe(gunzip())
      .pipe(tar.extract({ cwd: extractPath }))
      .on('finish', () => resolve())
      .on('error', reject);
  });

  const files: WorkspaceFile[] = await filesInArchive(extractPath);

  const c: Chart = {
    id: id,
    name: await chartNameFromFiles(files),
    files: files,
  }

  return c;
}

export async function getArchiveFromUrl(url: string): Promise<Chart> {
  // generate a random ID for the chart
  const id = srs.default({ length: 12, alphanumeric: true });

  // download the chart archive from the url
  let files: WorkspaceFile[] = [];
  const hostname = new URL(url).hostname;
  if (hostname === "artifacthub.io") {
    files = await downloadChartFilesFromArtifactHub(url);
  } else {
    throw new Error("Unsupported URL");
  }

  const c: Chart = {
    id: id,
    name: await chartNameFromFiles(files),
    files: files,
  }

  return c;
}

async function downloadChartFilesFromArtifactHub(url: string): Promise<WorkspaceFile[]> {
  // split the artifact hub url so we have the org and name
  // given: https://artifacthub.io/packages/helm/org/name we want to get org and name using regex
  const orgAndName = url.match(/https:\/\/artifacthub\.io\/packages\/helm\/(.*)\/(.*)/);
  if (!orgAndName) {
    throw new Error("Invalid ArtifactHub URL");
  }
  const org = orgAndName[1];
  const name = orgAndName[2];

  // use the artifacthub api to get the source of the files
  const packageInfo = await fetch(`https://artifacthub.io/api/v1/packages/helm/${org}/${name}`);
  const packageInfoJson = await packageInfo.json();

  const contentURL = packageInfoJson.content_url;

  // download it to a tmp directory
  const extractPath = await downloadChartArchiveFromURL(contentURL);


  return filesInArchive(extractPath);
}

async function filesInArchive(extractPath: string): Promise<WorkspaceFile[]> {
  const files = await parseFilesInDirectory(extractPath);
  const commonPrefix = await findCommonPrefix(files);
  const filesWithoutCommonPrefix = files.map(file => ({
    ...file,
    filePath: file.filePath.substring(commonPrefix.length),
  }));

  // remove anything in a "charts" directory
  const filesWithoutCharts = filesWithoutCommonPrefix.filter(file => !file.filePath.includes("charts/"));
  return filesWithoutCharts;
}

async function chartNameFromFiles(files: WorkspaceFile[]): Promise<string> {
  // find the Chart.yaml with the shortest path, look for the name attribute in that yaml
  const chartYaml = files.find(file => file.filePath.endsWith("Chart.yaml"));
  if (!chartYaml) {
    throw new Error("No Chart.yaml found");
  }
  const chartYamlContent = chartYaml.content;

  // parse the yaml
  const parsedYaml = yaml.parse(chartYamlContent);
  return parsedYaml.name;
}


// downloadChartArchiveFromURL downloads the chart archive from the url and returns the path
// to the extracted files.  assume that the url is tar gz'ed file
async function downloadChartArchiveFromURL(url: string): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), 'chartsmith-chart-archive-' + Date.now());
  await fs.mkdir(tmpDir);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download chart archive from ${url}: ${response.status} ${response.statusText}`);
  }

  const filename = path.basename(new URL(url).pathname);
  const extractPath = path.join(tmpDir, filename.replace(/\.tar\.gz$/, ''));

  await fs.mkdir(extractPath);

  return new Promise((resolve, reject) => {
    response.body.pipe(gunzip())
      .pipe(tar.extract({ cwd: extractPath }))
      .on('finish', () => resolve(extractPath))
      .on('error', reject);
  });
}

// parseFilesInDirectory will walk extractPath, and create a WorkspaceFile for each file
// before returning, it will strip the common prefix that all file paths have
async function parseFilesInDirectory(extractPath: string): Promise<WorkspaceFile[]> {
  const workspaceFiles: WorkspaceFile[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        const content = await fs.readFile(entryPath, 'utf-8');
        const filePath = entryPath.substring(extractPath.length);
        workspaceFiles.push({
          id: srs.default({ length: 12, alphanumeric: true }),
          filePath: filePath,
          content: content,
        });
      } else if (entry.isDirectory()) {
        await walk(entryPath);
      }
    }
  }

  await walk(extractPath);
  return workspaceFiles;
}


async function findCommonPrefix(files: WorkspaceFile[]): Promise<string> {
  const filePaths = files.map(file => file.filePath);

  if (!filePaths || filePaths.length === 0) {
    return "";
  }

  if (filePaths.length === 1) {
    return filePaths[0];
  }

  let prefix = "";
  const firstFilePath = filePaths[0];

  for (let i = 0; i < firstFilePath.length; i++) {
    const char = firstFilePath[i];
    if (filePaths.every(filePath => filePath.length > i && filePath[i] === char)) {
      prefix += char;
    } else {
      break;
    }
  }
  return prefix;
}
