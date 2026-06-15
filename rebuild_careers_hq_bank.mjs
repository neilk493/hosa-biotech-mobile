import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const __dirname = process.cwd();
const CAREERS_SOURCE_PATH = path.join(__dirname, "careers_hq_204_source.txt");
const COMPILED_BANK_PATH = path.join(__dirname, "question_bank_compiled.js");
const PLATFORM_CONFIG_PATH = path.join(__dirname, "platform_config.json");

const CAREER_MODE_SEQUENCE = [
  {
    topicGroup: "Responsibility Match",
    sourceField: "Responsibility Match",
    questionType: "role_from_responsibility",
    careerQuestionType: "task_matching",
    difficulty: "medium",
    priorityLevel: 1,
  },
  {
    topicGroup: "Education / Certification",
    sourceField: "Education / Certification",
    questionType: "education_and_training_role_match",
    careerQuestionType: "education_training",
    difficulty: "medium",
    priorityLevel: 1,
  },
  {
    topicGroup: "Role Association",
    sourceField: "Role Association",
    questionType: "related_job_area_role_match",
    careerQuestionType: "association_match",
    difficulty: "hard",
    priorityLevel: 1,
  },
  {
    topicGroup: "Training Detail",
    sourceField: "Training Detail",
    questionType: "education_and_training_role_match",
    careerQuestionType: "education_training",
    difficulty: "medium",
    priorityLevel: 1,
  },
  {
    topicGroup: "Career Clue Match",
    sourceField: "Career Clue Match",
    questionType: "role_from_responsibility",
    careerQuestionType: "task_matching",
    difficulty: "hard",
    priorityLevel: 1,
  },
  {
    topicGroup: "Responsibility Set",
    sourceField: "Responsibility Set",
    questionType: "role_from_responsibility",
    careerQuestionType: "task_matching",
    difficulty: "hard",
    priorityLevel: 1,
  },
];

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/([A-Za-z0-9])-\s+([A-Za-z0-9])/g, "$1-$2")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function countBy(records, keyFn) {
  const counts = new Map();
  for (const record of records) {
    const key = keyFn(record) || "(blank)";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries(
    Array.from(counts.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
  );
}

function allowedInDefaultMixedPool(question) {
  if (question.manual_review) return false;
  if (["avoid_until_review", "low_priority"].includes(question.priority_tier)) return false;
  if (
    question.primary_domain === "biotechnology_industry_practices_and_careers" &&
    question.source_group !== "careers"
  ) {
    return false;
  }
  return true;
}

function parseChoiceSection(questionSection) {
  const lines = questionSection
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, "    ").trimEnd())
    .filter((line) => line.trim() && !/^[\u2500-\u257f\s-]+$/.test(line.trim()));

  const questionLines = [];
  const choices = [];
  let currentChoice = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const choiceMatch = trimmed.match(/^([A-E])\.\s*(.*)$/);
    if (choiceMatch) {
      if (currentChoice) {
        currentChoice.text = normalizeWhitespace(currentChoice.text);
        choices.push(currentChoice);
      }
      currentChoice = {
        letter: choiceMatch[1],
        text: choiceMatch[2] || "",
      };
      continue;
    }

    if (currentChoice) {
      currentChoice.text = `${currentChoice.text} ${trimmed}`;
    } else {
      questionLines.push(trimmed);
    }
  }

  if (currentChoice) {
    currentChoice.text = normalizeWhitespace(currentChoice.text);
    choices.push(currentChoice);
  }

  return {
    questionText: normalizeWhitespace(questionLines.join(" ")),
    choices,
  };
}

