// Optional Claude-powered estimation: food photos, and dishes missing from the local table.
// The SDK is loaded on first use so the rest of the app works offline without a key.

const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm";
const MODEL = "claude-opus-5-5";

const SYSTEM = `You are a nutrition assistant for an Indian calorie-tracking app.
Estimate calories for each food item using typical Indian home-style portions and recipes
(e.g. roti ~100 kcal, 1 katori = ~150 ml bowl, dal ~150 kcal per katori) unless the
user or image indicates restaurant-style food. Use the quantity and unit given; when no
quantity is given, assume one standard serving. Use short, common dish names
(Hindi/regional names are fine, e.g. "Rajma", "Masala dosa").`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string", description: "piece, katori, bowl, plate, cup, glass, g, etc." },
          calories: { type: "number", description: "Total kcal for this quantity" },
        },
        required: ["name", "quantity", "unit", "calories"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

let clientPromise = null;
let clientKey = null;

async function getClient(apiKey) {
  if (!clientPromise || clientKey !== apiKey) {
    clientKey = apiKey;
    clientPromise = import(SDK_URL).then(
      ({ default: Anthropic }) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true }),
    );
  }
  return clientPromise;
}

async function ask(apiKey, content) {
  const client = await getClient(apiKey);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new Error("The request was declined. Try describing the food in text.");
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("No estimate returned. Please try again.");
  return JSON.parse(text).items.map((it) => ({
    name: it.name,
    qty: it.quantity,
    unit: it.unit,
    kcal: Math.round(it.calories),
    matched: true,
    source: "ai",
  }));
}

export function estimateFromText(apiKey, description) {
  return ask(apiKey, `Estimate calories for each item I ate:\n${description}`);
}

export function estimateFromImage(apiKey, base64, mediaType, note) {
  return ask(apiKey, [
    { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
    {
      type: "text",
      text: "Identify each food item in this meal photo, estimate the portion visible, and estimate its calories."
        + (note ? `\nExtra details from me: ${note}` : ""),
    },
  ]);
}

export function describeError(err) {
  const status = err?.status;
  if (status === 401) return "Invalid API key. Check it in Settings.";
  if (status === 429) return "Rate limited. Wait a moment and try again.";
  if (status >= 500) return "The AI service is busy. Try again shortly.";
  if (err instanceof TypeError) return "Couldn't reach the AI service. Check your internet connection.";
  return err?.message || "Something went wrong.";
}
