import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const participant = process.argv.includes("--participant-b") ? "participant-b" : "participant-a";
const sourcePath = path.join(root, participant, "memory-reflection.json");
const runtimeDir = path.join(root, ".runtime", participant === "participant-b" ? "participant-b-park-memory-build" : "park-memory-build");
const checkpointPath = path.join(runtimeDir, "checkpoint.json");
const auditPath = path.join(root, participant, "park-memory-build-audit.json");
const dryRun = process.argv.includes("--dry-run");
const apiKey = process.env.OPENAI_API_KEY;
const generationModel = process.env.PARK_MEMORY_MODEL || "gpt-5.6-luna";
const embeddingModel = process.env.PARK_EMBEDDING_MODEL || "text-embedding-ada-002";
const reflectionThreshold = 150;
const questionCount = 3;
const insightsPerReflection = 5;
const retrievedPerQuestion = 15;

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const observations = source.memory_stream
  .map((item) => ({ ...item }))
  .sort((a, b) => a.chronological_order - b.chronological_order);

if (dryRun) {
  console.log(JSON.stringify({
    status: "ready",
    observations: observations.length,
    existing_reflections_ignored: source.reflections?.length || 0,
    importance_requests_before_reflections: observations.length,
    reflection_threshold: reflectionThreshold,
    question_count: questionCount,
    insights_per_reflection: insightsPerReflection,
    retrieved_per_question: retrievedPerQuestion,
    generation_model: generationModel,
    embedding_model: embeddingModel,
    ground_truth_access: false,
  }, null, 2));
  process.exit(0);
}

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not configured. Set it in the environment; never store it in this project.");
}

await fs.mkdir(runtimeDir, { recursive: true });
let checkpoint;
try {
  checkpoint = JSON.parse(await fs.readFile(checkpointPath, "utf8"));
} catch {
  checkpoint = {
    version: "1.0.0",
    generation_model_requested: generationModel,
    embedding_model_requested: embeddingModel,
    importance: {},
    embeddings: {},
    reflection_cycles: [],
    api_log: [],
  };
}
if (checkpoint.generation_model_requested !== generationModel || checkpoint.embedding_model_requested !== embeddingModel) {
  throw new Error("Checkpoint model configuration differs from the requested configuration. Remove .runtime/park-memory-build to start a new build.");
}

// Embeddings are fetched concurrently during reflection retrieval. Serialise
// checkpoint writes so concurrent callers never race over one temporary file.
let checkpointSaveQueue = Promise.resolve();
function saveCheckpoint() {
  const write = async () => {
    const tmp = `${checkpointPath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(checkpoint, null, 2)}\n`);
    await fs.rename(tmp, checkpointPath);
  };
  checkpointSaveQueue = checkpointSaveQueue.then(write, write);
  return checkpointSaveQueue;
}

async function apiRequest(endpoint, body, label, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(data)}`);
      checkpoint.api_log.push({ label, endpoint, response_id: data.id || null, returned_model: data.model || null, usage: data.usage || null });
      await saveCheckpoint();
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** (attempt - 1)));
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastError}`);
}

function outputJson(response) {
  const text = response.output?.flatMap((entry) => entry.content || []).find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error(`Response ${response.id || "unknown"} contained no output_text`);
  return JSON.parse(text);
}

async function structuredResponse({ label, system, user, name, schema }) {
  const response = await apiRequest("responses", {
    model: generationModel,
    reasoning: { effort: "none" },
    store: false,
    input: [{ role: "system", content: system }, { role: "user", content: user }],
    text: { format: { type: "json_schema", name, strict: true, schema } },
  }, label);
  return { parsed: outputJson(response), response_id: response.id, returned_model: response.model, usage: response.usage || null };
}

const importanceSystem = "Rate the likely poignancy or importance of one memory for the person experiencing it. Use an integer from 1 to 10, where 1 is purely mundane (for example, brushing teeth or making a bed) and 10 is extremely poignant (for example, a breakup or college acceptance). Assess only the supplied memory. Do not infer missing facts or use external information.";
async function importance(id, text, kind) {
  if (checkpoint.importance[id]) return checkpoint.importance[id].rating;
  const result = await structuredResponse({
    label: `importance:${id}`,
    system: importanceSystem,
    user: `Memory: ${text}\nRating:`,
    name: "memory_importance_rating",
    schema: { type: "object", properties: { rating: { type: "integer", minimum: 1, maximum: 10 } }, required: ["rating"], additionalProperties: false },
  });
  checkpoint.importance[id] = { kind, rating: result.parsed.rating, response_id: result.response_id, returned_model: result.returned_model, usage: result.usage };
  await saveCheckpoint();
  return result.parsed.rating;
}

