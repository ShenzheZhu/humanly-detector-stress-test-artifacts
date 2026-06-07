import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const rawRoot = path.join(root, "raw");
const dataRoot = path.join(root, "data");

const cases = {
  c1: {
    construction: "Human-generated original",
    documentClass: "HUMAN_ONLY",
    compliance: "C",
    sourceNote:
      "Pre-2017 or legacy English human seeds from public Reddit writing posts, Wikiversity old revisions, and ICLR 2017 OpenReview reviews.",
  },
  c2: {
    construction: "Human-generated + AI-polished",
    documentClass: "MIXED",
    compliance: "C",
    sourceNote: "Preprocessed C1 ready text transformed with meaning-preserving AI polish.",
  },
  c3: {
    construction: "Human-generated non-English + AI-translated",
    documentClass: "MIXED",
    compliance: "C",
    sourceNote: "Non-English public-domain Project Gutenberg seeds translated to English.",
  },
  c4: {
    construction: "Human-generated AI-style text",
    documentClass: "HUMAN_ONLY",
    compliance: "C",
    sourceNote:
      "Topic-aligned human responses written in an AI-associated style with no-AI confirmation.",
  },
  n1: {
    construction: "AI-generated original",
    documentClass: "AI_ONLY",
    compliance: "NC",
    sourceNote: "AI generation from C1-aligned extracted topics and length buckets.",
  },
  n2: {
    construction: "AI-generated + human-polished",
    documentClass: "MIXED",
    compliance: "NC",
    sourceNote:
      "N1 AI drafts polished by human editors with no-additional-AI confirmation.",
  },
  n3: {
    construction: "AI-generated non-English + AI-translated",
    documentClass: "AI_ONLY",
    compliance: "NC",
    sourceNote:
      "AI generation from C3-aligned extracted topics followed by AI translation to English.",
  },
  n4: {
    construction: "AI-generated human-style text",
    documentClass: "AI_ONLY",
    compliance: "NC",
    sourceNote: "AI generation from C4-aligned extracted topics and length buckets.",
  },
};

const sourceFamilies = [
  {
    family: "reddit_writing_posts",
    cases: "C1",
    note: "Timestamped public Reddit writing posts selected from the pre-2017 era when available.",
    url: "https://www.reddit.com/r/writing/",
  },
  {
    family: "wikiversity_old_revisions",
    cases: "C1",
    note: "Legacy Wikiversity revisions accessed through page history.",
    url: "https://en.wikiversity.org/wiki/Help:Page_history",
  },
  {
    family: "iclr_2017_openreview",
    cases: "C1",
    note: "ICLR 2017 public OpenReview review/forum pages.",
    url: "https://openreview.net/group?id=ICLR.cc/2017/conference",
  },
  {
    family: "project_gutenberg_non_english",
    cases: "C3",
    note: "Public-domain non-English seed snippets. Sampled Project Gutenberg IDs: 2000, 14155, 17489, 2650.",
    url: "https://www.gutenberg.org/",
  },
  {
    family: "human_collected_topic_aligned",
    cases: "C4,N2",
    note: "De-identified human-written or human-edited texts collected with topic and length alignment.",
    url: "",
  },
  {
    family: "ai_generated_topic_aligned",
    cases: "N1,N3,N4",
    note: "AI-generated texts produced from extracted topic prompts aligned with the corresponding C case.",
    url: "",
  },
];

const overallMetrics = [
  ["Opus 4.8", 34.2, 52.9, 33.3, 60.8],
  ["GPTZero", 47.5, 85.4, 26.7, 2.5],
  ["Pangram", 45.4, 86.7, 25.0, 1.7],
];

