import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import os from "os";
import type { AppConfig } from "@/serverConfig";

// Allow long-running ffmpeg + scenedetect pipeline
export const maxDuration = 600;

async function loadConfig(): Promise<AppConfig> {
  const configFile = await fs.readFile(path.join(process.cwd(), "app-config.json"), "utf-8");
  return JSON.parse(configFile) as AppConfig;
}

function validateConfig(config: AppConfig): void {
  const { shotBoundaryConfig, serverConfig } = config;
  if (!serverConfig.url || !serverConfig.apiKey) {
    throw new Error("Missing serverConfig.url or serverConfig.apiKey in app-config.json");
  }
  if (!shotBoundaryConfig.shotBoundary || !shotBoundaryConfig.sourceShotBoundaryAnalysis || !shotBoundaryConfig.shotBoundaryProcessed) {
    throw new Error("Shot boundary tags are not configured. Go to Settings → Shot Boundary to set them up.");
  }
}

type GqlConfig = { url: string; apiKey: string };

async function gql(config: GqlConfig, query: string, variables?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${config.url}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ApiKey: config.apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`GraphQL request failed: HTTP ${response.status}`);
  const result = await response.json() as { data: Record<string, unknown>; errors?: Array<{ message: string }> };
  if (result.errors?.length) throw new Error(result.errors[0].message);
  return result.data;
}

async function getSceneVideoPath(sceneId: string, config: GqlConfig): Promise<string> {
  const data = await gql(config, `
    query FindScene($id: ID!) {
      findScene(id: $id) { files { path } }
    }
  `, { id: sceneId });
  const files = (data.findScene as { files: Array<{ path: string }> } | null)?.files;
  if (!files?.length) throw new Error(`No video files found for scene ${sceneId}`);
  return files[0].path;
}

async function getExistingShotBoundaryMarkerIds(sceneId: string, shotBoundaryTagId: string, config: GqlConfig): Promise<string[]> {
  const data = await gql(config, `
    query FindScene($id: ID!) {
      findScene(id: $id) {
        scene_markers { id primary_tag { id } }
      }
    }
  `, { id: sceneId });
  const markers = (data.findScene as { scene_markers: Array<{ id: string; primary_tag: { id: string } }> } | null)?.scene_markers ?? [];
  return markers.filter(m => m.primary_tag.id === shotBoundaryTagId).map(m => m.id);
}

async function deleteShotBoundaryMarkers(markerIds: string[], config: GqlConfig): Promise<void> {
  await Promise.all(markerIds.map(id => gql(config, `
    mutation SceneMarkerDestroy($id: ID!) {
      sceneMarkerDestroy(id: $id)
    }
  `, { id })));
}

async function getTagName(tagId: string, config: GqlConfig): Promise<string> {
  const data = await gql(config, `
    query FindTag($id: ID!) { findTag(id: $id) { name } }
  `, { id: tagId });
  const tag = data.findTag as { name: string } | null;
  if (!tag) throw new Error(`Tag not found: ${tagId}`);
  return tag.name;
}

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "stash-marker-studio-"));
}

async function cleanupTemp(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}


