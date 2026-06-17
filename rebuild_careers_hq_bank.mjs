import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const __dirname = process.cwd();
const CAREERS_SOURCE_PATH = path.join(__dirname, "careers_final_v6_last_polish_source.txt");
const SECOND_EDITION_SOURCE_PATH = path.join(__dirname, "second_edition_update_source.txt");
const SECOND_EDITION_EXTRA_SOURCE_PATH = path.join(__dirname, "second_edition_update_source_101_250.txt");
const COMPILED_BANK_PATH = path.join(__dirname, "question_bank_compiled.js");
const PLATFORM_CONFIG_PATH = path.join(__dirname, "platform_config.json");

const RETAINED_CAREER_FIELDS = new Set([
  "Responsibility Match",
  "Education / Certification",
  "Training Detail",
]);

const CAREER_MODE_SEQUENCE = [
  {
    topicGroup: "Responsibility Match",
    sourceField: "Responsibility Match",
    questionType: "role_from_responsibility",
    careerQuestionType: "task_matching",
  },
  {
    topicGroup: "Education / Certification",
    sourceField: "Education / Certification",
    questionType: "education_and_training_role_match",
    careerQuestionType: "education_training",
  },
  {
    topicGroup: "Role Association",
    sourceField: "Role Association",
    questionType: "related_job_area_role_match",
    careerQuestionType: "association_match",
  },
  {
    topicGroup: "Training Detail",
    sourceField: "Training Detail",
    questionType: "education_and_training_role_match",
    careerQuestionType: "education_training",
  },
  {
    topicGroup: "Career Clue Match",
    sourceField: "Career Clue Match",
    questionType: "role_from_responsibility",
    careerQuestionType: "task_matching",
  },
  {
    topicGroup: "Responsibility Set",
    sourceField: "Responsibility Set",
    questionType: "role_from_responsibility",
    careerQuestionType: "task_matching",
  },
];

const SECOND_EDITION_SECTION_ALIASES = new Map([
  ["crispr-cas9", "CRISPR-Cas9"],
  ["golden gate, gibson, and topo/ta cloning", "Cloning and Assembly Methods"],
  ["digital pcr and isothermal amplification", "Digital PCR and Isothermal Amplification"],
  ["next-generation sequencing", "Next-Generation Sequencing"],
  ["dna barcoding and species identification", "DNA Barcoding and Species Identification"],
  ["car t-cell therapy and newer immunology applications", "CAR T and Current Immunology Applications"],
  ["fluorometric dna quantitation, regulation, and integrated current topics", "Fluorometric Quantitation, Regulation, and Current Topics"],
  ["golden gate, gibson, topo/ta, and cloning method traps", "Cloning and Assembly Methods"],
  ["digital pcr, ddpcr, and quantification traps", "Digital PCR and Isothermal Amplification"],
  ["isothermal amplification", "Digital PCR and Isothermal Amplification"],
  ["ngs: library prep, chemistry, data terms", "Next-Generation Sequencing"],
  ["dna barcoding and sequence identification", "DNA Barcoding and Species Identification"],
  ["fluorometric dna quantitation and sample quality", "Fluorometric Quantitation, Regulation, and Current Topics"],
  ["car t and current therapeutic biotech", "CAR T and Current Immunology Applications"],
  ["mixed hard integration", "Mixed Current-Methods Integration"],
]);

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

