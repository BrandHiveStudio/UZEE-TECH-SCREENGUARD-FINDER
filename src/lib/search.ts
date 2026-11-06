import Fuse from "fuse.js";
import type { Box, SearchResultItem } from "@/types/screenguard";

// ─── Bidirectional Brand Aliases Mapping ───────────────────────────────────────
const BRAND_ALIASES: Record<string, string[]> = {
  ip: ["iphone", "apple"],
  iphone: ["ip", "apple"],
  apple: ["iphone", "ip"],
  sam: ["samsung", "galaxy"],
  samsung: ["sam", "galaxy"],
  galaxy: ["sam", "samsung"],
  rm: ["redmi", "xiaomi"],
  redmi: ["rm", "xiaomi"],
  xiaomi: ["rm", "redmi", "xm"],
  op: ["oppo"],
  oppo: ["op"],
  vo: ["vivo"],
  vivo: ["vo"],
  "1+": ["oneplus"],
  oneplus: ["1+"],
  real: ["realme"],
  realme: ["real"],
  xm: ["xiaomi", "redmi"],
  poc: ["poco"],
  poco: ["poc"],
  moto: ["motorola"],
  motorola: ["moto"],
};

// Model qualifiers that change model sub-variant
const MODEL_QUALIFIERS = [
  "pro", "plus", "max", "lite", "ultra", "gt", "se", "neo", "fe", "5g", "4g",
  "explorer", "prime", "activ", "india", "global", "eu", "china", "civi"
];

export function createSearchEngine(boxes: Box[]) {
  const fuseOptions = {
    keys: [
      { name: "boxNumber", weight: 0.35 },
      { name: "compatibleModels", weight: 0.45 },
      { name: "title", weight: 0.20 },
    ],
    threshold: 0.2,
    distance: 50,
    ignoreLocation: true,
    minMatchCharLength: 2,
    includeScore: true,
  };

  return new Fuse(boxes, fuseOptions);
}

function normalizeText(text: string): string {
  let t = text.toLowerCase().trim();

  // Normalize brand abbreviations
  t = t.replace(/1\+/g, "oneplus");
  t = t.replace(/\bip\b/g, "iphone");
  t = t.replace(/\bapple\b/g, "iphone");
  t = t.replace(/\bsam\b/g, "samsung");
  t = t.replace(/\brm\b/g, "redmi");
  t = t.replace(/\bop\b/g, "oppo");
  t = t.replace(/\bvo\b/g, "vivo");
  t = t.replace(/\breal\b/g, "realme");
  t = t.replace(/\bpoc\b/g, "poco");
  t = t.replace(/\bxm\b/g, "xiaomi");

  // Normalize '+' to 'plus' so "7+" matches "7 plus"
  t = t.replace(/(\d+)\s*\+/g, "$1 plus ");
  t = t.replace(/\+/g, " plus ");

  // Standardize model numbers e.g. "9 rt" -> "9rt"
  t = t.replace(/\b(\d+)\s*(rt|fe|pro|plus|max|lite|ultra|gt|se|neo|5g|4g|c|i|s|e|k|a|x)\b/gi, "$1$2");
  t = t.replace(/\b(note)\s*(\d+)\b/gi, "note $2");

  return t;
}

function extractDigits(text: string): string[] {
  const matches = text.match(/\d+/g);
  return matches ? matches : [];
}

interface MatchDetail {
  isMatch: boolean;
  isExactBase: boolean;
  isSeriesMatch: boolean;
  score: number;
}

