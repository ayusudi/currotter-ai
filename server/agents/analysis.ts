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

function generateSimpleEmbedding(buffer: Buffer, aestheticScore: number): number[] {
  const embedding = new Array(64).fill(0);

  const sampleSize = Math.min(buffer.length, 4096);
  const step = Math.max(1, Math.floor(buffer.length / sampleSize));

  for (let i = 0; i < sampleSize && i * step < buffer.length; i++) {
    const idx = i % 64;
    embedding[idx] += buffer[i * step] / 255;
  }

  const samplesPerBin = Math.ceil(sampleSize / 64);
  for (let i = 0; i < 64; i++) {
    embedding[i] = embedding[i] / samplesPerBin;
  }

  embedding[0] = aestheticScore;

  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < 64; i++) {
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

    const embedding = generateSimpleEmbedding(resizedBuffer, aestheticScore);

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
