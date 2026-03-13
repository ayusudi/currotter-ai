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
  selectionReason: string;
  embedding: number[];
  qualityTier: "hero" | "great" | "good";
  aiAnalyzed: boolean;
}

function generateSelectionReason(
  aestheticScore: number,
  blurScore: number,
  brightnessScore: number,
  uniqueness: number,
  clusterSize: number,
  sceneDescription: string,
  mode: "social" | "minimal"
): string {
  const reasons: string[] = [];

  if (aestheticScore >= 0.8) {
    reasons.push("Exceptional visual quality and composition");
  } else if (aestheticScore >= 0.6) {
    reasons.push("Good composition and pleasing colors");
  } else if (aestheticScore >= 0.4) {
    reasons.push("Decent overall quality");
  }

  const normalizedBlur = Math.min(1, blurScore / 1000);
  if (normalizedBlur >= 0.8) {
    reasons.push("very sharp focus");
  } else if (normalizedBlur >= 0.5) {
    reasons.push("good sharpness");
  }

  if (brightnessScore >= 0.3 && brightnessScore <= 0.7) {
    reasons.push("well-balanced lighting");
  } else if (brightnessScore > 0.7 && brightnessScore <= 0.8) {
    reasons.push("bright and vibrant lighting");
  }

  if (clusterSize > 1) {
    reasons.push(`best pick from ${clusterSize} similar shots`);
  } else if (uniqueness >= 0.9) {
    reasons.push("unique shot in the collection");
  }

  if (reasons.length === 0) {
    reasons.push("Selected as a quality photo from the collection");
  }

  let reason = reasons[0].charAt(0).toUpperCase() + reasons[0].slice(1);
  if (reasons.length > 1) {
    reason += ", " + reasons.slice(1).join(", ");
  }
  reason += ".";

  return reason;
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
  mode: "social" | "minimal",
  aiAnalyzedIds?: Set<string>
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
    const isAiAnalyzed = aiAnalyzedIds ? aiAnalyzedIds.has(f.id) : !!analysis;

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
      selectionReason: "",
      embedding: analysis?.embedding ?? [],
      qualityTier: "good" as const,
      aiAnalyzed: isAiAnalyzed,
    };
  });

  const clusterSizes = new Map<number, number>();
  for (const [clusterId, members] of clusterEntries) {
    clusterSizes.set(clusterId, members.length);
  }

  const selectionsPerCluster = mode === "social" ? 2 : 1;

  for (const [clusterId, members] of clusterEntries) {
    const clusterScored = members
      .map((m: { id: string; index: number }) => scored.find((s: ScoredImage) => s.id === m.id)!)
      .filter(Boolean)
      .sort((a: ScoredImage, b: ScoredImage) => b.finalScore - a.finalScore);

    const toSelect = Math.min(selectionsPerCluster, clusterScored.length);
    for (let i = 0; i < toSelect; i++) {
      clusterScored[i].isSelected = true;
      clusterScored[i].selectionReason = generateSelectionReason(
        clusterScored[i].aestheticScore,
        clusterScored[i].blurScore,
        clusterScored[i].brightnessScore,
        uniquenessScores.get(clusterScored[i].id) ?? 1,
        members.length,
        clusterScored[i].sceneDescription,
        mode
      );
    }

    if (clusterScored.length > 1) {
      log(`  Cluster ${clusterId}: selected ${toSelect}/${clusterScored.length} (best: ${clusterScored[0].filename} score=${clusterScored[0].finalScore.toFixed(3)})`, "decision-agent");
    }
  }

  const selected = scored.filter((s: ScoredImage) => s.isSelected);
  log(`Decision Agent: Selected ${selected.length}/${scored.length} images across ${clusterEntries.length} clusters`, "decision-agent");

  if (selected.length > 0) {
    const sortedByScore = [...selected].sort((a, b) => b.finalScore - a.finalScore);
    const heroCount = Math.max(1, Math.ceil(selected.length * 0.15));
    const greatCount = Math.max(1, Math.ceil(selected.length * 0.35));

    sortedByScore.forEach((img, rank) => {
      const original = scored.find(s => s.id === img.id)!;
      if (rank < heroCount) {
        original.qualityTier = "hero";
      } else if (rank < heroCount + greatCount) {
        original.qualityTier = "great";
      } else {
        original.qualityTier = "good";
      }
    });

    const heroImages = scored.filter(s => s.isSelected && s.qualityTier === "hero");
    log(`  Quality tiers: ${heroImages.length} hero, ${selected.filter(s => s.qualityTier === "great").length} great, ${selected.filter(s => s.qualityTier === "good").length} good`, "decision-agent");
  }

  return scored;
}
