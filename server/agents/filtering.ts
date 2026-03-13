import sharp from "sharp";
import { imageHash } from "image-hash";
import { log } from "../index";

export interface FilterResult {
  id: string;
  filename: string;
  perceptualHash: string;
  blurScore: number;
  brightnessScore: number;
  localScore: number;
  isDuplicate: boolean;
  isBlurry: boolean;
  isTooLow: boolean;
  buffer: Buffer;
}

function computePerceptualHash(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    imageHash(
      { data: buffer, ext: "image/jpeg" },
      16,
      true,
      (error: Error | null, data: string) => {
        if (error) reject(error);
        else resolve(data);
      }
    );
  });
}

function hexToBinary(hex: string): string {
  return hex
    .split("")
    .map((c) => parseInt(c, 16).toString(2).padStart(4, "0"))
    .join("");
}

function hammingDistance(hash1: string, hash2: string): number {
  const bin1 = hexToBinary(hash1);
  const bin2 = hexToBinary(hash2);
  let distance = 0;
  const minLen = Math.min(bin1.length, bin2.length);
  for (let i = 0; i < minLen; i++) {
    if (bin1[i] !== bin2[i]) distance++;
  }
  return distance + Math.abs(bin1.length - bin2.length);
}

async function computeBlurScore(buffer: Buffer): Promise<number> {
  const { data, info } = await sharp(buffer)
    .greyscale()
    .resize(256, 256, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const pixels = new Float64Array(data);

  let laplacianSum = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian =
        -4 * pixels[idx] +
        pixels[idx - 1] +
        pixels[idx + 1] +
        pixels[idx - width] +
        pixels[idx + width];
      laplacianSum += laplacian * laplacian;
      count++;
    }
  }

  return laplacianSum / count;
}

async function computeBrightness(buffer: Buffer): Promise<number> {
  const { data } = await sharp(buffer)
    .resize(64, 64, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let totalBrightness = 0;
  const pixelCount = data.length / 3;

  for (let i = 0; i < data.length; i += 3) {
    totalBrightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  return totalBrightness / pixelCount / 255;
}

/**
 * Compute a local quality score without any AI API calls.
 * Combines focus sharpness (60%) and brightness quality (40%).
 * Range: 0.0 – 1.0. Used to pre-rank images for AI budget allocation.
 */
function computeLocalScore(blurScore: number, brightnessScore: number): number {
  const normalizedBlur = Math.min(1, blurScore / 1000);

  let brightnessFactor: number;
  if (brightnessScore >= 0.25 && brightnessScore <= 0.80) {
    brightnessFactor = 1.0;
  } else if (brightnessScore >= 0.15 && brightnessScore <= 0.90) {
    brightnessFactor = 0.75;
  } else {
    brightnessFactor = 0.4;
  }

  return normalizedBlur * 0.6 + brightnessFactor * 0.4;
}

const DUPLICATE_THRESHOLD = 30;
const BLUR_THRESHOLD = 100;
const BRIGHTNESS_LOW = 0.08;
const BRIGHTNESS_HIGH = 0.95;

export async function filterImages(
  images: Array<{ id: string; filename: string; buffer: Buffer }>,
  onProgress?: (processed: number) => void
): Promise<{ passed: FilterResult[]; stats: { duplicatesRemoved: number; blurryRemoved: number; lowBrightnessRemoved: number } }> {
  log(`Filtering Agent: Processing ${images.length} images`, "filter-agent");

  const results: FilterResult[] = [];
  const canonicalReps: Array<{ index: number; hash: string; blurScore: number }> = [];
  let duplicatesRemoved = 0;
  let blurryRemoved = 0;
  let lowBrightnessRemoved = 0;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      const jpegBuffer = await sharp(img.buffer)
        .jpeg({ quality: 85 })
        .toBuffer();

      const [hash, blurScore, brightnessScore] = await Promise.all([
        computePerceptualHash(jpegBuffer).catch(() => `fallback_${i}`),
        computeBlurScore(jpegBuffer),
        computeBrightness(jpegBuffer),
      ]);

      let isDuplicate = false;
      let matchedCanonicalIdx = -1;
      let bestDistance = Infinity;

      if (!hash.startsWith("fallback_")) {
        for (let c = 0; c < canonicalReps.length; c++) {
          const canon = canonicalReps[c];
          const dist = hammingDistance(hash, canon.hash);
          if (dist < DUPLICATE_THRESHOLD && dist < bestDistance) {
            bestDistance = dist;
            isDuplicate = true;
            matchedCanonicalIdx = c;
          }
        }
      }

      if (isDuplicate && matchedCanonicalIdx >= 0) {
        const canon = canonicalReps[matchedCanonicalIdx];
        if (blurScore > canon.blurScore) {
          log(`  Replacing ${results[canon.index].filename} with sharper duplicate ${img.filename} (blur: ${blurScore.toFixed(1)} vs ${canon.blurScore.toFixed(1)}, hamming: ${bestDistance})`, "filter-agent");
          results[canon.index].isDuplicate = true;
          isDuplicate = false;
          canon.index = results.length;
          canon.hash = hash;
          canon.blurScore = blurScore;
        }
        duplicatesRemoved++;
      } else if (!hash.startsWith("fallback_")) {
        canonicalReps.push({ index: results.length, hash, blurScore });
      }

      const isBlurry = blurScore < BLUR_THRESHOLD;
      const isTooLow = brightnessScore < BRIGHTNESS_LOW || brightnessScore > BRIGHTNESS_HIGH;

      if (isBlurry && !isDuplicate) blurryRemoved++;
      if (isTooLow && !isDuplicate && !isBlurry) lowBrightnessRemoved++;

      const localScore = computeLocalScore(blurScore, brightnessScore);

      results.push({
        id: img.id,
        filename: img.filename,
        perceptualHash: hash,
        blurScore,
        brightnessScore,
        localScore,
        isDuplicate,
        isBlurry,
        isTooLow,
        buffer: img.buffer,
      });

      log(`  [${i + 1}/${images.length}] ${img.filename}: blur=${blurScore.toFixed(1)}, bright=${brightnessScore.toFixed(3)}, local=${localScore.toFixed(3)}, dup=${isDuplicate}${isDuplicate ? ` (dist=${bestDistance})` : ""}, blurry=${isBlurry}`, "filter-agent");
    } catch (err: any) {
      log(`  Error processing ${img.filename}: ${err.message}`, "filter-agent");
    }

    onProgress?.(i + 1);
  }

  const passed = results.filter(r => !r.isDuplicate && !r.isBlurry && !r.isTooLow);
  log(`Filtering Agent: ${passed.length}/${images.length} passed (${duplicatesRemoved} duplicates, ${blurryRemoved} blurry, ${lowBrightnessRemoved} low quality)`, "filter-agent");

  return {
    passed,
    stats: { duplicatesRemoved, blurryRemoved, lowBrightnessRemoved },
  };
}