async function embedding(id, text) {
  if (checkpoint.embeddings[id]) return checkpoint.embeddings[id];
  const result = await apiRequest("embeddings", { model: embeddingModel, input: text, encoding_format: "float" }, `embedding:${id}`);
  const vector = result.data?.[0]?.embedding;
  if (!Array.isArray(vector)) throw new Error(`Embedding ${id} contained no vector`);
  checkpoint.embeddings[id] = vector;
  await saveCheckpoint();
  return vector;
}

function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return dot / (Math.sqrt(aa) * Math.sqrt(bb) || 1);
}

function minmax(values) {
  const min = Math.min(...values), max = Math.max(...values);
  if (max === min) return values.map(() => 1);
  return values.map((value) => (value - min) / (max - min));
}

let temporalOrder = 0;
async function retrieve(records, query, cycleIndex, questionIndex) {
  const queryVector = await embedding(`query-c${cycleIndex}-q${questionIndex}`, query);
  const vectors = await Promise.all(records.map((record) => embedding(record.id, record.text)));
  const relevance = minmax(vectors.map((vector) => cosine(queryVector, vector)));
  const importanceScores = minmax(records.map((record) => record.importance));
  const recency = minmax(records.map((record) => 0.995 ** Math.max(0, temporalOrder - record.last_access_order)));
  const selected = records.map((record, index) => ({ record, score: relevance[index] + importanceScores[index] + recency[index] }))
    .sort((a, b) => b.score - a.score || b.record.creation_order - a.record.creation_order)
    .slice(0, retrievedPerQuestion);
  for (const { record } of selected) record.last_access_order = ++temporalOrder;
  return selected;
}

async function reflect(records, cycleIndex) {
  const recent = records.slice(-100);
  const questionResult = await structuredResponse({
    label: `reflection-questions:${cycleIndex}`,
    system: "Generate salient high-level questions that can be answered using only the supplied memory records. Do not use outside information.",
    user: `Given only the information below, what are the ${questionCount} most salient high-level questions we can answer about the subjects in the statements?\n\n${recent.map((r) => `${r.id}: ${r.text}`).join("\n")}`,
    name: "reflection_questions",
    schema: { type: "object", properties: { questions: { type: "array", minItems: questionCount, maxItems: questionCount, items: { type: "string" } } }, required: ["questions"], additionalProperties: false },
  });

  const retrievedByQuestion = [];
  const union = new Map();
  for (let i = 0; i < questionResult.parsed.questions.length; i++) {
    const question = questionResult.parsed.questions[i];
    const retrieved = await retrieve(records, question, cycleIndex, i + 1);
    retrievedByQuestion.push({ question, records: retrieved.map(({ record, score }) => ({ id: record.id, score })) });
    for (const { record } of retrieved) union.set(record.id, record);
  }
  const evidence = [...union.values()];
  const validIds = evidence.map((record) => record.id);
  const insightResult = await structuredResponse({
    label: `reflection-insights:${cycleIndex}`,
    system: "Derive high-level insights using only the supplied statements. Every insight must cite one or more supporting record IDs. Do not introduce outside information.",
    user: `Statements:\n${evidence.map((r) => `${r.id}: ${r.text}`).join("\n")}\n\nWhat ${insightsPerReflection} high-level insights can you infer from the statements?`,
    name: "reflection_insights",
    schema: {
      type: "object",
      properties: { insights: { type: "array", minItems: insightsPerReflection, maxItems: insightsPerReflection, items: { type: "object", properties: { insight: { type: "string" }, supporting_record_ids: { type: "array", minItems: 1, items: { type: "string", enum: validIds } } }, required: ["insight", "supporting_record_ids"], additionalProperties: false } } },
      required: ["insights"], additionalProperties: false,
    },
  });
  return {
    questions: questionResult.parsed.questions,
    retrieved_by_question: retrievedByQuestion,
    insights: insightResult.parsed.insights,
    question_response_id: questionResult.response_id,
    insight_response_id: insightResult.response_id,
  };
}