function matchModelString(query: string, model: string, boxTitle: string): MatchDetail {
  const qNorm = normalizeText(query);
  const mNorm = normalizeText(model);
  const tNorm = normalizeText(boxTitle);

  const qTokens = qNorm.split(/\s+/).filter(Boolean);
  if (qTokens.length === 0) return { isMatch: false, isExactBase: false, isSeriesMatch: false, score: 1 };

  // 1. Identify brand tokens
  const qBrands = new Set<string>();
  const qModelTokens: string[] = [];

  for (const token of qTokens) {
    if (BRAND_ALIASES[token]) {
      qBrands.add(token);
      for (const alias of BRAND_ALIASES[token]) {
        qBrands.add(alias);
      }
    } else {
      qModelTokens.push(token);
    }
  }

  if (qBrands.size > 0) {
    const hasBrand = Array.from(qBrands).some((b) => mNorm.includes(b) || tNorm.includes(b));
    if (!hasBrand) return { isMatch: false, isExactBase: false, isSeriesMatch: false, score: 1 };
  }

  if (qModelTokens.length === 0) {
    return { isMatch: true, isExactBase: true, isSeriesMatch: true, score: 0.1 };
  }

  // 2. Strict Model Code & Digit Matching
  const qDigits = extractDigits(qNorm);

  for (const qt of qModelTokens) {
    const qtUnspaced = qt.replace(/\s+/g, "");
    const endsWithDigit = /\d$/.test(qt);

    const patternStr =
      "\\b" +
      qt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      (endsWithDigit ? "(?!\\d)" : "\\b");
    const pattern = new RegExp(patternStr, "i");

    const mUnspaced = mNorm.replace(/\s+/g, "");
    const patternUnspacedStr =
      "\\b" +
      qtUnspaced.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      (endsWithDigit ? "(?!\\d)" : "\\b");
    const patternUnspaced = new RegExp(patternUnspacedStr, "i");

    const tokenMatch = pattern.test(mNorm) || patternUnspaced.test(mUnspaced);

    if (!tokenMatch) {
      if (qNorm.includes("9rt") && (mNorm.includes("9t") || mNorm.includes("8t"))) {
        continue;
      }
      return { isMatch: false, isExactBase: false, isSeriesMatch: false, score: 1 };
    }
  }

  if (qDigits.length > 0) {
    const primaryQDigit = qDigits[0];
    const mDigits = extractDigits(mNorm);

    if (primaryQDigit === "9" && qNorm.includes("9rt") && mNorm.includes("8t")) {
      // Allowed OnePlus 8T series match
    } else if (!mDigits.includes(primaryQDigit)) {
      return { isMatch: false, isExactBase: false, isSeriesMatch: false, score: 1 };
    }
  }

  // Check extra unrequested model qualifiers e.g. candidate "redmi note 10 pro" when query was "redmi note 10"
  const mTokens = mNorm.split(/\s+/);
  let hasExtraQualifier = false;

  for (const qual of MODEL_QUALIFIERS) {
    if (mTokens.includes(qual) || mNorm.includes(qual)) {
      if (!qNorm.includes(qual)) {
        hasExtraQualifier = true;
        break;
      }
    }
  }

  const isExactBase = !hasExtraQualifier;

  // For iPhone series searches (e.g. IP 13 / iPhone 13), all iPhone 13 models (13, 13 mini, 13 Pro, 13 Pro Max) are valid series matches
  const isIphoneSeries = qNorm.includes("iphone") && mNorm.includes("iphone") && qDigits.length > 0 && mNorm.includes(qDigits[0]);
  const isSeriesMatch = isExactBase || isIphoneSeries || (qNorm.includes("9rt") && (mNorm.includes("9t") || mNorm.includes("8t")));

  let score = 0.05;
  if (qNorm === mNorm) {
    score = 0.0;
  } else if (isExactBase) {
    score = 0.01;
  } else if (isSeriesMatch) {
    score = 0.03;
  } else {
    score = 0.06;
  }

  return { isMatch: true, isExactBase, isSeriesMatch, score };
}

