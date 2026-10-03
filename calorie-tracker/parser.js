// Turns free text like "2 roti, 1 katori dal and half bowl rice" into calorie line items
// using the local food table. Anything it can't match is returned with kcal = null.

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, quarter: 0.25, couple: 2, few: 3,
  // Hindi
  ek: 1, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
  aadha: 0.5, adha: 0.5, aadhi: 0.5, adhi: 0.5, dedh: 1.5, dhai: 2.5, dhaai: 2.5, sawa: 1.25,
};

const UNIT_WORDS = {
  katori: "katori", katoris: "katori", katoree: "katori", vati: "katori", wati: "katori",
  bowl: "bowl", bowls: "bowl",
  cup: "cup", cups: "cup",
  glass: "glass", glasses: "glass",
  plate: "plate", plates: "plate", thali: "plate",
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", nos: "piece",
  slice: "slice", slices: "slice",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", spoon: "tbsp", spoons: "tbsp", chammach: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  scoop: "scoop", scoops: "scoop",
  can: "can", cans: "can", bottle: "can",
  packet: "packet", packets: "packet", pack: "packet",
};

const SIZE_WORDS = { small: 0.7, chhota: 0.7, chhoti: 0.7, medium: 1, large: 1.3, big: 1.3, bada: 1.3, badi: 1.3, full: 1 };

const FILLER = new Set(["i", "had", "have", "ate", "eaten", "for", "my", "me", "of", "the", "some", "today", "in", "lunch", "dinner", "breakfast", "snack", "snacks", "meal", "it", "that", "that's", "thats", "all", "also", "just", "was", "is", "khaya", "khaye", "maine", "liya", "li", "tha", "thi"]);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildMatchers(foods) {
  const list = [];
  for (const food of foods) {
    for (const alias of food.aliases) {
      list.push({ food, alias, re: new RegExp(`(^|[^a-z])${escapeRe(alias)}(?=$|[^a-z])`) });
    }
  }
  // Longest alias first so "masala dosa" beats "dosa".
  return list.sort((a, b) => b.alias.length - a.alias.length);
}

let cache = null;
function matchersFor(foods) {
  if (!cache || cache.foods !== foods) cache = { foods, list: buildMatchers(foods) };
  return cache.list;
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/½/g, " 0.5 ").replace(/¼/g, " 0.25 ").replace(/¾/g, " 0.75 ")
    .replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => String(Number(a) / Number(b)))
    .replace(/\b(\d+(?:\.\d+)?|one|two|three)\s+and\s+(?:a\s+)?half\b/g, (_, n) => String((NUMBER_WORDS[n] ?? Number(n)) + 0.5))
    .replace(/\bone and a half\b/g, "1.5");
}

function splitSegments(text) {
  return normalize(text)
    // "2 roti 1 dal" -> "2 roti, 1 dal"
    .replace(/([a-z])\s+(?=\d)/g, "$1, ")
    .split(/[,;\n+&]|\band\b|\bwith\b|\bplus\b|\baur\b|\bthen\b/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function readQuantity(seg) {
  let qty = null, unit = null, grams = null, size = 1;

  const g = seg.match(/(\d+(?:\.\d+)?)\s*(g|gm|gms|gram|grams|ml)\b/);
  if (g) grams = Number(g[1]);

  const tokens = seg.split(/\s+/);
  tokens.forEach((t, i) => {
    if (qty === null && !g && /^\d+(\.\d+)?$/.test(t)) qty = Number(t);
    // "do" (Hindi two) only counts when it starts the phrase, to avoid the English word.
    else if (qty === null && (NUMBER_WORDS[t] !== undefined || (t === "do" && i === 0))) qty = t === "do" ? 2 : NUMBER_WORDS[t];
    if (!unit && UNIT_WORDS[t]) unit = UNIT_WORDS[t];
    if (SIZE_WORDS[t]) size = SIZE_WORDS[t];
  });
  return { qty, unit, grams, size };
}

function findFoods(seg, matchers) {
  const found = [];
  let rest = ` ${seg} `;
  for (let guard = 0; guard < 4; guard++) {
    const hit = matchers.find((m) => m.re.test(rest));
    if (!hit) break;
    found.push(hit.food);
    rest = rest.replace(hit.re, "$1 ");
  }
  return found;
}

function caloriesFor(food, { qty, unit, grams, size }, volumes) {
  const n = qty ?? 1;
  let kcal, shownQty, shownUnit;
  if (grams !== null && food.g) {
    kcal = food.kcal * (grams / food.g);
    shownQty = grams; shownUnit = "g";
  } else if (food.unit === "g") {
    // Raw-weight foods (e.g. paneer) without a weight: assume 100 g per serving.
    const w = 100 * n * size;
    kcal = food.kcal * w;
    shownQty = w; shownUnit = "g";
  } else {
    let factor = 1;
    if (unit && unit !== food.unit && volumes[unit] && volumes[food.unit]) {
      factor = volumes[unit] / volumes[food.unit];
    }
    kcal = food.kcal * n * factor * size;
    shownQty = n; shownUnit = unit && (factor !== 1 || unit === food.unit) ? unit : food.unit;
  }
  return { kcal: Math.round(kcal), qty: shownQty, unit: shownUnit };
}

export function parseMeal(text, foods, volumes) {
  const matchers = matchersFor(foods);
  const items = [];
  for (const seg of splitSegments(text)) {
    const q = readQuantity(seg);
    const hits = findFoods(seg, matchers);
    if (!hits.length) {
      if (seg.split(/\s+/).every((t) => FILLER.has(t))) continue;
      items.push({ name: seg, qty: q.qty ?? 1, unit: q.unit ?? "serving", kcal: null, matched: false });
      continue;
    }
    hits.forEach((food, i) => {
      // The quantity spoken belongs to the first dish; extra dishes in the same phrase ("dal chawal") get 1 serving.
      const quant = i === 0 ? q : { qty: 1, unit: null, grams: null, size: q.size };
      items.push({ name: food.name, ...caloriesFor(food, quant, volumes), matched: true, source: "db" });
    });
  }
  return items;
}