const records = [];
const finalObservations = [];
const finalReflections = [];
let accumulatedImportance = 0;
let creationOrder = 0;
let reflectionCycle = 0;

for (const observation of observations) {
  const rating = await importance(observation.memory_id, observation.memory, "observation");
  observation.importance_1_to_10 = rating;
  finalObservations.push(observation);
  creationOrder++;
  records.push({ id: observation.memory_id, text: observation.memory, importance: rating, creation_order: creationOrder, last_access_order: ++temporalOrder, kind: "observation" });
  accumulatedImportance += rating;

  if (accumulatedImportance >= reflectionThreshold) {
    reflectionCycle++;
    let cycle = checkpoint.reflection_cycles.find((item) => item.cycle === reflectionCycle);
    if (!cycle) {
      cycle = { cycle: reflectionCycle, triggered_after_memory_id: observation.memory_id, accumulated_importance: accumulatedImportance, ...(await reflect(records, reflectionCycle)) };
      checkpoint.reflection_cycles.push(cycle);
      await saveCheckpoint();
    }
    for (let i = 0; i < cycle.insights.length; i++) {
      const insight = cycle.insights[i];
      const id = `ref-c${String(reflectionCycle).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      const rating = await importance(id, insight.insight, "reflection");
      creationOrder++;
      finalReflections.push({ reflection_id: id, generated_after_memory_id: observation.memory_id, reflection: insight.insight, importance_1_to_10: rating, supporting_memory_ids: insight.supporting_record_ids, reflection_cycle: reflectionCycle });
      records.push({ id, text: insight.insight, importance: rating, creation_order: creationOrder, last_access_order: ++temporalOrder, kind: "reflection" });
    }
    accumulatedImportance = 0;
  }
}

source.metadata.memory_construction = "Park_et_al_style_memory_stream_and_reflection";
source.metadata.memory_construction_version = "1.0.0";
source.retrieval.importance_scoring = { method: "independent_llm_poignancy_rating", model: generationModel, scale: "integer_1_to_10", prompt_source: "Park_et_al_2023_section_4_1" };
source.retrieval.embedding_model = embeddingModel;
source.retrieval.reflection_trigger = { cumulative_importance_threshold: reflectionThreshold, recent_records_for_question_generation: 100, questions_per_cycle: questionCount, insights_per_cycle: insightsPerReflection, retrieved_records_per_question: retrievedPerQuestion };
source.memory_stream = finalObservations;
source.reflections = finalReflections;
const finalRecordById = new Map(records.map((record) => [record.id, record]));
for (const item of source.memory_stream) item.last_access_order = finalRecordById.get(item.memory_id)?.last_access_order || item.chronological_order;
for (const item of source.reflections) item.last_access_order = finalRecordById.get(item.reflection_id)?.last_access_order || item.reflection_cycle;

const audit = {
  created_at: new Date().toISOString(),
  method: "Park_et_al_style_memory_construction",
  adaptations: [
    "Static episode order substitutes for continuously advancing sandbox time.",
    "Park et al.'s 0.995 access-recency decay is applied over discrete record and retrieval events rather than sandbox game hours.",
    `A fixed top-${retrievedPerQuestion} records is retrieved per reflection question because the paper does not prescribe a unique count for this corpus.`,
    "Reflection accumulation resets after each triggered cycle.",
  ],
  prompts: { importance_system: importanceSystem },
  requested_models: { generation: generationModel, embedding: embeddingModel },
  observation_count: finalObservations.length,
  reflection_count: finalReflections.length,
  reflection_cycles: checkpoint.reflection_cycles,
  api_log: checkpoint.api_log,
};

const sourceTmp = `${sourcePath}.tmp`, auditTmp = `${auditPath}.tmp`;
await fs.writeFile(sourceTmp, `${JSON.stringify(source, null, 2)}\n`);
await fs.writeFile(auditTmp, `${JSON.stringify(audit, null, 2)}\n`);
await fs.rename(sourceTmp, sourcePath);
await fs.rename(auditTmp, auditPath);
console.log(JSON.stringify({ status: "completed", observations: finalObservations.length, reflections: finalReflections.length, reflection_cycles: reflectionCycle, generation_model: generationModel, embedding_model: embeddingModel, audit_file: auditPath }));