const caseMetrics = [
  ["C1", "Human-generated original", 93.3, 93.3, "", "", 100.0, 100.0, "", "", 100.0, 100.0, "", ""],
  ["N1", "AI-generated original", 26.7, 36.7, "", "", 100.0, 100.0, "", "", 100.0, 100.0, "", ""],
  ["C2", "Human-generated + AI-polished", 20.0, 80.0, "", "", 6.7, 93.3, "", "", 0.0, 100.0, "", ""],
  ["N2", "AI-generated + human-polished", 30.0, 36.7, "", "", 96.7, 100.0, "", "", 100.0, 100.0, "", ""],
  ["C3", "Human-generated non-English + AI-translated", 33.3, 66.7, "", "", 0.0, 100.0, "", "", 0.0, 100.0, "", ""],
  ["N3", "AI-generated non-English + AI-translated", 23.3, 46.7, "", "", 76.7, 90.0, "", "", 63.3, 96.7, "", ""],
  ["C4", "Human-generated AI-style text", 26.7, 26.7, "", "", 0.0, 0.0, "", "", 0.0, 0.0, "", ""],
  ["N4", "AI-generated human-style text", 20.0, 36.7, "", "", 0.0, 100.0, "", "", 0.0, 96.7, "", ""],
  ["Overall", "All cases", 34.2, 52.9, 33.3, 60.8, 47.5, 85.4, 26.7, 2.5, 45.4, 86.7, 25.0, 1.7],
];

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function writeCsv(file, rows) {
  fs.writeFileSync(file, rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n");
}

function wordCount(text) {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

fs.mkdirSync(dataRoot, { recursive: true });

const gptzeroDir = path.join(rawRoot, "gptzero");
const pangramDir = path.join(rawRoot, "pangram");
const files = fs.readdirSync(gptzeroDir).filter((file) => file.endsWith(".json")).sort();
const samples = [];

for (const file of files) {
  const match = file.match(/^([cn]\d)_(short|medium|long)_(\d{2})\.json$/);
  if (!match) continue;
  const [, caseId, lengthBucket, taskSet] = match;
  const caseInfo = cases[caseId];
  if (!caseInfo) throw new Error(`Unknown case in ${file}`);

  const gptzero = readJson(path.join(gptzeroDir, file));
  const pangramPath = path.join(pangramDir, file);
  if (!fs.existsSync(pangramPath)) throw new Error(`Missing Pangram file for ${file}`);
  const pangram = readJson(pangramPath);
  const text = gptzero.documents?.[0]?.inputText;
  if (typeof text !== "string" || !text.trim()) throw new Error(`Missing GPTZero inputText in ${file}`);
  if (pangram.text?.trim() !== text.trim()) throw new Error(`GPTZero/Pangram text mismatch in ${file}`);

  samples.push({
    id: file.replace(/\.json$/, ""),
    case: caseId.toUpperCase(),
    construction: caseInfo.construction,
    length_bucket: lengthBucket,
    task_set: Number(taskSet),
    document_class: caseInfo.documentClass,
    compliance_label: caseInfo.compliance,
    word_count: wordCount(text),
    char_count: text.length,
    source_note: caseInfo.sourceNote,
    text,
  });
}

if (samples.length !== 240) {
  throw new Error(`Expected 240 samples, found ${samples.length}`);
}

fs.writeFileSync(
  path.join(dataRoot, "samples.jsonl"),
  samples.map((sample) => JSON.stringify(sample)).join("\n") + "\n",
);

writeCsv(path.join(dataRoot, "sample_manifest.csv"), [
  ["id", "case", "construction", "length_bucket", "task_set", "document_class", "compliance_label", "word_count", "char_count", "source_note"],
  ...samples.map((s) => [s.id, s.case, s.construction, s.length_bucket, s.task_set, s.document_class, s.compliance_label, s.word_count, s.char_count, s.source_note]),
]);

writeCsv(path.join(dataRoot, "cases.csv"), [
  ["case", "construction", "document_class", "compliance_label", "source_note"],
  ...Object.entries(cases).map(([caseId, c]) => [caseId.toUpperCase(), c.construction, c.documentClass, c.compliance, c.sourceNote]),
]);

writeCsv(path.join(dataRoot, "source_families.csv"), [
  ["family", "cases", "note", "url"],
  ...sourceFamilies.map((s) => [s.family, s.cases, s.note, s.url]),
]);

writeCsv(path.join(dataRoot, "overall_metrics.csv"), [
  ["predictor", "doc_acc_pct", "policy_acc_pct", "fpr_pct", "fnr_pct"],
  ...overallMetrics,
]);

writeCsv(path.join(dataRoot, "case_metrics.csv"), [
  [
    "case",
    "construction",
    "opus_doc_acc_pct",
    "opus_policy_acc_pct",
    "opus_fpr_pct",
    "opus_fnr_pct",
    "gptzero_doc_acc_pct",
    "gptzero_policy_acc_pct",
    "gptzero_fpr_pct",
    "gptzero_fnr_pct",
    "pangram_doc_acc_pct",
    "pangram_policy_acc_pct",
    "pangram_fpr_pct",
    "pangram_fnr_pct",
  ],
  ...caseMetrics,
]);

console.log(`Wrote ${samples.length} samples and summary tables.`);