function stripMarkdownDecorators(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function repairSecondEditionEncoding(value) {
  return String(value || "")
    .replace(/\u2192/g, "->")
    .replace(/\u2032/g, "'")
    .replace(/\u2033/g, '"')
    .replace(/\u03b2/g, "beta")
    .replace(/\u03bc/g, "u")
    .replace(/\u207a/g, "+")
    .replace(/\u2265/g, ">=")
    .replace(/\u2264/g, "<=")
    .replace(/\u2014|\u2013/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u00a0/g, " ");
  /*
  return String(value || "")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€™|â€˜/g, "'")
    .replace(/â€“|â€”/g, "-")
    .replace(/â€¢/g, "-")
    .replace(/â€¦/g, "...")
    .replace(/â†’/g, "->")
    .replace(/Î²|β/g, "beta")
    .replace(/Âµ|μ/g, "u")
    .replace(/â‰¥/g, ">=")
    .replace(/â‰¤/g, "<=")
    .replace(/â€³/g, '"')
    .replace(/â€²/g, "'")
    .replace(/â€"/g, "-")
    .replace(/\u2192/g, "->")
    .replace(/\u2032/g, "'")
    .replace(/\u2033/g, '"')
    .replace(/\u03b2/g, "beta")
    .replace(/\u2014|\u2013/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u00a0/g, " ");
  */
}

function extractAfterColon(questionText) {
  const colonIndex = questionText.indexOf(":");
  if (colonIndex < 0) return normalizeWhitespace(questionText.replace(/\?$/, ""));
  return normalizeWhitespace(questionText.slice(colonIndex + 1).replace(/\?$/, ""));
}

function extractCareerClue(questionText) {
  const match = questionText.match(/clues:\s*(.+?)\s*Which career/i);
  if (match) return normalizeWhitespace(match[1]);
  return extractAfterColon(questionText);
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

function inferCareerV6Mode(questionText) {
  const text = normalizeWhitespace(questionText).toLowerCase();
  const educationPattern = /(education|training|coursework|certification|certificate|license|licensing|degree|associate|bachelor|ged|high school|hazmat|alat|latg?|haccp|gmp|ich-gcp)/;
  if (educationPattern.test(text)) {
    return {
      topicGroup: "Education / Certification",
      sourceField: "Education / Certification",
      questionType: "education_and_training_role_match",
      careerQuestionType: "education_training",
    };
  }

  return {
    topicGroup: "Responsibility Match",
    sourceField: "Responsibility Match",
    questionType: "role_from_responsibility",
    careerQuestionType: "task_matching",
  };
}

function extractCareerV6Clue(questionText) {
  const normalized = normalizeWhitespace(questionText).replace(/\?$/, "");
  const colonIndex = normalized.indexOf(":");
  if (colonIndex >= 0) {
    return normalizeWhitespace(normalized.slice(colonIndex + 1));
  }

  return normalized
    .replace(/^Which career\s+/i, "")
    .replace(/^(is|may|can|best matches|best fit|best aligns with)\s+/i, (match) => match.trimEnd())
    .trim();
}

const CAREER_STOPWORDS = new Set([
  "which", "career", "best", "matches", "match", "is", "most", "associated", "with", "this", "that",
  "may", "can", "often", "work", "works", "using", "uses", "use", "while", "and", "or", "the", "a",
  "an", "to", "of", "for", "from", "in", "on", "at", "as", "after", "before", "during", "through",
  "plus", "when", "where", "whose", "role", "related", "context", "centers", "focuses", "focused",
  "centered", "directly", "closely", "tied", "linked", "best", "fit", "fits", "require", "requires",
  "required", "involves", "involving", "centering", "specific", "specificly", "commonly", "usually",
]);

function tokenizeCareerText(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && !CAREER_STOPWORDS.has(token) && (token.length > 2 || /\d/.test(token)));
}

function buildLegacyCareerProfiles(existingBank) {
  const profiles = new Map();

  function ensureProfile(career) {
    if (!profiles.has(career)) {
      profiles.set(career, {
        career,
        clues: [],
      });
    }
    return profiles.get(career);
  }

  existingBank
    .filter((question) => question.source_group === "careers")
    .forEach((question) => {
      const correctCareer = question.correct_answer_text;
      const correctCareerIsChoice = (question.choices || []).some((choice) => choice.text === correctCareer);
      if (correctCareerIsChoice) {
        const profile = ensureProfile(correctCareer);
        const questionClue = extractCareerV6Clue(question.question_text);
        if (!profile.clues.some((entry) => normalizeWhitespace(entry) === questionClue)) {
          profile.clues.push(questionClue);
        }
        const explanationClue = normalizeWhitespace(question.explanation || "");
        if (explanationClue && !profile.clues.some((entry) => normalizeWhitespace(entry) === explanationClue)) {
          profile.clues.push(explanationClue);
        }
      }

      (question.choices || []).forEach((choice) => {
        const choiceProfile = ensureProfile(choice.text);
        const lines = Array.isArray(choice.choice_context) ? choice.choice_context : [];
        lines.forEach((line) => {
          const normalizedLine = normalizeWhitespace(line);
          const prefix = `${choice.text} - `;
          const clue = normalizedLine.startsWith(prefix)
            ? normalizeWhitespace(normalizedLine.slice(prefix.length))
            : normalizedLine;
          if (clue && !choiceProfile.clues.some((entry) => normalizeWhitespace(entry) === clue)) {
            choiceProfile.clues.push(clue);
          }
        });
      });
    });

  return profiles;
}

function scoreCareerChoice(questionText, choiceText, legacyCareerProfiles) {
  const profile = legacyCareerProfiles.get(choiceText);
  if (!profile) return 0;

  const questionClue = extractCareerV6Clue(questionText);
  const questionNormalized = normalizeWhitespace(questionClue).toLowerCase();
  const questionTokens = tokenizeCareerText(questionClue);
  if (!questionTokens.length) return 0;

  let score = 0;
  for (const clue of profile.clues) {
    const clueNormalized = normalizeWhitespace(clue).toLowerCase();
    const clueTokens = tokenizeCareerText(clue);
    const clueTokenSet = new Set(clueTokens);
    const overlap = questionTokens.filter((token) => clueTokenSet.has(token));
    const longOverlap = overlap.filter((token) => token.length >= 6).length;
    const exactPhrase = clueNormalized === questionNormalized;
    const containsPhrase = clueNormalized.includes(questionNormalized) || questionNormalized.includes(clueNormalized);
    score = Math.max(
      score,
      overlap.length * 18 + longOverlap * 7 + (exactPhrase ? 50 : 0) + (containsPhrase ? 20 : 0)
    );
  }

  return score;
}

const CAREER_V6_OVERRIDE_RULES = [
  { pattern: /(sequencing libraries|blast|ncbi|nanopore|minion|illumina|sanger sequencing?)/i, career: "Genomics Technician" },
  { pattern: /(county extension agent|animal-feed testing|crop\/animal sample protocols)/i, career: "Agricultural Technician" },
  { pattern: /(whole biotech plants|pollinates flowers|waters beds|weeds beds|aphis-regulated plant material|rooted plants|monitors pests)/i, career: "Greenhouse or Field Technician" },
  { pattern: /(micropropagation|laminar flow hoods|sterile lab plant propagation|propagate plant clippings on agar|aseptic propagation of plants)/i, career: "Plant Tissue Culture Technician" },
  { pattern: /(atcc-supplied cells|tumor biopsies|umbilical-cord tissue|mammalian cell lines|fluorescence microscopy of stained cells|primary cell lines)/i, career: "Cell Culture Technician" },
  { pattern: /(ich-gcp|study-site monitoring|informed consent forms|case report forms|patient safety during study-site monitoring|50-75% travel)/i, career: "Clinical Research Associate" },
  { pattern: /(capa|regulatory submissions|regulation updates|laws, regulatory requirements, submissions)/i, career: "Compliance Specialist" },
  { pattern: /(metrology|asq calibration technician|pressure, flow, force, torque, humidity, mass, and electrical parameters|calibration certificates|out-of-tolerance reports|analytical balances, centrifuges, incubators, and conductivity meters)/i, career: "Instrumentation / Calibration Technician" },
  { pattern: /(hvac|plumbing|refrigeration|boiler-operations|water purification|air filtering systems|building utilities|fire hydrants|booster stations|wells, valves)/i, career: "Facilities Technician" },
  { pattern: /(epa standards|water treatment plant operator|potable water|wastewater|recreational, potable, and wastewater|sampling taps)/i, career: "Water Quality Technician" },
  { pattern: /(industrial hygiene|workplace exposure monitoring|workplace incidents|chemical and radioactive waste|hazmat certification when inspecting environmental sites)/i, career: "Environmental Health & Safety Technician" },
  { pattern: /(pollution and contamination sources affecting public health|radon|samples air, water, and the workplace environment|state or local governments, testing laboratories, or consulting firms)/i, career: "Environmental Science and Protection Technician" },
  { pattern: /(lims|analytical chemistry|raw materials, components, and finished products|chemical quality specifications|daily bench work testing raw materials, packaging materials, and finished products chemically)/i, career: "Quality Control Technician - Chemistry" },
  { pattern: /(autoclave, aseptic technique, and antibody techniques in a qc setting|microbial contaminants|sterility|microbiology lab sops|finished packaged product|assays, autoclave, aseptic technique)/i, career: "Quality Control Technician - Microbiology" },
  { pattern: /(pouching, kitting, loading machines|entry-level production role|controlled repetitive production-support tasks|clean-room supplies and orders needed laboratory items)/i, career: "Manufacturing Assistant" },
  { pattern: /(harvested, tested, purified, and packaged|buffers, concentrates proteins|ultrafiltration and diafiltration|post-harvest production work|downstream staff)/i, career: "Biomanufacturing Technician - Downstream" },
  { pattern: /(viable cell concentration before product harvest|controlled growth before harvest|bioreactors and microbial cells in fermenters|sterile media and monitors ph, temperature, and dissolved oxygen during production growth)/i, career: "Biomanufacturing Technician - Upstream" },
  { pattern: /(chromatography, hplc, and fplc|protein purity|narrower than downstream manufacturing and centered on protein purity|protein-purification work)/i, career: "Purification Technician" },
  { pattern: /(scale-up to improve yield|larger batches|manufacturing-development results|scientific two-year degree plus process-development experience)/i, career: "Process Development Associate" },
  { pattern: /(medical science products such as devices|medical devices|coronary artery stents|orthopedic devices|dental products|surgical products)/i, career: "Product Development Technician" },
  { pattern: /(quality systems, records, equipment, storage areas, and step sign-offs|prevent manufacturing mistakes|monitors qc technicians and oversees their record keeping|quality reports after monitoring qc work)/i, career: "Quality Assurance Specialist" },
  { pattern: /(controlled documents|batch records|document histories|master copies of controlled documents|archives scanned records|sop revisions)/i, career: "QA Documentation Coordinator" },
  { pattern: /(scientific products and services|customer-facing|phone or email about scientific products and services|sales and marketing staff while solving technical product problems|demonstrate products for customers)/i, career: "Technical Services Representative" },
  { pattern: /(ethanol|biodiesel|grain preparation|algae culture|oil chemistry|fuel-production work|control panels and gauges while converting raw materials into ethanol)/i, career: "Biofuel Technician" },
];

function inferCareerByOverride(questionText, choices) {
  for (const rule of CAREER_V6_OVERRIDE_RULES) {
    if (rule.pattern.test(questionText)) {
      const match = choices.find((choice) => normalizeWhitespace(choice.text) === normalizeWhitespace(rule.career));
      if (match) return match;
    }
  }
  return null;
}

function inferCareerCorrectChoice(questionText, choices, legacyCareerProfiles) {
  const scored = choices.map((choice) => ({
    choice,
    score: scoreCareerChoice(questionText, choice.text, legacyCareerProfiles),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.choice.letter.localeCompare(b.choice.letter);
  });

  if (!scored.length || scored[0].score <= 0) {
    const override = inferCareerByOverride(questionText, choices);
    if (override) return override;
    throw new Error(`Unable to infer a defensible keyed answer for career V6 stem: ${questionText}`);
  }

  return scored[0].choice;
}

function buildCareerV6Explanation(questionText, correctAnswerText) {
  const text = normalizeWhitespace(questionText).toLowerCase();
  if (/(education|training|coursework|certification|certificate|license|degree|associate|bachelor|ged|high school|alat|latg?|haccp)/.test(text)) {
    return `${correctAnswerText} is correct because the education, certification, or training clue in the stem most directly matches that role.`;
  }
  if (/(associated with|most associated|closely associated|tied to)/.test(text)) {
    return `${correctAnswerText} is correct because the association in the stem is most specifically tied to that career's responsibilities, tools, or work setting.`;
  }
  return `${correctAnswerText} is correct because the responsibility, workflow, or work environment described in the stem most directly matches that career.`;
}

function extractCareerV6AnswerKey(text) {
  const answerMap = new Map();
  const cleaned = String(text || "")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/â€”/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"');

  for (const rawLine of cleaned.split(/\r?\n/)) {
    const trimmed = normalizeWhitespace(rawLine);
    const keyMatch = trimmed.match(/^(\d{1,3})\.\s*([A-E])\s*(?:-|—)\s*(.+)$/i);
    if (!keyMatch) continue;
    answerMap.set(Number(keyMatch[1]), {
      letter: keyMatch[2].toUpperCase(),
      answerText: normalizeWhitespace(keyMatch[3]),
    });
  }

  return answerMap;
}

function parseCareerQuestionBank(text, legacyCareerProfiles) {
  const cleaned = String(text || "")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/â€”/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u00d7/g, "x");

  const answerKey = extractCareerV6AnswerKey(cleaned);
  const lines = cleaned.split(/\r?\n/);
  const parsed = [];
  let currentQuestionNumber = null;
  let currentBlock = [];
  let currentCorrectLetter = "";
  let inAnswerKeySection = false;

  function finalizeCareerQuestion() {
    if (!currentQuestionNumber) return;
    const questionSection = currentBlock.join("\n");
    const { questionText, choices } = parseChoiceSection(questionSection);
    if (!questionText) {
      throw new Error(`Career V6 question #${currentQuestionNumber} is missing question text.`);
    }
    if (choices.length !== 5) {
      throw new Error(`Career V6 question #${currentQuestionNumber} does not have exactly 5 choices.`);
    }
    if (!currentCorrectLetter) {
      const keyed = answerKey.get(currentQuestionNumber);
      if (keyed) {
        currentCorrectLetter = keyed.letter;
      } else {
        const inferredChoice = inferCareerCorrectChoice(questionText, choices, legacyCareerProfiles);
        currentCorrectLetter = inferredChoice.letter;
      }
    }

    const correctChoice = choices.find((choice) => choice.letter === currentCorrectLetter);
    if (!correctChoice) {
      throw new Error(`Career V6 question #${currentQuestionNumber} is missing its keyed letter ${currentCorrectLetter}.`);
    }

    const mode = inferCareerV6Mode(questionText);
    const correctAnswerText = normalizeWhitespace(correctChoice.text);
    parsed.push({
      questionNumber: currentQuestionNumber,
      questionText,
      choices,
      correctLetter: currentCorrectLetter,
      correctAnswerText,
      explanation: buildCareerV6Explanation(questionText, correctAnswerText),
      sourceCareer: correctAnswerText,
      mode,
      questionId: `CAREER-V6-${String(currentQuestionNumber).padStart(4, "0")}`,
    });

    currentQuestionNumber = null;
    currentBlock = [];
    currentCorrectLetter = "";
  }

  for (const rawLine of lines) {
    const trimmed = String(rawLine || "").trim();
    if (!trimmed) continue;
    if (/^hosa biotechnology careers/i.test(trimmed)) continue;
    if (/^purpose:/i.test(trimmed)) continue;
    if (/^format:/i.test(trimmed)) continue;
    if (/^design rules used:/i.test(trimmed)) continue;
    if (/^total:/i.test(trimmed)) continue;
    if (/^answer distribution:/i.test(trimmed)) continue;
    if (/^questions$/i.test(trimmed)) continue;
    if (/^answer key$/i.test(trimmed)) {
      finalizeCareerQuestion();
      inAnswerKeySection = true;
      continue;
    }
    if (/^audit$/i.test(trimmed)) {
      finalizeCareerQuestion();
      inAnswerKeySection = true;
      continue;
    }
    if (inAnswerKeySection) continue;

    const questionMatch = trimmed.match(/^#(\d+)$/);
    if (questionMatch) {
      finalizeCareerQuestion();
      currentQuestionNumber = Number(questionMatch[1]);
      continue;
    }

    const correctMatch = trimmed.match(/^Correct answer:\s*([A-E])(?:\.\s*(.+))?$/i);
    if (correctMatch) {
      currentCorrectLetter = correctMatch[1].toUpperCase();
      continue;
    }

    if (currentQuestionNumber) {
      currentBlock.push(rawLine);
    }
  }

  finalizeCareerQuestion();

  if (parsed.length !== 204) {
    throw new Error(`Expected 204 parsed careers questions, found ${parsed.length}.`);
  }
  if (answerKey.size < 204) {
    throw new Error(`Expected at least 204 answer-key entries in the careers V6 source, found ${answerKey.size}.`);
  }

  return parsed;
}

function buildCareerProfiles(parsedQuestions) {
  const profiles = new Map();

  function ensureProfile(career) {
    if (!profiles.has(career)) {
      profiles.set(career, {
        career,
        responsibilityMatch: [],
        educationCertification: [],
        allClues: [],
      });
    }
    return profiles.get(career);
  }

  parsedQuestions.forEach((item) => {
    const profile = ensureProfile(item.sourceCareer);
    const clue = extractCareerV6Clue(item.questionText);
    if (!profile.allClues.some((entry) => normalizeWhitespace(entry) === clue)) {
      profile.allClues.push(clue);
    }
    if (item.mode.sourceField === "Education / Certification") {
      if (!profile.educationCertification.some((entry) => normalizeWhitespace(entry) === clue)) {
        profile.educationCertification.push(clue);
      }
    } else if (!profile.responsibilityMatch.some((entry) => normalizeWhitespace(entry) === clue)) {
      profile.responsibilityMatch.push(clue);
    }
  });

  return profiles;
}

function toLockedCareerRecords(parsedQuestions) {
  return parsedQuestions.map((item) => {
    const distractors = item.choices
      .filter((choice) => choice.letter !== item.correctLetter)
      .map((choice) => choice.text);

    return {
      questionId: item.questionId,
      questionNumber: item.questionNumber,
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
      careerQuestionType: item.mode.careerQuestionType,
      testedFact: item.correctAnswerText,
      relatedCareers: distractors.join("; "),
      hiddenMeta: {
        sourceId: `careers_v6_${String(item.questionNumber).padStart(4, "0")}_${slugify(item.sourceCareer)}`,
      },
    };
  });
}

function buildCareerChoiceContextLines(question, choiceText, careerProfiles) {
  const profile = careerProfiles.get(choiceText);
  if (!profile) return [];

  const preferred = question.topic_group === "Education / Certification"
    ? profile.educationCertification
    : profile.responsibilityMatch;
  const merged = [...preferred, ...profile.allClues];
  const unique = [];
  for (const clue of merged) {
    const normalized = normalizeWhitespace(clue);
    if (!normalized) continue;
    if (unique.some((entry) => normalizeWhitespace(entry) === normalized)) continue;
    unique.push(clue);
    if (unique.length >= 3) break;
  }
  return unique.map((clue) => `${choiceText} - ${clue}`);
}

function toCompiledCareerRecords(lockedRecords, careerProfiles) {
  return lockedRecords.map((record, index) => {
    const question = {
      topic_group: record.sourceField,
    };

    return {
      corpus_id: `CAREERV6-${String(index + 1).padStart(4, "0")}`,
      source_name: "Careers Final V6 Last-Polish (204)",
      source_file: CAREERS_SOURCE_PATH,
      source_type: "standalone_bank",
      source_platform: "careers_final_v6_last_polish",
      source_group: "careers",
      chapter_or_category: record.sourceCareer,
      topic_group: record.sourceField,
      question_text: record.visibleQuestion,
      choices: record.choices.map((choice) => ({
        letter_original: choice.letter,
        text: choice.text,
        choice_context: buildCareerChoiceContextLines(question, choice.text, careerProfiles),
      })),
      choice_count: record.choices.length,
      choice_texts: record.choices.map((choice) => choice.text),
      correct_answer_text: record.correctChoiceText,
      correct_letter_original: record.correctAnswer,
      explanation: record.explanation,
      source_cue: `Careers V6 / Q${record.questionNumber} / ${record.sourceCareer}`,
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
        "careers_final_v6_last_polish",
        `career:${slugify(record.sourceCareer)}`,
        `career_mode:${slugify(record.sourceField)}`,
      ],
      notes: `Imported from the short-association careers v6 last-polish bank. Original ID ${record.questionId}.`,
      career_question_type: record.careerQuestionType,
      shuffle_safe: true,
      metadata_boosts: {
        gold_anchor: false,
        high_yield_seed: true,
        manual_scored_high: false,
        provisional_high: false,
      },
    };
  });
}

function canonicalSecondEditionSection(rawLine) {
  const normalized = normalizeWhitespace(stripMarkdownDecorators(repairSecondEditionEncoding(rawLine))).toLowerCase();
  return SECOND_EDITION_SECTION_ALIASES.get(normalized) || "";
}

function parseSecondEditionQuestions(rawText) {
  const lines = repairSecondEditionEncoding(rawText).split(/\r?\n/);
  const questions = [];
  let currentSection = "";
  let currentQuestion = null;
  let currentChoice = null;

  function finalizeCurrentQuestion() {
    if (!currentQuestion) return;
    if (currentChoice) {
      currentChoice.text = normalizeWhitespace(stripMarkdownDecorators(currentChoice.text));
      currentQuestion.choices.push(currentChoice);
      currentChoice = null;
    }
    currentQuestion.questionText = normalizeWhitespace(stripMarkdownDecorators(currentQuestion.questionText));
    if (
      currentQuestion.questionNumber &&
      currentQuestion.questionText &&
      currentQuestion.choices.length >= 4 &&
      currentQuestion.correctLetter
    ) {
      const correctChoice = currentQuestion.choices.find((choice) => choice.letter === currentQuestion.correctLetter);
      if (!correctChoice) {
        throw new Error(`Second-edition question ${currentQuestion.questionNumber} is missing its keyed choice.`);
      }
      currentQuestion.correctAnswerText = normalizeWhitespace(stripMarkdownDecorators(correctChoice.text));
      currentQuestion.section = currentQuestion.section || currentSection || "Second-Edition Update";
      questions.push(currentQuestion);
    }
    currentQuestion = null;
  }

  for (const rawLine of lines) {
    const trimmed = normalizeWhitespace(stripMarkdownDecorators(rawLine));
    if (!trimmed) continue;
    if (/^\[1\]:\s*https?:/i.test(trimmed)) continue;
    if (/^one issue i caught while writing:/i.test(trimmed)) continue;
    if (/^for your study copy,\s*mark/i.test(trimmed)) continue;
    if (/^##\s+100 second-edition update questions$/i.test(trimmed)) continue;
    if (/^\d{1,3}\s*-\s*\d{1,3}\s+second-edition update questions$/i.test(trimmed)) continue;
    if (/^---+$/.test(trimmed)) continue;

    const section = canonicalSecondEditionSection(trimmed.replace(/^#+\s*/, ""));
    if (section) {
      finalizeCurrentQuestion();
      currentSection = section;
      continue;
    }

    const questionMatch = trimmed.match(/^(?:\*\*)?(\d{1,3})\.(?:\*\*)?\s*(.+)$/);
    if (questionMatch) {
      finalizeCurrentQuestion();
      currentQuestion = {
        questionNumber: Number(questionMatch[1]),
        questionText: questionMatch[2],
        choices: [],
        correctLetter: "",
        section: currentSection || "Second-Edition Update",
      };
      currentChoice = null;
      continue;
    }

    if (!currentQuestion) continue;

    const choiceMatch = trimmed.match(/^([A-E])\.\s*(.+)$/);
    if (choiceMatch) {
      if (currentChoice) {
        currentChoice.text = normalizeWhitespace(stripMarkdownDecorators(currentChoice.text));
        currentQuestion.choices.push(currentChoice);
      }
      currentChoice = {
        letter: choiceMatch[1],
        text: choiceMatch[2],
      };
      continue;
    }

    const correctMatch = trimmed.match(/^Correct answer:\s*([A-E])$/i);
    if (correctMatch) {
      if (currentChoice) {
        currentChoice.text = normalizeWhitespace(stripMarkdownDecorators(currentChoice.text));
        currentQuestion.choices.push(currentChoice);
        currentChoice = null;
      }
      currentQuestion.correctLetter = correctMatch[1].toUpperCase();
      continue;
    }

    if (/^Correction:/i.test(trimmed)) {
      continue;
    }

    if (currentChoice) {
      currentChoice.text = `${currentChoice.text} ${trimmed}`;
    } else {
      currentQuestion.questionText = `${currentQuestion.questionText} ${trimmed}`;
    }
  }

  finalizeCurrentQuestion();

  if (questions.length !== 250) {
    throw new Error(`Expected 250 parsed second-edition questions, found ${questions.length}.`);
  }

  return questions;
}

function inferSecondEditionDomain(section, questionText, correctAnswerText) {
  const text = normalizeWhitespace(`${section} ${questionText} ${correctAnswerText}`).toLowerCase();

  if (/(car t|cd19|cytokine release syndrome|chimeric antigen receptor|t cells)/.test(text)) {
    return { domain: "immunological_applications", confidence: "high" };
  }

  if (/(digital pcr|ddpcr|droplet|partition|poisson|lamp|rpa|hda|isothermal|qcr|qpcr|pcr)/.test(text)) {
    return { domain: "polymerase_chain_reaction", confidence: "high" };
  }

  if (/(golden gate|gibson|topo|ta cloning|type iis|bsa[i1]|overhang|vector|ligase|cloning)/.test(text)) {
    return { domain: "bacterial_transformation", confidence: "high" };
  }

  if (/(ngs|sequencing|illumina|pyrosequencing|ion semiconductor|paired-end|library|adapter|cluster|flow cell|coi|barcode|barcoding|its region|rbcl|matk|bioinformatics)/.test(text)) {
    return { domain: "dna_structure_and_analysis", confidence: "high" };
  }

  if (/(fluorometric|fluorometer|a260|a280|quantitation|absorbance|double-stranded dna fluorometric|gel-based dna quantitation)/.test(text)) {
    return { domain: "basic_laboratory_skills", confidence: "high" };
  }

  if (/(glp|gmp|regulated biomanufacturing|regulatory)/.test(text)) {
    return { domain: "governmental_regulation_of_biotechnology", confidence: "medium" };
  }

  if (/personalized medicine/.test(text)) {
    return { domain: "biotechnology_in_health", confidence: "medium" };
  }

  if (/(crispr|cas9|pam|sgrna|tracrrna|dcas9|nhej|hdr)/.test(text)) {
    return { domain: "dna_structure_and_analysis", confidence: "high" };
  }

  if (section === "CRISPR-Cas9") return { domain: "dna_structure_and_analysis", confidence: "high" };
  if (section === "Cloning and Assembly Methods") return { domain: "bacterial_transformation", confidence: "high" };
  if (section === "Digital PCR and Isothermal Amplification") return { domain: "polymerase_chain_reaction", confidence: "high" };
  if (section === "Next-Generation Sequencing") return { domain: "dna_structure_and_analysis", confidence: "high" };
  if (section === "DNA Barcoding and Species Identification") return { domain: "dna_structure_and_analysis", confidence: "high" };
  if (section === "CAR T and Current Immunology Applications") return { domain: "immunological_applications", confidence: "high" };
  if (section === "Fluorometric Quantitation, Regulation, and Current Topics") return { domain: "basic_laboratory_skills", confidence: "medium" };

  return { domain: "dna_structure_and_analysis", confidence: "medium" };
}

function buildSecondEditionExplanation(section, questionText, correctAnswerText) {
  const text = normalizeWhitespace(questionText).toLowerCase();
  const answer = normalizeWhitespace(correctAnswerText);

  if (/pam/.test(text)) return `${answer} is correct because the common SpCas9 system requires a nearby PAM before efficient target recognition and cutting.`;
  if (/guide rna/.test(text)) return `${answer} is correct because the guide RNA sets targeting specificity by base-pairing with the intended DNA sequence.`;
  if (/non-homologous end joining|nhej|indel|frameshift/.test(text)) return `${answer} is correct because NHEJ often creates small insertions or deletions that can disrupt the coding frame.`;
  if (/homology-directed repair|hdr|donor template/.test(text)) return `${answer} is correct because HDR uses a donor template to place a designed sequence at the cut site.`;
  if (/sgRNA|tracrRNA/.test(text)) return `${answer} is correct because sgRNA combines the targeting function of crRNA with the Cas9-binding scaffold normally supported by tracrRNA.`;
  if (/type iis|golden gate/.test(text)) return `${answer} is correct because Golden Gate assembly uses Type IIS enzymes that cut outside their recognition sites to create designed overhangs.`;
  if (/gibson/.test(text) && /overlap|overlapping/.test(text)) return `${answer} is correct because Gibson assembly joins fragments through overlapping homologous ends.`;
  if (/gibson/.test(text) && /exonuclease/.test(text)) return `${answer} is correct because Gibson assembly depends on exonuclease, polymerase, and ligase working together on overlapping fragments.`;
  if (/topo|ta cloning|t overhang|a overhang/.test(text)) return `${answer} is correct because TA/TOPO cloning relies on Taq-style A overhangs and a prepared vector that captures the PCR product quickly.`;
  if (/digital pcr|partition|positive.*negative|poisson|droplet/.test(text)) return `${answer} is correct because digital PCR works by partitioning the sample and interpreting positive versus negative endpoint reactions.`;
  if (/qPCR|Cq|threshold/.test(text)) return `${answer} is correct because qPCR is based on amplification curves and threshold behavior, unlike endpoint partition counting in digital PCR.`;
  if (/lamp/.test(text)) return `${answer} is correct because LAMP uses multiple primers and strand-displacing polymerase at a constant temperature.`;
  if (/\brpa\b|recombinase/.test(text)) return `${answer} is correct because RPA uses recombinase-driven primer invasion rather than standard thermal cycling.`;
  if (/\bhda\b|helicase/.test(text)) return `${answer} is correct because helicase-dependent amplification separates strands enzymatically instead of repeated high-temperature denaturation.`;
  if (/adapter|library/.test(text)) return `${answer} is correct because library preparation adds known adapter sequences so fragments can be amplified, bound, and sequenced.`;
  if (/bridge pcr|cluster|flow cell/.test(text)) return `${answer} is correct because bridge amplification forms clusters on a solid surface rather than in droplets on beads.`;
  if (/reversible terminator|sequencing by synthesis|illumina/.test(text)) return `${answer} is correct because reversible terminators allow one base to be added, read, and then chemically unblocked for the next cycle.`;
  if (/ddntp|sanger/.test(text)) return `${answer} is correct because Sanger ddNTPs permanently terminate extension by removing the 3'-OH needed for the next bond.`;
  if (/pyrosequencing|pyrophosphate/.test(text)) return `${answer} is correct because pyrosequencing detects pyrophosphate released during nucleotide incorporation.`;
  if (/ion semiconductor|h\+|ph change/.test(text)) return `${answer} is correct because ion semiconductor sequencing reads the hydrogen ions released during nucleotide incorporation.`;
  if (/ligation/.test(text) && /sequencing/.test(text)) return `${answer} is correct because sequencing by ligation uses labeled oligonucleotide probes and DNA ligase rather than standard polymerase-based base calling.`;
  if (/coverage|depth/.test(text)) return `${answer} is correct because coverage refers to how many reads represent a given position on average.`;
  if (/index|barcode|multiplex/.test(text)) return `${answer} is correct because sample indexing lets pooled reads be assigned back to the correct source sample after sequencing.`;
  if (/paired-end/.test(text)) return `${answer} is correct because paired-end sequencing reads both ends of the same fragment to improve alignment and interpretation.`;
  if (/coi|cytochrome c oxidase/.test(text)) return `${answer} is correct because COI is the standard animal barcode target used in the fish-identification workflow.`;
  if (/its region|fungi/.test(text)) return `${answer} is correct because ITS is the common fungal barcode region rather than the standard animal COI target.`;
  if (/rbcl|matk|plant barcode/.test(text)) return `${answer} is correct because rbcL and matK are the classic plant barcode loci.`;
  if (/mislabeled|substitution|seafood/.test(text)) return `${answer} is correct because DNA barcoding is especially useful for revealing seafood substitution when visible traits are gone.`;
  if (/car t|cd19|cytokine release syndrome|antigen-binding domain|autologous/.test(text)) return `${answer} is correct because CAR T therapy uses engineered T cells and immunology-specific targeting features to recognize tumor antigens.`;
  if (/a260|a280|fluorometric|fluorometer/.test(text)) return `${answer} is correct because UV absorbance and fluorometric assays measure nucleic-acid quantity differently and can diverge when contaminants are present.`;
  if (/\bgmp\b|\bglp\b/.test(text)) return `${answer} is correct because this item is distinguishing regulated manufacturing or laboratory quality systems rather than a molecular method.`;

  if (section === "CRISPR-Cas9") return `${answer} is correct because it is the CRISPR-related factor, mechanism, or historical association described in the stem.`;
  if (section === "Cloning and Assembly Methods") return `${answer} is correct because it matches the cloning or DNA-assembly mechanism described in the question.`;
  if (section === "Digital PCR and Isothermal Amplification") return `${answer} is correct because it fits the amplification or quantification mechanism described in the stem.`;
  if (section === "Next-Generation Sequencing") return `${answer} is correct because it matches the sequencing chemistry, library concept, or analysis term described in the item.`;
  if (section === "DNA Barcoding and Species Identification") return `${answer} is correct because it matches the barcode target, workflow, or species-identification use described in the question.`;
  if (section === "CAR T and Current Immunology Applications") return `${answer} is correct because it matches the engineered-cell therapy concept described in the stem.`;
  if (section === "Fluorometric Quantitation, Regulation, and Current Topics") return `${answer} is correct because it best matches the newer quantitation, regulation, or current-method detail being tested.`;
  return `${answer} is correct because it is the best match for the mechanism, feature, or application described in the stem.`;
}

function toSecondEditionCompiledRecords(parsedQuestions) {
  return parsedQuestions.map((item, index) => {
    const { domain, confidence } = inferSecondEditionDomain(item.section, item.questionText, item.correctAnswerText);
    return {
      corpus_id: `SE2-${String(index + 1).padStart(4, "0")}`,
      source_name: "Second-Edition Update Bank (250)",
      source_file: `${SECOND_EDITION_SOURCE_PATH}; ${SECOND_EDITION_EXTRA_SOURCE_PATH}`,
      source_type: "standalone_bank",
      source_platform: "second_edition_update",
      source_group: "second_edition_update",
      chapter_or_category: item.section,
      topic_group: item.section,
      question_text: item.questionText,
      choices: item.choices.map((choice) => ({
        letter_original: choice.letter,
        text: normalizeWhitespace(stripMarkdownDecorators(choice.text)),
      })),
      choice_count: item.choices.length,
      choice_texts: item.choices.map((choice) => normalizeWhitespace(stripMarkdownDecorators(choice.text))),
      correct_answer_text: item.correctAnswerText,
      correct_letter_original: item.correctLetter,
      explanation: buildSecondEditionExplanation(item.section, item.questionText, item.correctAnswerText),
      source_cue: `Second-Edition Update Set / ${item.section} / Q${item.questionNumber}`,
      primary_domain: domain,
      domain_confidence: confidence,
      priority_tier: "high_yield_seed",
      priority_weight_base: 6,
      manual_review: false,
      manual_review_reason: "",
      slc_sqt_anchor: false,
      slc_sqt_anchor_name: "",
      tags: [
        "second_edition_update",
        item.section,
        domain,
        "high_yield_seed",
      ],
      notes: item.questionNumber === 93
        ? "Imported from the user-provided second-edition update set. Inline correction retained: question 93 answer key corrected to D."
        : "Imported from the user-provided second-edition update set.",
      career_question_type: "",
      shuffle_safe: true,
      metadata_boosts: {
        gold_anchor: false,
        high_yield_seed: true,
        manual_scored_high: false,
        provisional_high: false,
      },
    };
  });
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

function extractEntityAssociation(questionText) {
  const match = questionText.match(/:\s*(.+)$/);
  return normalizeWhitespace(match ? match[1] : questionText);
}

function buildEntityChoiceContextMaps(bank) {
  const itemToAssociations = new Map();
  const associationToItem = new Map();

  bank
    .filter((question) => question.source_group === "entity_bank")
    .forEach((question) => {
      if (question.topic_group !== "association_to_item") return;
      const category = question.chapter_or_category || "";
      const item = question.correct_answer_text;
      const association = extractEntityAssociation(question.question_text);
      const itemKey = `${category}|||${normalizeWhitespace(item)}`;
      const associationKey = `${category}|||${normalizeWhitespace(association)}`;
      const currentList = itemToAssociations.get(itemKey) || [];
      if (!currentList.some((entry) => normalizeWhitespace(entry) === normalizeWhitespace(association))) {
        currentList.push(association);
      }
      itemToAssociations.set(itemKey, currentList);
      associationToItem.set(associationKey, item);
    });

  return { itemToAssociations, associationToItem };
}

function buildChoiceContexts(bank) {
  const entityMaps = buildEntityChoiceContextMaps(bank);
  const rebuiltCareers = new Map(
    bank
      .filter((question) => question.source_group === "careers")
      .map((question) => [
        question.corpus_id,
        question,
      ])
  );

  return bank.map((question) => {
    if (!Array.isArray(question.choices)) return question;

    const nextChoices = question.choices.map((choice) => {
      if (question.source_group === "entity_bank") {
        const category = question.chapter_or_category || "";
        if (question.topic_group === "association_to_item") {
          const itemKey = `${category}|||${normalizeWhitespace(choice.text)}`;
          const linkedFacts = entityMaps.itemToAssociations.get(itemKey) || [];
          return {
            ...choice,
            choice_context: linkedFacts.slice(0, 4).concat(
              linkedFacts.length > 4 ? [`+ ${linkedFacts.length - 4} more fact(s) in this category.`] : []
            ),
          };
        }

        if (question.topic_group === "item_to_association") {
          const associationKey = `${category}|||${normalizeWhitespace(choice.text)}`;
          const linkedItem = entityMaps.associationToItem.get(associationKey);
          return {
            ...choice,
            choice_context: linkedItem ? [linkedItem] : [],
          };
        }
      }

      if (question.source_group === "careers") {
        return {
          ...choice,
          choice_context: Array.isArray(choice.choice_context) ? choice.choice_context : [],
        };
      }

      return choice;
    });

    if (question.source_group === "careers" && rebuiltCareers.has(question.corpus_id)) {
      return {
        ...question,
        choices: nextChoices,
        choice_texts: nextChoices.map((choice) => choice.text),
      };
    }

    if (question.source_group === "entity_bank") {
      return {
        ...question,
        choices: nextChoices,
        choice_texts: nextChoices.map((choice) => choice.text),
      };
    }

    return question;
  });
}

function isCareerVignetteEntityQuestion(question) {
  if (question.source_group !== "entity_bank") return false;
  if ((question.chapter_or_category || "") !== "Person") return false;

  const choiceTexts = Array.isArray(question.choice_texts)
    ? question.choice_texts
    : Array.isArray(question.choices)
      ? question.choices.map((choice) => choice.text)
      : [];

  const textBundle = [
    question.question_text || "",
    question.correct_answer_text || "",
    ...choiceTexts,
  ].join(" || ");

  return /featured as\b/i.test(textBundle);
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
  if (!fs.existsSync(SECOND_EDITION_SOURCE_PATH)) {
    throw new Error(`Missing second-edition source file: ${SECOND_EDITION_SOURCE_PATH}`);
  }
  if (!fs.existsSync(SECOND_EDITION_EXTRA_SOURCE_PATH)) {
    throw new Error(`Missing second-edition continuation source file: ${SECOND_EDITION_EXTRA_SOURCE_PATH}`);
  }

  const { bank: existingBank } = loadCompiledState();
  const legacyCareerProfiles = buildLegacyCareerProfiles(existingBank);

  const careersText = fs.readFileSync(CAREERS_SOURCE_PATH, "utf8");
  const parsedCareerQuestions = parseCareerQuestionBank(careersText, legacyCareerProfiles);
  const careerProfiles = buildCareerProfiles(parsedCareerQuestions);
  const lockedCareerRecords = toLockedCareerRecords(parsedCareerQuestions);
  const compiledCareers = toCompiledCareerRecords(lockedCareerRecords, careerProfiles);

  const secondEditionText = [
    fs.readFileSync(SECOND_EDITION_SOURCE_PATH, "utf8"),
    fs.readFileSync(SECOND_EDITION_EXTRA_SOURCE_PATH, "utf8"),
  ].join("\n\n");
  const parsedSecondEdition = parseSecondEditionQuestions(secondEditionText);
  const compiledSecondEdition = toSecondEditionCompiledRecords(parsedSecondEdition);

  const strippedBank = existingBank.filter((question) => {
    if (question.source_group === "careers") return false;
    if (question.source_group === "second_edition_update") return false;
    if (isCareerVignetteEntityQuestion(question)) return false;
    return true;
  });

  const rebuiltBank = buildChoiceContexts([
    ...strippedBank,
    ...compiledSecondEdition,
    ...compiledCareers,
  ]);

  const currentConfig = JSON.parse(fs.readFileSync(PLATFORM_CONFIG_PATH, "utf8"));
  const summary = writeCompiledState(rebuiltBank, currentConfig);

  console.log(JSON.stringify({
    careersRetained: compiledCareers.length,
    careersRemovedFromAttachedBank: 204 - compiledCareers.length,
    secondEditionAdded: compiledSecondEdition.length,
    totalQuestions: summary.totalQuestions,
    defaultUsableQuestions: summary.defaultUsableQuestions,
  }, null, 2));
}

main();
