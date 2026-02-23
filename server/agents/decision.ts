import { log } from "../index";
import type { FilterResult } from "./filtering";
import type { AnalysisResult } from "./analysis";

export interface ScoredImage {
  id: string;
  filename: string;
  finalScore: number;
  clusterId: number;
  isSelected: boolean;
  blurScore: number;
  brightnessScore: number;
  aestheticScore: number;
  sceneDescription: string;
  embedding: number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

function clusterImages(
  images: Array<{ id: string; embedding: number[] }>,
  similarityThreshold: number
): Map<string, number> {
  const clusters = new Map<string, number>();
  let nextClusterId = 0;

  log(`  Clustering ${images.length} images with similarity threshold ${similarityThreshold}`, "decision-agent");

  for (const img of images) {
    let assignedCluster = -1;
    let maxSimilarity = 0;
    let bestMatchId = "";

    for (const other of images) {
      if (other.id === img.id) continue;
      const existingCluster = clusters.get(other.id);
      if (existingCluster === undefined) continue;

      const sim = cosineSimilarity(img.embedding, other.embedding);
      if (sim > similarityThreshold && sim > maxSimilarity) {
        maxSimilarity = sim;
        assignedCluster = existingCluster;
        bestMatchId = other.id;
      }
    }

    if (assignedCluster === -1) {
      clusters.set(img.id, nextClusterId++);
    } else {
      clusters.set(img.id, assignedCluster);
      log(`  Merged image into cluster ${assignedCluster} (similarity=${maxSimilarity.toFixed(4)} with ${bestMatchId.substring(0, 8)}...)`, "decision-agent");
    }
  }

  return clusters;
}

function computeWeightedScore(
  blurScore: number,
  brightnessScore: number,
  aestheticScore: number,
  uniqueness: number,
  mode: "social" | "minimal"
): number {
  const normalizedBlur = Math.min(1, blurScore / 1000);

  const brightnessPenalty = brightnessScore < 0.15 || brightnessScore > 0.9
    ? 0.5
    : brightnessScore < 0.25 || brightnessScore > 0.8
    ? 0.75
    : 1.0;

  const weights = mode === "social"
    ? { focus: 0.2, aesthetic: 0.35, uniqueness: 0.3, brightness: 0.15 }
    : { focus: 0.25, aesthetic: 0.45, uniqueness: 0.15, brightness: 0.15 };

  return (
    weights.focus * normalizedBlur +
    weights.aesthetic * aestheticScore +
    weights.uniqueness * uniqueness +
    weights.brightness * brightnessPenalty
  );
}

export function makeDecisions(
  filterResults: FilterResult[],
  analysisResults: AnalysisResult[],
  mode: "social" | "minimal"
): ScoredImage[] {
  log(`Decision Agent: Processing ${filterResults.length} images in "${mode}" mode`, "decision-agent");

  const analysisMap = new Map(analysisResults.map(a => [a.id, a]));

  const similarityThreshold = mode === "social" ? 0.90 : 0.80;

  const embeddingSize = analysisResults.length > 0 ? analysisResults[0].embedding.length : 76;

  const imageEmbeddings = filterResults.map(f => {
    const analysis = analysisMap.get(f.id);
    return {
      id: f.id,
      embedding: analysis?.embedding || new Array(embeddingSize).fill(0),
    };
  });

  const clusters = clusterImages(imageEmbeddings, similarityThreshold);

  log(`  Found ${new Set(clusters.values()).size} clusters`, "decision-agent");

  const clusterGroups = new Map<number, Array<{ id: string; index: number }>>();
  filterResults.forEach((f: FilterResult, idx: number) => {
    const clusterId = clusters.get(f.id) ?? 0;
    const group = clusterGroups.get(clusterId);
    if (group) {
      group.push({ id: f.id, index: idx });
    } else {
      clusterGroups.set(clusterId, [{ id: f.id, index: idx }]);
    }
  });

  const clusterEntries = Array.from(clusterGroups.entries());

  for (const [clusterId, members] of clusterEntries) {
    const filenames = members.map((m: { id: string; index: number }) => filterResults[m.index].filename);
    log(`  Cluster ${clusterId}: ${members.length} images [${filenames.join(", ")}]`, "decision-agent");
  }

  const uniquenessScores = new Map<string, number>();
  for (const [_clusterId, members] of clusterEntries) {
    const uniqueness = 1 / Math.sqrt(members.length);
    for (const m of members) {
      uniquenessScores.set(m.id, uniqueness);
    }
  }

  const scored: ScoredImage[] = filterResults.map((f: FilterResult) => {
    const analysis = analysisMap.get(f.id);
    const clusterId = clusters.get(f.id) ?? 0;
    const uniqueness = uniquenessScores.get(f.id) ?? 1;

    const finalScore = computeWeightedScore(
      f.blurScore,
      f.brightnessScore,
      analysis?.aestheticScore ?? 0.5,
      uniqueness,
      mode
    );

    return {
      id: f.id,
      filename: f.filename,
      finalScore,
      clusterId,
      isSelected: false,
      blurScore: f.blurScore,
      brightnessScore: f.brightnessScore,
      aestheticScore: analysis?.aestheticScore ?? 0.5,
      sceneDescription: analysis?.sceneDescription ?? "",
      embedding: analysis?.embedding ?? [],
    };
  });

  const selectionsPerCluster = mode === "social" ? 2 : 1;

  for (const [clusterId, members] of clusterEntries) {
    const clusterScored = members
      .map((m: { id: string; index: number }) => scored.find((s: ScoredImage) => s.id === m.id)!)
      .filter(Boolean)
      .sort((a: ScoredImage, b: ScoredImage) => b.finalScore - a.finalScore);

    const toSelect = Math.min(selectionsPerCluster, clusterScored.length);
    for (let i = 0; i < toSelect; i++) {
      clusterScored[i].isSelected = true;
    }

    if (clusterScored.length > 1) {
      log(`  Cluster ${clusterId}: selected ${toSelect}/${clusterScored.length} (best: ${clusterScored[0].filename} score=${clusterScored[0].finalScore.toFixed(3)})`, "decision-agent");
    }
  }

  const selected = scored.filter((s: ScoredImage) => s.isSelected);
  log(`Decision Agent: Selected ${selected.length}/${scored.length} images across ${clusterEntries.length} clusters`, "decision-agent");

  return scored;
}
