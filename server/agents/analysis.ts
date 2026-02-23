import { log } from "../index";

const GRADIENT_API_URL = "https://inference.do-ai.run/v1/chat/completions";
const GRADIENT_API_KEY = process.env.GRADIENT_API_KEY || "";

const MAX_CONCURRENT = 3;
const RETRY_DELAY = 1000;
const MAX_RETRIES = 2;

export interface AnalysisResult {
  id: string;
  aestheticScore: number;
  sceneDescription: string;
  embedding: number[];
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeImageWithGradient(
  imageBase64: string,
  filename: string,
  retries = 0
): Promise<{ aestheticScore: number; sceneDescription: string }> {
  try {
    const response = await fetch(GRADIENT_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GRADIENT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai-gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional photo evaluator. Analyze the image and respond with ONLY valid JSON in this exact format:
{"aesthetic_score": <number 0.0-1.0>, "scene_description": "<brief 10-word max description>"}

Scoring criteria:
- 0.0-0.3: Poor composition, bad lighting, uninteresting
- 0.3-0.6: Average photo, decent but not remarkable
- 0.6-0.8: Good composition, pleasing colors, interesting subject
- 0.8-1.0: Exceptional, professional quality, stunning composition`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Rate this photo's aesthetic quality. Respond with JSON only.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gradient API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        aestheticScore: Math.max(0, Math.min(1, parsed.aesthetic_score || 0.5)),
        sceneDescription: parsed.scene_description || "Photo",
      };
    }

    return { aestheticScore: 0.5, sceneDescription: "Photo" };
  } catch (err: any) {
    if (retries < MAX_RETRIES) {
      log(`  Retry ${retries + 1} for ${filename}: ${err.message}`, "analysis-agent");
      await sleep(RETRY_DELAY * (retries + 1));
      return analyzeImageWithGradient(imageBase64, filename, retries + 1);
    }
    log(`  Failed analysis for ${filename}: ${err.message}`, "analysis-agent");
    return { aestheticScore: 0.5, sceneDescription: "Photo" };
  }
}

async function generateVisualEmbedding(
  buffer: Buffer,
  aestheticScore: number,
  sceneDescription: string
): Promise<number[]> {
  const sharpModule = (await import("sharp")).default;
  const { data, info } = await sharpModule(buffer)
    .resize(64, 64, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  const colorHistR = new Array(8).fill(0);
  const colorHistG = new Array(8).fill(0);
  const colorHistB = new Array(8).fill(0);

  const gridSize = 4;
  const cellW = Math.floor(width / gridSize);
  const cellH = Math.floor(height / gridSize);
  const spatialColors = new Array(gridSize * gridSize * 3).fill(0);
  const spatialCounts = new Array(gridSize * gridSize).fill(0);

  let totalH = 0, totalS = 0, totalL = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      colorHistR[Math.min(7, Math.floor(r / 32))]++;
      colorHistG[Math.min(7, Math.floor(g / 32))]++;
      colorHistB[Math.min(7, Math.floor(b / 32))]++;

      const cellX = Math.min(gridSize - 1, Math.floor(x / cellW));
      const cellY = Math.min(gridSize - 1, Math.floor(y / cellH));
      const cellIdx = cellY * gridSize + cellX;
      spatialColors[cellIdx * 3] += r;
      spatialColors[cellIdx * 3 + 1] += g;
      spatialColors[cellIdx * 3 + 2] += b;
      spatialCounts[cellIdx]++;

      const rn = r / 255, gn = g / 255, bn = b / 255;
      const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
      totalL += (max + min) / 2;
      totalS += max === 0 ? 0 : (max - min) / max;
      let h = 0;
      if (max !== min) {
        const d = max - min;
        if (max === rn) h = ((gn - bn) / d + 6) % 6;
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        h /= 6;
      }
      totalH += h;
    }
  }

  const totalPixels = width * height;
  for (let i = 0; i < 8; i++) {
    colorHistR[i] /= totalPixels;
    colorHistG[i] /= totalPixels;
    colorHistB[i] /= totalPixels;
  }

  for (let i = 0; i < gridSize * gridSize; i++) {
    if (spatialCounts[i] > 0) {
      spatialColors[i * 3] = spatialColors[i * 3] / spatialCounts[i] / 255;
      spatialColors[i * 3 + 1] = spatialColors[i * 3 + 1] / spatialCounts[i] / 255;
      spatialColors[i * 3 + 2] = spatialColors[i * 3 + 2] / spatialCounts[i] / 255;
    }
  }

  const embedding: number[] = [
    ...colorHistR,
    ...colorHistG,
    ...colorHistB,
    ...spatialColors,
    totalH / totalPixels,
    totalS / totalPixels,
    totalL / totalPixels,
    aestheticScore,
  ];

  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

export async function analyzeImages(
  images: Array<{ id: string; filename: string; buffer: Buffer }>,
  onProgress?: (processed: number) => void
): Promise<AnalysisResult[]> {
  log(`Analysis Agent: Analyzing ${images.length} images via Gradient AI`, "analysis-agent");

  let processed = 0;

  const results = await processBatch(images, MAX_CONCURRENT, async (img) => {
    const resizedBuffer = await (await import("sharp")).default(img.buffer)
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    const base64 = resizedBuffer.toString("base64");

    const { aestheticScore, sceneDescription } = await analyzeImageWithGradient(base64, img.filename);

    const embedding = await generateVisualEmbedding(img.buffer, aestheticScore, sceneDescription);

    processed++;
    onProgress?.(processed);
    log(`  [${processed}/${images.length}] ${img.filename}: aesthetic=${aestheticScore.toFixed(2)}, scene="${sceneDescription}"`, "analysis-agent");

    return {
      id: img.id,
      aestheticScore,
      sceneDescription,
      embedding,
    };
  });

  log(`Analysis Agent: Completed analysis of ${results.length} images`, "analysis-agent");
  return results;
}
