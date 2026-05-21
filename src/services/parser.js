import { MEDICINE_DB } from "../data/medicineDb";

const FREQUENCY_PATTERNS = [
  { pattern: /\b(1\s*-\s*0\s*-\s*1|bd|twice daily|two times)\b/i, text: "Twice daily" },
  { pattern: /\b(1\s*-\s*1\s*-\s*1|tds|tid|three times)\b/i, text: "Three times daily" },
  { pattern: /\b(1\s*-\s*0\s*-\s*0|morning|once daily|od)\b/i, text: "Once daily" },
  { pattern: /\b(0\s*-\s*0\s*-\s*1|night|hs|bedtime)\b/i, text: "At night" },
  { pattern: /\b(after food|after meal|af)\b/i, text: "After food" },
  { pattern: /\b(before food|before meal|bf)\b/i, text: "Before food" },
];

const DOSE_PATTERN = /\b(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|iu|units?|tab|tablet|capsule|cap|drops?))\b/i;
const DURATION_PATTERN = /\b(?:for\s*)?(\d+\s*(?:day|days|week|weeks|month|months))\b/i;

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s.-]/g, " ");
}

function getLineContext(lines, key) {
  const keyLower = key.toLowerCase();
  return lines.find((line) => line.toLowerCase().includes(keyLower)) || "";
}

function uniqueByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    const id = item.name.toLowerCase();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function detectMedicines(rawText) {
  const text = normalize(rawText || "");
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const detected = [];

  for (const med of MEDICINE_DB) {
    const matchedKey = med.keys.find((key) => text.includes(key.toLowerCase()));
    if (!matchedKey) continue;

    const context = getLineContext(lines, matchedKey);
    const dose = context.match(DOSE_PATTERN)?.[1] || "";
    const duration = context.match(DURATION_PATTERN)?.[1] || "";
    const frequency = FREQUENCY_PATTERNS.find(({ pattern }) => pattern.test(context || rawText))?.text || "";

    detected.push({
      ...med,
      matchedKey,
      dose,
      duration,
      frequency,
      sourceLine: context,
      confirmed: false,
    });
  }

  return uniqueByName(detected);
}

export function estimateConfidence(rawText, medicines) {
  const lengthScore = rawText && rawText.trim().length > 30;
  const medicineScore = medicines.length > 0;

  if (lengthScore && medicineScore && rawText.length > 120) return "medium";
  if (lengthScore || medicineScore) return "low";
  return "very low";
}

export function buildScanResult({ rawText, imagePreview }) {
  const medicines = detectMedicines(rawText);

  return {
    id: Date.now(),
    createdAt: new Date().toLocaleString(),
    rawText,
    imagePreview,
    medicines,
    confidence: estimateConfidence(rawText, medicines),
  };
}