async function downscaleVideo(inputPath: string, tempDir: string): Promise<string> {
  const ext = path.extname(inputPath);
  const outputPath = path.join(tempDir, `${randomUUID()}.540p${ext}`);

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", inputPath,
      "-vf", "scale=960:540",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "28",
      "-an",
      outputPath,
    ], { stdio: ["ignore", "ignore", "pipe"] });

    let stderr = "";
    ffmpeg.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-300)}`));
    });
  });

  return outputPath;
}

async function runSceneDetection(videoPath: string, tempDir: string): Promise<void> {
  const runWithBackend = (backend: string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const scenedetect = spawn("scenedetect", [
        "--input", videoPath,
        "--output", tempDir,
        "--backend", backend,
        "detect-content", "--threshold", "20", "--min-scene-len", "2s",
        "list-scenes",
      ], { stdio: ["ignore", "pipe", "pipe"] });

      let stderr = "";
      scenedetect.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
      scenedetect.stdout.on("data", () => { /* drain */ });

      scenedetect.on("error", reject);
      scenedetect.on("close", (code) => {
        if (code === 0 || stderr.includes("UnicodeEncodeError") || stderr.includes("charmap")) {
          resolve();
        } else {
          reject(new Error(`scenedetect (${backend}) exited with code ${code}: ${stderr.slice(-200)}`));
        }
      });
    });

  await runWithBackend("opencv");
}

async function findAndCopyCSV(tempDir: string, originalVideoPath: string): Promise<string | null> {
  const files = await fs.readdir(tempDir);
  const csvFile = files.find((f) => f.endsWith("-Scenes.csv"));
  if (!csvFile) return null;

  const parsed = path.parse(originalVideoPath);
  const destPath = path.join(parsed.dir, `${parsed.base}.Scenes.csv`);
  await fs.copyFile(path.join(tempDir, csvFile), destPath);
  return destPath;
}

async function createMarkersFromCSV(
  sceneId: string,
  csvPath: string,
  tagName: string,
  config: AppConfig
): Promise<void> {
  const serverConfig: GqlConfig = config.serverConfig;

  // Read CSV with encoding fallbacks
  const encodings: BufferEncoding[] = ["utf8", "latin1"];
  let csvContent = "";
  for (const enc of encodings) {
    try {
      csvContent = await fs.readFile(csvPath, enc);
      break;
    } catch { /* try next */ }
  }

  const rows = csvContent.split("\n").map((r) => r.split(","));
  const dataRows = rows.slice(2); // skip header rows

  const markerMutation = `
    mutation SceneMarkerCreate($input: SceneMarkerCreateInput!) {
      sceneMarkerCreate(input: $input) { id }
    }
  `;

  const markerInputs = dataRows
    .filter(row => row.length >= 7)
    .map(row => ({ startTime: parseFloat(row[3]), endTime: parseFloat(row[6]) }))
    .filter(({ startTime, endTime }) => !isNaN(startTime) && !isNaN(endTime));

  await Promise.all(markerInputs.map(({ startTime, endTime }) =>
    gql(serverConfig, markerMutation, {
      input: {
        scene_id: sceneId,
        title: tagName,
        seconds: startTime,
        end_seconds: endTime,
        primary_tag_id: config.shotBoundaryConfig.shotBoundary,
        tag_ids: [config.shotBoundaryConfig.sourceShotBoundaryAnalysis],
      },
    })
  ));

  // Tag scene as processed
  await gql(serverConfig, `
    mutation BulkSceneUpdate($input: BulkSceneUpdateInput!) {
      bulkSceneUpdate(input: $input) { id }
    }
  `, {
    input: {
      ids: [sceneId],
      tag_ids: { mode: "ADD", ids: [config.shotBoundaryConfig.shotBoundaryProcessed] },
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { sceneId?: string };
    const { sceneId } = body;
    if (!sceneId) {
      return NextResponse.json({ success: false, error: "sceneId is required" }, { status: 400 });
    }

    const config = await loadConfig();
    validateConfig(config);
    const serverConfig: GqlConfig = config.serverConfig;

    const videoPath = await getSceneVideoPath(sceneId, serverConfig);

    // Fetch tag name and existing markers in parallel (both are independent of each other)
    const [tagName, existingIds] = await Promise.all([
      getTagName(config.shotBoundaryConfig.shotBoundary, serverConfig),
      getExistingShotBoundaryMarkerIds(sceneId, config.shotBoundaryConfig.shotBoundary, serverConfig),
    ]);

    if (existingIds.length > 0) {
      await deleteShotBoundaryMarkers(existingIds, serverConfig);
    }

    const tempDir = await createTempDir();
    try {
      const downscaled = await downscaleVideo(videoPath, tempDir);
      await runSceneDetection(downscaled, tempDir);
      const csvPath = await findAndCopyCSV(tempDir, videoPath);
      if (!csvPath) throw new Error("Scene detection produced no CSV output");
      await createMarkersFromCSV(sceneId, csvPath, tagName, config);
    } finally {
      await cleanupTemp(tempDir);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
