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

export async function getFilesFromBytes(bytes: ArrayBuffer, fileName: string): Promise<WorkspaceFile[]> {
  const id = srs.default({ length: 12, alphanumeric: true });

  // save the bytes to a tmp file
  const tmpDir = path.join(os.tmpdir(), 'chartsmith-chart-archive-' + Date.now());
  await fs.mkdir(tmpDir);

  // write the bytes to a file
  const filePath = path.join(tmpDir, fileName);
  await fs.writeFile(filePath, Buffer.from(bytes));

  // Create extraction directory with base name (without extension)
  const extractPath = path.join(tmpDir, 'extracted');
  await fs.mkdir(extractPath);

  // Check if the file is gzipped by looking at magic numbers
  const fileBuffer = Buffer.from(bytes);
  const isGzipped = fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b;

  // Extract the file based on whether it's gzipped or not
  await new Promise<void>((resolve, reject) => {
    const readStream = fsSync.createReadStream(filePath);
    const extractStream = tar.extract({ cwd: extractPath });

    if (isGzipped) {
      readStream
        .pipe(gunzip())
        .pipe(extractStream)
        .on('finish', () => resolve())
        .on('error', reject);
    } else {
      readStream
        .pipe(extractStream)
        .on('finish', () => resolve())
        .on('error', reject);
    }
  });

  const files: WorkspaceFile[] = await filesInArchive(extractPath);

  return files;
}

export async function getChartFromBytes(bytes: ArrayBuffer, fileName: string): Promise<Chart> {
  const id = srs.default({ length: 12, alphanumeric: true });

  // save the bytes to a tmp file
  const tmpDir = path.join(os.tmpdir(), 'chartsmith-chart-archive-' + Date.now());
  await fs.mkdir(tmpDir);

  // write the bytes to a file
  const filePath = path.join(tmpDir, fileName);
  await fs.writeFile(filePath, Buffer.from(bytes));

  // Create extraction directory with base name (without extension)
  const extractPath = path.join(tmpDir, 'extracted');
  await fs.mkdir(extractPath);

  // Check if the file is gzipped by looking at magic numbers
  const fileBuffer = Buffer.from(bytes);
  const isGzipped = fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b;

  // Extract the file based on whether it's gzipped or not
  await new Promise<void>((resolve, reject) => {
    const readStream = fsSync.createReadStream(filePath);
    const extractStream = tar.extract({ cwd: extractPath });

    if (isGzipped) {
      readStream
        .pipe(gunzip())
        .pipe(extractStream)
        .on('finish', () => resolve())
        .on('error', reject);
    } else {
      readStream
        .pipe(extractStream)
        .on('finish', () => resolve())
        .on('error', reject);
    }
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

  try {
    // First check if we have the chart in our local database
    const { getArtifactHubChart } = await import('@/lib/artifacthub/artifacthub');
    const chart = await getArtifactHubChart(org, name);
    
    if (chart && chart.content_url) {
      console.log(`Using cached chart from local database: ${org}/${name} v${chart.version}`);
      // We found the chart in our local database
      const extractPath = await downloadChartArchiveFromURL(chart.content_url);
      await removeBinaryFilesInPath(extractPath);
      return filesInArchive(extractPath);
    }
  } catch (error) {
    console.error("Error fetching from local cache, falling back to ArtifactHub API", error);
  }

  // Fallback to ArtifactHub API if local cache failed
  try {
    // use the artifacthub api to get the source of the files
    const packageInfo = await fetch(`https://artifacthub.io/api/v1/packages/helm/${org}/${name}`);
    if (!packageInfo.ok) {
      throw new Error(`Failed to fetch package info: ${packageInfo.status} ${packageInfo.statusText}`);
    }
    
    const packageInfoJson = await packageInfo.json();
    const contentURL = packageInfoJson.content_url;
    
    if (!contentURL) {
      throw new Error("Content URL not found in package info");
    }
    
    const extractPath = await downloadChartArchiveFromURL(contentURL);
    await removeBinaryFilesInPath(extractPath);
    return filesInArchive(extractPath);
  } catch (error) {
    console.error("Error in downloadChartFilesFromArtifactHub", error);
    throw new Error(`Failed to download chart files: ${error.message}`);
  }
}

async function filesInArchive(extractPath: string): Promise<WorkspaceFile[]> {
  const files = await parseFilesInDirectory(extractPath);
  const filePaths = files.map(file => file.filePath);
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
  const extractPath = path.join(tmpDir, filename.replace(/\.(tar\.gz|tgz)$/, ''));

  await fs.mkdir(extractPath);

  return new Promise((resolve, reject) => {
    response.body.pipe(gunzip())
      .pipe(tar.extract({ cwd: extractPath }))
      .on('finish', () => resolve(extractPath))
      .on('error', reject);
  });
}

async function removeBinaryFilesInPath(extractPath: string) {
  const files = await fs.readdir(extractPath, { recursive: true });
  for (const file of files) {
    const filePath = path.join(extractPath, file);
    const stats = await fs.stat(filePath);

    if (stats.isFile()) {
      // Never remove yaml files
      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        continue;
      }

      try {
        const fd = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(512);
        await fd.read(buffer, 0, 512, 0);
        await fd.close();

        const isBinary = buffer.some(byte => (byte < 32 && ![9, 10, 13].includes(byte)) || byte === 65533);
        if (isBinary) {
          await fs.unlink(filePath);
        }
      } catch (error) {
        await fs.unlink(filePath);
      }
    }
  }
}

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
