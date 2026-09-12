// api_verification.mjs
import fs from 'fs';
import path from 'path';

const dataPath = path.resolve('src/data/screenguards.json');
const raw = fs.readFileSync(dataPath, 'utf-8');
const data = JSON.parse(raw);
const groups = data.boxes;

const queries = [
  'Samsung A06',
  'Redmi 13C',
  'Vivo Y20',
  'iPhone 16',
  'Samsung S24 FE 5G',
  'TECNO 5G',
  'POCO C65'
];

function normalizeText(text) {
  let t = text.toLowerCase().trim();
  t = t.replace(
    /\b(s|a|m|n|x|z|g|y|t|c|v|f|p|r|e|k|i|q|b)(\d+)\s*(fe|pro|plus|max|lite|ultra|gt|se|neo|5g|4g|i|s|g|t|c)\b/gi,
    '$1$2 $3'
  );
  return t;
}

const BRAND_ALIASES = {
  ip: ['iphone'],
  iphone: ['ip'],
  sam: ['samsung', 'galaxy'],
  samsung: ['sam', 'galaxy'],
  galaxy: ['sam', 'samsung'],
  rm: ['redmi', 'xiaomi'],
  redmi: ['rm', 'xiaomi'],
  xiaomi: ['rm', 'redmi', 'xm'],
  op: ['oppo'],
  oppo: ['op'],
  vo: ['vivo'],
  vivo: ['vo'],
  '1+': ['oneplus'],
  oneplus: ['1+'],
  real: ['realme'],
  realme: ['real'],
  xm: ['xiaomi', 'redmi'],
  poc: ['poco'],
  poco: ['poc'],
  moto: ['motorola'],
  motorola: ['moto'],
};

function matchModelString(query, model) {
  const qNorm = normalizeText(query);
  const mNorm = normalizeText(model);

  const qTokens = qNorm.split(/\s+/).filter(Boolean);
  if (qTokens.length === 0) return { isMatch: false, score: 1 };

  const qBrands = new Set();
  const qModelTokens = [];

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
    const hasBrand = Array.from(qBrands).some((b) => mNorm.includes(b));
    if (!hasBrand) return { isMatch: false, score: 1 };
  }

  if (qModelTokens.length === 0) {
    return { isMatch: true, score: 0.1 };
  }

  for (const qt of qModelTokens) {
    const qtUnspaced = qt.replace(/\s+/g, '');
    const endsWithDigit = /\d$/.test(qt);
    const patternStr =
      '\\b' +
      qt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      (endsWithDigit ? '(?!\\d)' : '\\b');
    const pattern = new RegExp(patternStr, 'i');

    const mUnspaced = mNorm.replace(/\s+/g, '');
    const patternUnspacedStr =
      '\\b' +
      qtUnspaced.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      (endsWithDigit ? '(?!\\d)' : '\\b');
    const patternUnspaced = new RegExp(patternUnspacedStr, 'i');

    const isTokenMatch = pattern.test(mNorm) || patternUnspaced.test(mUnspaced);
    if (!isTokenMatch) {
      return { isMatch: false, score: 1 };
    }
  }

  if (qNorm === mNorm) return { isMatch: true, score: 0.0 };
  if (mNorm.startsWith(qNorm + ' ')) return { isMatch: true, score: 0.01 };
  return { isMatch: true, score: 0.05 };
}

function findMatchingModel(group, query) {
  let bestScore = 1;
  let bestMatchedModel = null;

  for (const model of group.compatibleModels) {
    const match = matchModelString(query, model);
    if (match.isMatch && match.score < bestScore) {
      bestScore = match.score;
      bestMatchedModel = model;
    }
  }

  return bestScore < 1 ? bestMatchedModel : null;
}

function verifyGroupFields(group) {
  const required = ['id', 'boxNumber', 'displaySize', 'title', 'compatibleModels', 'stockQuantity', 'stockStatus', 'matchedModel'];
  const missing = required.filter((k) => !(k in group) || group[k] === undefined);
  if (missing.length) return false;

  if (typeof group.stockQuantity !== 'number' || group.stockQuantity < 0) return false;

  const allowedStatuses = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'NOT_COUNTED'];
  if (!allowedStatuses.includes(group.stockStatus)) return false;

  if (typeof group.matchedModel !== 'string' || !group.matchedModel.trim()) return false;

  return true;
}

const results = {};

for (const q of queries) {
  const matchedGroups = [];
  const unrelatedGroups = [];

  for (const g of groups) {
    const matchedModel = findMatchingModel(g, q);

    const decoratedGroup = {
      ...g,
      stockQuantity: g.stockQuantity ?? 0,
      stockCountVerified: g.stockCountVerified ?? false,
      stockStatus: g.stockStatus ?? (g.stockCountVerified ? (g.stockQuantity > 0 ? (g.stockQuantity <= 3 ? 'LOW_STOCK' : 'IN_STOCK') : 'OUT_OF_STOCK') : 'NOT_COUNTED'),
      matchedModel: matchedModel || undefined,
    };

    if (matchedModel) {
      matchedGroups.push(decoratedGroup);
    } else {
      const qLower = q.toLowerCase();
      if (g.compatibleModels.some((m) => m.toLowerCase().includes(qLower))) {
        unrelatedGroups.push(g);
      }
    }
  }

  const missingFields = matchedGroups.filter((g) => !verifyGroupFields(g)).map((g) => g.id);

  results[q] = {
    expectedMatchingGroups: matchedGroups.map((g) => g.id),
    actualGroupsCount: matchedGroups.length,
    unrelatedResultsCount: unrelatedGroups.length,
    missingFieldsCount: missingFields.length,
    allFieldsPresent: missingFields.length === 0,
  };
}

const integrity = {
  totalGroups: groups.length,
  totalRelationships: data.totalRelationships,
  uniqueModels: data.uniqueModels,
  multiGroupModels: data.multiGroupModels || null,
  knownDisplaySizes: groups.filter((g) => g.displaySize && g.displaySize !== 'Unknown').length,
  unknownDisplaySizes: groups.filter((g) => !g.displaySize || g.displaySize === 'Unknown').length,
};

console.log(JSON.stringify({ results, integrity }, null, 2));