function parseQuestionBank(text) {
  const cleaned = text
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"');

  const questionRegex = /#(\d+):\s*([\s\S]*?)Correct answer:\s*([A-E])\.\s*(.+?)\r?\nExplanation:\s*([\s\S]*?)(?=\r?\n#\d+:|$)/g;
  const parsed = [];
  let match;

  while ((match = questionRegex.exec(cleaned)) !== null) {
    const questionNumber = Number(match[1]);
    const questionSection = match[2];
    const correctLetter = match[3];
    const correctAnswerText = normalizeWhitespace(match[4]);
    const explanation = normalizeWhitespace(
      match[5]
        .split(/\r?\n/)
        .filter((line) => line.trim() && !/^[\u2500-\u257f\s-]+$/.test(line.trim()))
        .join(" ")
    );

    const { questionText, choices } = parseChoiceSection(questionSection);
    parsed.push({
      questionNumber,
      questionText,
      choices,
      correctLetter,
      correctAnswerText,
      explanation,
    });
  }

  if (parsed.length !== 204) {
    throw new Error(`Expected 204 parsed careers questions, found ${parsed.length}.`);
  }

  for (const item of parsed) {
    if (item.choices.length !== 5) {
      throw new Error(`Question #${item.questionNumber} does not have exactly 5 choices.`);
    }
    const correctChoice = item.choices.find((choice) => choice.letter === item.correctLetter);
    if (!correctChoice) {
      throw new Error(`Question #${item.questionNumber} is missing its correct letter ${item.correctLetter}.`);
    }
    if (normalizeWhitespace(correctChoice.text) !== item.correctAnswerText) {
      throw new Error(`Question #${item.questionNumber} correct answer text does not match the keyed choice.`);
    }
  }

  for (let groupStart = 0; groupStart < parsed.length; groupStart += 6) {
    const group = parsed.slice(groupStart, groupStart + 6);
    const sourceCareer = group[0].correctAnswerText;
    group.forEach((item, index) => {
      item.sourceCareer = sourceCareer;
      item.mode = CAREER_MODE_SEQUENCE[index];
      item.questionId = `CAREER-HQ-${String(item.questionNumber).padStart(4, "0")}`;
    });
  }

  return parsed;
}

function toLockedCareerRecords(parsed) {
  return parsed.map((item) => {
    const distractors = item.choices
      .filter((choice) => choice.letter !== item.correctLetter)
      .map((choice) => choice.text);

    return {
      questionId: item.questionId,
      visibleQuestion: item.questionText,
      choices: item.choices.map((choice) => ({ letter: choice.letter, text: choice.text })),
      correctAnswer: item.correctLetter,
      correctChoiceText: item.correctAnswerText,
      explanation: item.explanation,
      sourceCareer: item.sourceCareer,
      sourceField: item.mode.sourceField,
      sourceFile: path.basename(CAREERS_SOURCE_PATH),
      sourceUrl: "",
      questionType: item.mode.questionType,
      difficulty: item.mode.difficulty,
      priorityLevel: item.mode.priorityLevel,
      testedFact: item.correctAnswerText,
      relatedCareers: distractors.join("; "),
      distractorQualityNotes: "Imported from the audited 204-question careers bank provided by the user.",
      needsManualReview: false,
      hiddenMeta: {
        sourceId: `careers_hq_204_${slugify(item.sourceCareer)}_${String((item.questionNumber - 1) % 6 + 1).padStart(2, "0")}`,
      },
    };
  });
}

function toCompiledCareerRecords(lockedRecords) {
  return lockedRecords.map((record, index) => ({
    corpus_id: `CAREERHQ-${String(index + 1).padStart(4, "0")}`,
    source_name: "Careers High-Quality Bank (204)",
    source_file: CAREERS_SOURCE_PATH,
    source_type: "standalone_bank",
    source_platform: "careers_hq_204",
    source_group: "careers",
    chapter_or_category: record.sourceCareer,
    topic_group: record.sourceField,
    question_text: record.visibleQuestion,
    choices: record.choices.map((choice) => ({
      letter_original: choice.letter,
      text: choice.text,
    })),
    choice_count: record.choices.length,
    choice_texts: record.choices.map((choice) => choice.text),
    correct_answer_text: record.correctChoiceText,
    correct_letter_original: record.correctAnswer,
    explanation: record.explanation,
    source_cue: `Careers HQ 204 / ${record.sourceCareer} / ${record.sourceField}`,
    primary_domain: "biotechnology_industry_practices_and_careers",
    domain_confidence: "high",
    priority_tier: "high_yield_seed",
    priority_weight_base: 6,
    manual_review: false,
    manual_review_reason: "",
    slc_sqt_anchor: false,
    slc_sqt_anchor_name: "",
    tags: [
      "biotechnology_industry_practices_and_careers",
      "high_yield_seed",
      "careers_hq_204",
      `career:${slugify(record.sourceCareer)}`,
      `career_mode:${slugify(record.sourceField)}`,
    ],
    notes: `Replaced legacy careers bank with attached audited 204-question high-quality bank. Original ID ${record.questionId}.`,
    career_question_type: record.questionType === "education_and_training_role_match"
      ? "education_training"
      : "task_matching",
    shuffle_safe: true,
    metadata_boosts: {
      gold_anchor: false,
      high_yield_seed: true,
      manual_scored_high: false,
      provisional_high: false,
    },
  }));
}