export function searchBoxes(
  fuse: Fuse<Box>,
  query: string
): SearchResultItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Extract all boxes from Fuse index
  const boxes: Box[] = fuse.getIndex().docs as Box[];

  // 1. Direct exact Box Number match check e.g. "box 01", "box 50", "050"
  const boxMatch = trimmed.match(/^(?:box\s*|sd-f)?(\d{1,3})$/i);
  if (boxMatch) {
    const num = parseInt(boxMatch[1], 10);
    const formattedBoxNum = `BOX ${num < 10 ? "00" + num : num < 100 ? "0" + num : num}`;
    const altBoxNum = `BOX ${num < 10 ? "0" + num : num}`;
    const idMatch = `SD-F${num < 10 ? "00" + num : num < 100 ? "0" + num : num}`;

    const exactBoxes = boxes.filter(
      (b) =>
        b.boxNumber.toUpperCase() === formattedBoxNum ||
        b.boxNumber.toUpperCase() === altBoxNum ||
        b.boxNumber.toUpperCase() === `BOX ${num}` ||
        b.id.toUpperCase() === idMatch
    );

    if (exactBoxes.length > 0) {
      return exactBoxes.map((b) => ({
        item: b,
        score: 0,
        matchedModel: b.boxNumber,
      }));
    }
  }

  // 2. High-precision Model Matching
  const precisionResults: { item: Box; score: number; isExactBase: boolean; isSeriesMatch: boolean; matchedModel: string }[] = [];

  for (const box of boxes) {
    let bestScore = 1;
    let bestIsExactBase = false;
    let bestIsSeriesMatch = false;
    let bestMatchedModel: string | undefined;

    for (const model of box.compatibleModels) {
      const match = matchModelString(trimmed, model, box.title);
      if (match.isMatch && match.score < bestScore) {
        bestScore = match.score;
        bestIsExactBase = match.isExactBase;
        bestIsSeriesMatch = match.isSeriesMatch;
        bestMatchedModel = model;
      }
    }

    if (bestScore < 1 && bestMatchedModel) {
      precisionResults.push({
        item: box,
        score: bestScore,
        isExactBase: bestIsExactBase,
        isSeriesMatch: bestIsSeriesMatch,
        matchedModel: bestMatchedModel,
      });
    }
  }

  // Helper for stock status priority rank
  const getStockRank = (box: Box) => {
    const verified = box.stockCountVerified ?? false;
    const qty = box.stockQuantity ?? 0;
    if (!verified) return 2; // NOT_COUNTED
    if (qty >= 4) return 0;  // IN_STOCK
    if (qty >= 1) return 1;  // LOW_STOCK
    return 3;               // OUT_OF_STOCK
  };

  if (precisionResults.length > 0) {
    const qNorm = normalizeText(trimmed);

    // Dedicated title rule e.g. "Samsung A34" -> BOX 050 (Samsung Galaxy A34 5G)
    if (qNorm.includes("a34")) {
      const dedicatedA34 = precisionResults.filter((r) => r.item.boxNumber === "BOX 050" || r.item.boxNumber === "BOX 102");
      if (dedicatedA34.length > 0) {
        return dedicatedA34.map((r) => ({
          item: r.item,
          score: r.score,
          matchedModel: r.matchedModel,
        })).sort(
          (a, b) =>
            (a.score ?? 1) - (b.score ?? 1) ||
            getStockRank(a.item) - getStockRank(b.item) ||
            a.item.boxNumber.localeCompare(b.item.boxNumber)
        );
      }
    }

    // Filter results to valid series & exact base matches, excluding false-positive qualified extensions
    const validMatches = precisionResults.filter((r) => r.isSeriesMatch);

    let filtered = precisionResults;
    if (validMatches.length > 0) {
      filtered = validMatches;
    }

    return filtered.map((r) => ({
      item: r.item,
      score: r.score,
      matchedModel: r.matchedModel,
    })).sort(
      (a, b) =>
        (a.score ?? 1) - (b.score ?? 1) ||
        getStockRank(a.item) - getStockRank(b.item) ||
        a.item.boxNumber.localeCompare(b.item.boxNumber)
    );
  }

  // Fallback to Fuse fuzzy search ONLY if zero precision matches exist and score is high confidence
  const fuseResults = fuse.search(trimmed);
  return fuseResults
    .filter((r) => (r.score ?? 1) <= 0.15)
    .map((r) => ({
      item: r.item,
      score: r.score,
      matchedModel: r.item.compatibleModels[0],
    }))
    .sort(
      (a, b) =>
        (a.score ?? 1) - (b.score ?? 1) ||
        getStockRank(a.item) - getStockRank(b.item) ||
        a.item.boxNumber.localeCompare(b.item.boxNumber)
    );
}
