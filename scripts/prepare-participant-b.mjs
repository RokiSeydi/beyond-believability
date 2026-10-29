import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const aDir = path.join(root, "participant-a");
const bDir = path.join(root, "participant-b");
await fs.mkdir(bDir, { recursive: true });

const swapTarget = (value) => {
  if (Array.isArray(value)) return value.map(swapTarget);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, swapTarget(v)]));
  if (typeof value !== "string") return value;
  return value
    .replaceAll("Participant A — minimal persona", "Participant B — minimal persona")
    .replaceAll("target_participant\": \"Participant A", "target_participant\": \"Participant B")
    .replaceAll("participant-a", "participant-b");
};

const graph = JSON.parse(await fs.readFile(path.join(aDir, "behavioural-graph.json"), "utf8"));
graph.metadata.target_participant = "Participant B";
await fs.writeFile(path.join(bDir, "behavioural-graph.json"), `${JSON.stringify(graph, null, 2)}\n`);

const memory = JSON.parse(await fs.readFile(path.join(aDir, "memory-reflection.json"), "utf8"));
memory.metadata.participant = "Participant B";
memory.metadata.partner = "Participant A";
delete memory.metadata.memory_construction;
await fs.writeFile(path.join(bDir, "memory-reflection.json"), `${JSON.stringify(memory, null, 2)}\n`);

const hybrid = JSON.parse(await fs.readFile(path.join(aDir, "hybrid-memory-graph.json"), "utf8"));
hybrid.metadata.participant = "Participant B";
hybrid.metadata.partner = "Participant A";
hybrid.sources = swapTarget(hybrid.sources);
await fs.writeFile(path.join(bDir, "hybrid-memory-graph.json"), `${JSON.stringify(hybrid, null, 2)}\n`);

const persona = `# Participant B — minimal persona condition

Participant B is a parent in a long-term relationship with Participant A. They share a young child and, during the observed period, move from living separately toward sharing the family home.

Participant B wants to be present in the family home and describes love in terms of respect, partnership and addressing problems together. He can experience comparisons, insults or strongly worded criticism as attacks on his character. When this happens, he often defends his contribution, focuses on the manner in which the concern was communicated, or withdraws rather than naming a vulnerable feeling directly.

Participant B values autonomy and wants meaningful authority within the household rather than only carrying out Participant A's instructions. He agrees to take greater responsibility for domestic work and parenting, while acknowledging that he is still learning some aspects of childcare. Despite recurring conflict, Participant B wants the relationship and family to succeed.

Use only this persona and the supplied evaluation situation. Do not invent demographic characteristics, diagnoses, unobserved memories or future events.
`;
await fs.writeFile(path.join(bDir, "minimal-persona.md"), persona);

const manifest = JSON.parse(await fs.readFile(path.join(root, "condition-manifest.json"), "utf8"));
manifest.experiment_id = "dyad-01-participant-b-agent-packs-v1";
manifest.participant = "Participant B";
manifest.conditions = manifest.conditions.map((c) => ({ ...c, file: c.file.replace("participant-a/", "participant-b/") }));
await fs.writeFile(path.join(root, "condition-manifest-participant-b.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({ status: "completed", participant: "Participant B", files: 5 }));