function loadCompiledState() {
  const code = fs.readFileSync(COMPILED_BANK_PATH, "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(code, context);
  return {
    bank: Array.isArray(context.window.HOSA_BIOTECH_QUESTION_BANK) ? context.window.HOSA_BIOTECH_QUESTION_BANK : [],
    summary: context.window.HOSA_BIOTECH_BANK_SUMMARY || {},
  };
}

function writeCompiledState(bank, config) {
  const generatedAt = new Date().toISOString();
  const defaultUsableQuestions = bank.filter(allowedInDefaultMixedPool).length;
  const summary = {
    generatedAt,
    totalQuestions: bank.length,
    defaultUsableQuestions,
    sourceCounts: countBy(bank, (question) => question.source_name),
    domainCounts: countBy(bank, (question) => question.primary_domain),
    priorityCounts: countBy(bank, (question) => question.priority_tier),
    config: {
      ...config,
      generated_at: generatedAt,
      default_usable_question_count: defaultUsableQuestions,
    },
  };

  const payload = `window.HOSA_BIOTECH_QUESTION_BANK = ${JSON.stringify(bank, null, 2)};\nwindow.HOSA_BIOTECH_BANK_SUMMARY = ${JSON.stringify(summary, null, 2)};\n`;
  fs.writeFileSync(COMPILED_BANK_PATH, payload, "utf8");

  const nextConfig = {
    ...config,
    generated_at: generatedAt,
    default_usable_question_count: defaultUsableQuestions,
  };
  fs.writeFileSync(PLATFORM_CONFIG_PATH, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");

  return summary;
}

function main() {
  if (!fs.existsSync(CAREERS_SOURCE_PATH)) {
    throw new Error(`Missing careers source file: ${CAREERS_SOURCE_PATH}`);
  }

  const sourceText = fs.readFileSync(CAREERS_SOURCE_PATH, "utf8");
  const parsedQuestions = parseQuestionBank(sourceText);
  const lockedRecords = toLockedCareerRecords(parsedQuestions);
  const compiledCareers = toCompiledCareerRecords(lockedRecords);

  const { bank: existingBank } = loadCompiledState();
  const firstCareerIndex = existingBank.findIndex((question) => question.source_group === "careers");
  const nonCareerBank = existingBank.filter((question) => question.source_group !== "careers");
  const before = firstCareerIndex >= 0 ? existingBank.slice(0, firstCareerIndex).filter((question) => question.source_group !== "careers") : nonCareerBank;
  const after = firstCareerIndex >= 0 ? existingBank.slice(firstCareerIndex).filter((question) => question.source_group !== "careers") : [];
  const rebuiltBank = firstCareerIndex >= 0
    ? [...before, ...compiledCareers, ...after]
    : [...nonCareerBank, ...compiledCareers];

  const currentConfig = JSON.parse(fs.readFileSync(PLATFORM_CONFIG_PATH, "utf8"));
  const summary = writeCompiledState(rebuiltBank, currentConfig);

  console.log(JSON.stringify({
    careersReplaced: compiledCareers.length,
    totalQuestions: summary.totalQuestions,
    defaultUsableQuestions: summary.defaultUsableQuestions,
    careersSourceName: "Careers High-Quality Bank (204)",
  }, null, 2));
}

main();
