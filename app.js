(function () {
  const STORAGE_KEY = "hosa_biotech_sim_platform_v1";
  const LETTERS = ["A", "B", "C", "D", "E"];

  const state = {
    config: null,
    bank: [],
    bankCatalog: null,
    history: null,
    currentTest: null,
    currentQuestionIndex: 0,
    timerId: null,
  };

  const dom = {};
  let storageUsable = null;

  function $(id) {
    return document.getElementById(id);
  }

  function cacheDom() {
    [
      "themeToggle",
      "modeSelect",
      "modeDescriptor",
      "bankField",
      "bankSelect",
      "subtopicField",
      "subtopicSelect",
      "bankSelectionSummary",
      "lengthSelect",
      "customLengthField",
      "customLengthInput",
      "timerEnabledToggle",
      "timerMinutesInput",
      "feedbackModeSelect",
      "priorityModeSelect",
      "answerRandomizationToggle",
      "showDomainToggle",
      "customDomainPanel",
      "customDomainGrid",
      "setupWarnings",
      "overviewStats",
      "domainBars",
      "domainAvailabilityCaption",
      "recentRoundsList",
      "savedRoundsList",
      "clearSavedRoundsBtn",
      "startSimulationBtn",
      "startNextRoundBtn",
      "resetHistoryBtn",
      "setupView",
      "testView",
      "resultsView",
      "testLayout",
      "navigatorPanel",
      "testModeChip",
      "roundTitle",
      "roundMeta",
      "progressCount",
      "answeredCount",
      "flaggedCount",
      "timerDisplay",
      "progressFill",
      "generationWarnings",
      "questionGrid",
      "submitTestBtn",
      "abandonTestBtn",
      "questionCounterChip",
      "domainChip",
      "priorityChip",
      "sourceChip",
      "crossOutModeBtn",
      "toggleNavigatorBtn",
      "questionBackdropNumber",
      "questionText",
      "questionMetaLine",
      "choiceList",
      "immediateFeedbackBox",
      "flagQuestionBtn",
      "previousQuestionBtn",
      "nextQuestionBtn",
      "jumpUnansweredBtn",
      "resultsModeChip",
      "resultsHeadline",
      "resultsSummaryText",
      "resultsJudgement",
      "resultsEncouragement",
      "scoreRing",
      "scorePercent",
      "scoreRaw",
      "resultsStats",
      "resultsDomainBars",
      "reviewList",
      "retryMissedBtn",
      "newSimulationBtn",
      "saveRoundBtn",
      "resultsBackBtn",
      "submitConfirmModal",
      "submitConfirmSummary",
      "submitConfirmCounts",
      "closeSubmitConfirmBtn",
      "cancelSubmitConfirmBtn",
      "jumpFlaggedBtn",
      "confirmSubmitBtn",
    ].forEach((id) => {
      dom[id] = $(id);
    });
  }

  function deepClone(value) {
    return window.HosaBiotechLoader.deepClone(value);
  }

  function normalize(value) {
    return window.HosaBiotechLoader.normalize(value);
  }

  function toSubtopicId(label) {
    return String(label || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "uncategorized";
  }

  const BANK_DEFINITIONS = [
    {
      id: "chapter_1",
      label: "Chapter 1",
      description: "Foundations, applications, regulation, and introductory biotechnology context.",
      match: (question) => question.source_name === "Chapter 1 Final Standalone Bank",
    },
    {
      id: "chapter_2",
      label: "Chapter 2",
      description: "Basic laboratory skills, safety, measurements, and documentation.",
      match: (question) => question.source_name === "Chapter 2 Practice Platform",
    },
    {
      id: "chapter_3",
      label: "Chapter 3",
      description: "Microbiology, cell structure, culture systems, and recombinant production.",
      match: (question) => question.source_name === "Chapter 3 Practice Platform",
    },
    {
      id: "chapter_4",
      label: "Chapter 4",
      description: "DNA structure, gene expression, restriction biology, and analysis.",
      match: (question) => question.source_name === "Chapter 4 Practice Platform",
    },
    {
      id: "chapter_5",
      label: "Chapter 5",
      description: "Transformation, plasmids, quantitation, purification, and selection.",
      match: (question) => question.source_name === "Chapter 5 Practice Platform",
    },
    {
      id: "chapter_6",
      label: "Chapter 6",
      description: "PCR history, chemistry, design, variants, sequencing, and forensics.",
      match: (question) => question.source_name === "Chapter 6 Practice Platform",
    },
    {
      id: "chapter_7",
      label: "Chapter 7",
      description: "Proteins, amino acids, transcription, translation, and analysis methods.",
      match: (question) => question.source_name === "Chapter 7 Practice Platform" || question.source_name === "Phase 2 SLC Anchor Addition",
    },
    {
      id: "chapter_8",
      label: "Chapter 8",
      description: "Immunology, antibodies, diagnostics, therapeutic antibodies, and assays.",
      match: (question) => question.source_name === "Chapter 8 Practice Platform",
    },
    {
      id: "careers_bank",
      label: "Careers Bank",
      description: "Higher-quality career questions focused on direct technician duties, responsibilities, and training details.",
      match: (question) => question.source_group === "careers",
    },
    {
      id: "artifact_entity_bank",
      label: "Artifact / Entity Bank",
      description: "People, organizations, bacteria, and year-date associations.",
      match: (question) => question.source_group === "entity_bank",
    },
    {
      id: "old_chat_master",
      label: "Old Chat Master",
      description: "Legacy master-bank review sets spanning many content domains.",
      match: (question) => question.source_group === "old_chat_master",
    },
    {
      id: "second_edition_update",
      label: "Second-Edition Update",
      description: "CRISPR, cloning assemblies, digital PCR, isothermal amplification, NGS, barcoding, CAR T, and newer second-edition topics.",
      match: (question) => question.source_group === "second_edition_update",
    },
  ];

  function includesAny(text, patterns) {
    return patterns.some((pattern) => text.includes(pattern));
  }

  function getBankDefinition(bankId) {
    return BANK_DEFINITIONS.find((bank) => bank.id === bankId) || BANK_DEFINITIONS[0];
  }

  function getBankIdForQuestion(question) {
    const match = BANK_DEFINITIONS.find((bank) => bank.match(question));
    return match ? match.id : "chapter_1";
  }

  function getDomainLabel(domain) {
    return window.HosaBiotechLoader.DOMAIN_LABELS[domain] || domain;
  }

  function inferBroadSubtopic(question, bankId = getBankIdForQuestion(question)) {
    const chapter = String(question.chapter_or_category || "");
    const topic = String(question.topic_group || "");
    const text = `${chapter} ${topic} ${question.question_text || ""}`.toLowerCase();

    if (bankId === "chapter_1") {
      if (includesAny(text, ["timeline", "first mentioned", "history", "milestone", "print", "biotechnology toolkit"])) return "History, Milestones & Core Ideas";
      if (includesAny(text, ["gmo", "regulation", "fda", "epa", "usda", "waste", "safety", "bioethic"])) return "Regulation, Safety & Ethics";
      if (includesAny(text, ["career", "industry", "company", "manufactur", "toolkit", "industry practices"])) return "Industry & Careers";
      return "Applications in Agriculture, Health & Food";
    }

    if (bankId === "chapter_2") {
      if (includesAny(text, ["notebook", "documentation", "entry", "record", "label"])) return "Documentation & Lab Records";
      if (includesAny(text, ["micropip", "pipet", "graduated cylinder", "meniscus", "erlenmeyer", "flask", "beaker", "volume", "measure"])) return "Measurement, Pipetting & Glassware";
      if (includesAny(text, ["hazard", "biohazard", "waste", "safety", "ppe", "goggle", "bsl", "prohibited"])) return "Safety, PPE & Waste";
      if (includesAny(text, ["centrifuge", "rcf", "rpm", "equipment", "reagent bottle", "pipet pump"])) return "Equipment & Lab Setup";
      return "Core Laboratory Skills";
    }

    if (bankId === "chapter_3") {
      if (includesAny(text, ["microorganism", "history", "bacteria", "mrsa", "artificial life"])) return "Microbial Foundations & History";
      if (includesAny(text, ["organelle", "organelles", "cell wall", "nucleus", "ribosome", "membrane"])) return "Cell Structure & Organelles";
      if (includesAny(text, ["cell culture", "stem cell", "eukaryotic cell culture"])) return "Cell Culture & Stem Cells";
      if (includesAny(text, ["recombinant insulin", "protein production", "somatotropin", "bioreactor"])) return "Recombinant Products & Production";
      return "Microbiology & Biotechnology Applications";
    }

    if (bankId === "chapter_4") {
      if (includesAny(text, ["central dogma", "transcription", "rna", "gene expression"])) return "Central Dogma & Gene Expression";
      if (includesAny(text, ["restriction", "sticky end", "ligase", "enzyme", "southern blot", "recombinant"])) return "Restriction Enzymes, Blotting & Recombinant DNA";
      if (includesAny(text, ["gel", "electrophoresis", "tracking dye", "standard curve", "semilog", "dna standards"])) return "Electrophoresis & Analytical Methods";
      if (includesAny(text, ["fingerprint", "forensic", "gina", "medicine", "application"])) return "Forensics, Genomics & Applications";
      return "DNA Structure & Chemistry";
    }

    if (["chapter_5", "chapter_6", "chapter_7", "chapter_8"].includes(bankId)) {
      return chapter || getDomainLabel(question.primary_domain);
    }

    if (bankId === "careers_bank") {
      const careerMap = {
        "Career Description": "Career Descriptions",
        "Education & Training": "Education & Training",
        "Knowledge Skills": "Knowledge & Skills",
        "Technical Skills": "Technical Skills",
        "Career Options": "Career Options",
        Comparison: "Role Comparison",
        "Related Job Areas": "Related Job Areas",
        "Professional Skills": "Professional Skills",
        "Responsibility Match": "Responsibility Match",
        "Education / Certification": "Education & Certification",
        "Training Detail": "Training Details",
      };
      return careerMap[topic] || "Career Review";
    }

    if (bankId === "artifact_entity_bank") {
      return chapter || "Entity Review";
    }

    if (bankId === "old_chat_master") {
      const domain = question.primary_domain;
      if (["biotechnology_industry_practices_and_careers", "biotechnology_in_health", "governmental_regulation_of_biotechnology"].includes(domain)) {
        return "Industry, Health & Regulation";
      }
      return getDomainLabel(domain);
    }

    if (bankId === "second_edition_update") {
      return chapter || topic || getDomainLabel(question.primary_domain);
    }

    return chapter || topic || getDomainLabel(question.primary_domain);
  }

  function buildBankCatalog() {
    const banks = BANK_DEFINITIONS.map((definition) => {
      const questions = state.bank
        .filter((question) => definition.match(question))
        .filter((question) => !question.manual_review && question.priority_tier !== "avoid_until_review");
      const subtopicCounts = new Map();
      questions.forEach((question) => {
        const label = inferBroadSubtopic(question, definition.id);
        subtopicCounts.set(label, (subtopicCounts.get(label) || 0) + 1);
      });

      const subtopics = [
        { id: "all_subtopics", label: "All broad subtopics", count: questions.length },
        ...Array.from(subtopicCounts.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([label, count]) => ({
            id: toSubtopicId(label),
            label,
            count,
          })),
      ];

      return {
        id: definition.id,
        label: definition.label,
        description: definition.description,
        count: questions.length,
        questions,
        subtopics,
      };
    });

    return {
      banks,
      byId: Object.fromEntries(banks.map((bank) => [bank.id, bank])),
    };
  }

  function populateBankOptions() {
    if (!state.bankCatalog) return;
    const banks = state.bankCatalog.banks;
    dom.bankSelect.innerHTML = banks
      .map((bank) => `<option value="${bank.id}">${bank.label} (${bank.count})</option>`)
      .join("");

    if (!dom.bankSelect.value && banks.length) {
      dom.bankSelect.value = banks[0].id;
    }

    populateSubtopicOptions(dom.bankSelect.value || banks[0]?.id || "");
  }

  function populateSubtopicOptions(bankId) {
    if (!state.bankCatalog) return;
    const bank = state.bankCatalog.byId[bankId] || state.bankCatalog.banks[0];
    if (!bank) return;

    dom.subtopicSelect.innerHTML = bank.subtopics
      .map((subtopic) => `<option value="${subtopic.id}">${subtopic.label} (${subtopic.count})</option>`)
      .join("");
  }

  function questionMatchesBankFilters(question, settings) {
    if (settings.mode !== "bank_practice") return true;
    if (getBankIdForQuestion(question) !== settings.selectedBankId) return false;
    if (!settings.selectedSubtopicId || settings.selectedSubtopicId === "all_subtopics") return true;
    return toSubtopicId(inferBroadSubtopic(question, settings.selectedBankId)) === settings.selectedSubtopicId;
  }

  function getSelectedBankInfo() {
    if (!state.bankCatalog) return null;
    return state.bankCatalog.byId[dom.bankSelect.value] || state.bankCatalog.banks[0] || null;
  }

  function getSelectedSubtopicInfo(bank) {
    if (!bank) return null;
    return bank.subtopics.find((item) => item.id === dom.subtopicSelect.value) || bank.subtopics[0] || null;
  }

  function getModeLabel(mode) {
    const labels = {
      hosa_weighted_full_simulation: "HOSA 50-Question Simulation",
      high_yield_only: "High-Yield Mixed Review",
      fresh_questions_only: "Unseen-Question Mixed Review",
      missed_questions: "Retry Missed / Flagged",
      weak_domains: "Weak-Domain Recovery",
      custom_domain_mix: "Custom Domain Simulation",
      bank_practice: "Single-Bank Practice",
      untimed_review_mode: "Untimed Review",
      saved_preset: "Saved Preset",
    };
    return labels[mode] || mode.replace(/_/g, " ");
  }

  function usesExactDomainDistribution(mode) {
    return ["hosa_weighted_full_simulation", "custom_domain_mix"].includes(mode);
  }

  function sessionAffectsMemory(settings) {
    return settings.feedbackMode !== "immediate_review";
  }

  function getWeakDomainSelectionSet(settings) {
    const configured = Array.from(settings?.weakDomainSet || []);
    const fallback = Object.keys(window.HosaBiotechLoader.DOMAIN_LABELS).slice(0, 4);
    return new Set(configured.length ? configured : fallback);
  }

  function getFlexibleModeCandidates(settings) {
    return state.bank.filter((question) => questionAllowed(question, settings));
  }

  function getAvailabilitySnapshot(settings) {
    if (!state.bank?.length) {
      return {
        availableCount: 0,
        requestedLength: settings.length,
        exactShortages: [],
      };
    }

    if (settings.mode === "bank_practice") {
      const bank = state.bankCatalog?.byId?.[settings.selectedBankId];
      const candidates = bank
        ? bank.questions.filter((question) => questionAllowed(question, settings))
        : [];
      return {
        availableCount: candidates.length,
        requestedLength: settings.length,
        exactShortages: [],
      };
    }

    if (usesExactDomainDistribution(settings.mode) && settings.customDistribution) {
      const byDomain = new Map();
      state.bank
        .filter((question) => questionAllowed(question, settings))
        .forEach((question) => {
          byDomain.set(question.primary_domain, (byDomain.get(question.primary_domain) || 0) + 1);
        });

      const exactShortages = Object.entries(settings.customDistribution)
        .filter(([, needed]) => needed > 0)
        .map(([domain, needed]) => {
          const available = byDomain.get(domain) || 0;
          return {
            domain,
            needed,
            available,
            short: Math.max(0, needed - available),
          };
        })
        .filter((entry) => entry.short > 0);

      return {
        availableCount: Array.from(byDomain.values()).reduce((sum, value) => sum + value, 0),
        requestedLength: settings.length,
        exactShortages,
      };
    }

    const candidates = getFlexibleModeCandidates(settings);
    return {
      availableCount: candidates.length,
      requestedLength: settings.length,
      exactShortages: [],
    };
  }

  function getAvailabilityMarkup(settings) {
    const snapshot = getAvailabilitySnapshot(settings);
    if (!snapshot) return "";

    if (usesExactDomainDistribution(settings.mode) && snapshot.exactShortages.length) {
      const shortest = snapshot.exactShortages
        .slice()
        .sort((a, b) => b.short - a.short || a.domain.localeCompare(b.domain))[0];
      const label = window.HosaBiotechLoader.DOMAIN_LABELS[shortest.domain] || shortest.domain;
      return `Exact-quota check: ${label} has ${shortest.available} eligible for a quota of ${shortest.needed}.`;
    }

    if (snapshot.availableCount < snapshot.requestedLength) {
      return `Available now: ${snapshot.availableCount} eligible question(s). This mode will use the full available pool instead of forcing ${snapshot.requestedLength}.`;
    }

    return `Available now: ${snapshot.availableCount} eligible question(s) under the current settings.`;
  }

  function getModeDescriptor(mode) {
    const bank = getSelectedBankInfo();
    const subtopic = getSelectedSubtopicInfo(bank);

    const descriptors = {
      hosa_weighted_full_simulation: {
        title: "Official-style full simulation",
        summary: "Uses the exact 50-question HOSA distribution with a timer and end-only grading.",
        detail: "Questions are randomized from the eligible mixed pool. Correct unflagged questions retire until you reset history.",
      },
      high_yield_only: {
        title: "High-yield mixed review",
        summary: "Keeps the mixed-domain format, but only pulls from gold and high-yield questions.",
        detail: "Use this when you want realistic coverage without low-priority filler.",
      },
      fresh_questions_only: {
        title: "Unseen-question mixed review",
        summary: "Builds a mixed set using only questions you have never seen on this device.",
        detail: "Previously seen questions stay out entirely, even if you answered them correctly.",
      },
      missed_questions: {
        title: "Retry missed / flagged",
        summary: "Pulls only questions you missed, left unanswered, or flagged in earlier sessions.",
        detail: "This is the fastest way to recycle weak spots without reintroducing mastered questions.",
      },
      weak_domains: {
        title: "Weak-domain recovery",
        summary: "Concentrates the session into your four lowest-accuracy domains using your local history.",
        detail: "Use this when you want to patch weak categories before going back to full simulations.",
      },
      custom_domain_mix: {
        title: "Custom domain simulation",
        summary: "You choose the exact number of questions from each HOSA domain.",
        detail: "The custom domain counts must add up exactly to the session length you selected.",
      },
      bank_practice: {
        title: "Single-bank practice",
        summary: "Draws randomized questions from one selected bank and optional broad subtopic only.",
        detail: bank && subtopic
          ? `Current focus: ${bank.label} • ${subtopic.label}. Correct unflagged questions still retire until reset.`
          : "Choose a bank and optional broad subtopic, then the session is drawn only from that pool.",
      },
      untimed_review_mode: {
        title: "Untimed mixed review",
        summary: "Runs a mixed session with no timer and immediate feedback after each answer.",
        detail: "Best for slower study passes when you want explanations and source cues right away.",
      },
    };

    return descriptors[mode] || {
      title: "Mixed practice session",
      summary: "Uses the current settings to build a randomized review set.",
      detail: "Correct unflagged questions retire until reset, while missed or flagged questions stay eligible.",
    };
  }

  function getDynamicModeDescriptor(mode) {
    const bank = getSelectedBankInfo();
    const subtopic = getSelectedSubtopicInfo(bank);
    const settings = collectSettings();
    const affectsMemory = sessionAffectsMemory(settings);
    const availabilityLine = getAvailabilityMarkup(settings);
    const base = getModeDescriptor(mode);

    const overrides = {
      high_yield_only: {
        summary: "Draws a randomized mixed review set from gold and high-yield questions only.",
        detail: "Flexible practice mode. If the filtered pool is smaller than your requested length, it simply uses what is available.",
      },
      fresh_questions_only: {
        summary: "Builds a randomized mixed set using only questions your scored-test history has never consumed.",
        detail: "Good for discovery passes without forcing exact domain quotas.",
      },
      missed_questions: {
        detail: "Flexible practice mode focused only on retry-eligible material from scored tests.",
      },
      weak_domains: {
        summary: "Concentrates the session into your four weakest scored-test domains using your local history.",
        detail: "Flexible practice mode. It stays inside your weak domains, then takes as many eligible questions as are available.",
      },
      bank_practice: {
        detail: bank && subtopic
          ? `Current focus: ${bank.label} • ${subtopic.label}. If fewer than ${settings.length} are currently eligible, the session uses the full available pool.`
          : "Choose a bank and optional broad subtopic, then the session is drawn only from that pool.",
      },
      untimed_review_mode: {
        detail: "Practice-only mode. It does not retire questions or update your scored-test memory.",
      },
    };

    const merged = {
      ...base,
      ...(overrides[mode] || {}),
    };

    return {
      ...merged,
      availabilityLine,
      memoryLine: affectsMemory
        ? "This session affects scored-test memory, retirement, and weak-domain tracking."
        : "This session is practice-only and does not affect scored-test memory, retirement, or weak-domain tracking.",
    };
  }

  function renderModeDescriptor(mode) {
    if (!dom.modeDescriptor) return;
    const descriptor = getDynamicModeDescriptor(mode);
    dom.modeDescriptor.innerHTML = `
      <div class="mode-brief-top">
        <strong>${descriptor.title}</strong>
      </div>
      <p>${descriptor.summary}</p>
      <div class="mode-brief-note">${descriptor.detail}</div>
      <div class="mode-brief-note">${descriptor.availabilityLine}</div>
      <div class="mode-brief-note">${descriptor.memoryLine}</div>
    `;
  }

  function updateBankSelectionSummary() {
    const bank = getSelectedBankInfo();
    const subtopic = getSelectedSubtopicInfo(bank);
    const isBankPractice = dom.modeSelect.value === "bank_practice";

    dom.bankSelectionSummary.classList.toggle("hidden", !isBankPractice || !bank || !subtopic);
    if (!isBankPractice || !bank || !subtopic) {
      dom.bankSelectionSummary.innerHTML = "";
      return;
    }

    const broadSubtopicCount = Math.max(0, bank.subtopics.length - 1);
    const settings = collectSettings();
    const eligibleCount = bank.questions
      .filter((question) => {
        if (subtopic.id === "all_subtopics") return true;
        return toSubtopicId(inferBroadSubtopic(question, bank.id)) === subtopic.id;
      })
      .filter((question) => isEligibleByMemory(question, settings))
      .filter((question) => questionMatchesPriorityMode(question, dom.priorityModeSelect.value))
      .length;
    const requestedLength = getLengthValue();
    const coverageLine = subtopic.id === "all_subtopics"
      ? `${eligibleCount} currently eligible questions across ${broadSubtopicCount} broad subtopic${broadSubtopicCount === 1 ? "" : "s"}.`
      : `${eligibleCount} currently eligible questions in ${subtopic.label}.`;
    const warningLine = eligibleCount < requestedLength
      ? `<div class="selection-summary-warning">Current length asks for ${requestedLength}, but this selection only has ${eligibleCount} currently eligible questions. The session will use the full available pool.</div>`
      : "";

    dom.bankSelectionSummary.innerHTML = `
      <div class="selection-summary-head">
        <strong>${bank.label}</strong>
        <span>${subtopic.label}</span>
      </div>
      <p>${bank.description}</p>
      <div class="selection-summary-meta">
        <span>${coverageLine}</span>
        <span>${sessionAffectsMemory(settings) ? "Randomized selection stays inside this bank only, and scored-test memory still controls retirement." : "Randomized selection stays inside this bank only, and this practice session will not change retirement history."}</span>
      </div>
      ${warningLine}
    `;
  }

  function updateSetupModeUi() {
    const mode = dom.modeSelect.value;
    const customLength = dom.lengthSelect.value === "custom";
    const customDomain = mode === "custom_domain_mix";
    const bankPractice = mode === "bank_practice";

    dom.customLengthField.classList.toggle("hidden", !customLength);
    dom.customDomainPanel.classList.toggle("hidden", !customDomain);
    dom.customDomainPanel.open = customDomain;
    dom.bankField.classList.toggle("hidden", !bankPractice);
    dom.subtopicField.classList.toggle("hidden", !bankPractice);
    dom.startNextRoundBtn.classList.toggle("hidden", mode !== "hosa_weighted_full_simulation");
    dom.startSimulationBtn.textContent = bankPractice
      ? "Start Bank Set"
      : customDomain
        ? "Start Custom Simulation"
        : mode === "untimed_review_mode"
          ? "Start Review Set"
          : "Start Simulation";

    renderModeDescriptor(mode);
    updateBankSelectionSummary();
  }

  function canUseLocalStorage() {
    if (storageUsable !== null) return storageUsable;
    try {
      const probeKey = "__hosa_biotech_storage_probe__";
      localStorage.setItem(probeKey, "1");
      localStorage.removeItem(probeKey);
      storageUsable = true;
    } catch (error) {
      storageUsable = false;
    }
    return storageUsable;
  }

  function loadHistory() {
    if (!canUseLocalStorage()) {
      return window.HosaBiotechLoader.createEmptyHistoryState();
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return window.HosaBiotechLoader.createEmptyHistoryState();
      const parsed = JSON.parse(raw);
      const incomingVersion = Number(parsed?.version) || 0;
      const history = Object.assign(window.HosaBiotechLoader.createEmptyHistoryState(), parsed);

      if (!history.questionStats || typeof history.questionStats !== "object") {
        history.questionStats = {};
      }

      Object.entries(history.questionStats).forEach(([questionId, value]) => {
        const current = value && typeof value === "object" ? value : {};
        const attempts = Math.max(0, Number(current.attempts) || 0);
        const correct = Math.max(0, Number(current.correct) || 0);
        const incorrect = Math.max(0, Number(current.incorrect) || 0);
        const flaggedForRetry = typeof current.flaggedForRetry === "boolean" ? current.flaggedForRetry : false;
        const lastAttemptCorrect = typeof current.lastAttemptCorrect === "boolean" ? current.lastAttemptCorrect : null;
        const lastAttemptUnanswered = typeof current.lastAttemptUnanswered === "boolean" ? current.lastAttemptUnanswered : null;
        const recentChoiceOrderSignatures = Array.isArray(current.recentChoiceOrderSignatures)
          ? current.recentChoiceOrderSignatures.filter((item) => typeof item === "string" && item).slice(-6)
          : [];

        let retryEligible = false;
        if (flaggedForRetry) {
          retryEligible = true;
        } else if (typeof lastAttemptCorrect === "boolean") {
          retryEligible = !lastAttemptCorrect;
        } else if (incomingVersion >= 3 && typeof current.retryEligible === "boolean") {
          retryEligible = current.retryEligible;
        } else if (attempts > 0 && correct === 0) {
          // Conservative migration: if a legacy record has never been answered correctly, keep it retry-eligible.
          retryEligible = true;
        }

        history.questionStats[questionId] = Object.assign(
          {
            attempts: 0,
            correct: 0,
            incorrect: 0,
            retryEligible: false,
            flaggedForRetry: false,
            lastChoiceOrderSignature: "",
            recentChoiceOrderSignatures: [],
            lastSeenAt: null,
            lastTestId: null,
            lastAttemptCorrect: null,
            lastAttemptUnanswered: null,
          },
          current,
          {
            attempts,
            correct,
            incorrect,
            retryEligible,
            flaggedForRetry,
            lastChoiceOrderSignature: typeof current.lastChoiceOrderSignature === "string" ? current.lastChoiceOrderSignature : "",
            recentChoiceOrderSignatures: recentChoiceOrderSignatures.length
              ? recentChoiceOrderSignatures
              : (typeof current.lastChoiceOrderSignature === "string" && current.lastChoiceOrderSignature
                  ? [current.lastChoiceOrderSignature]
                  : []),
            lastAttemptCorrect,
            lastAttemptUnanswered,
          }
        );
      });

      if (!history.perDomain || typeof history.perDomain !== "object") {
        history.perDomain = {};
      }

      if (!Array.isArray(history.tests)) {
        history.tests = [];
      }

      if (!Array.isArray(history.savedRounds)) {
        history.savedRounds = [];
      }

      history.version = Math.max(3, Number(history.version) || 0);
      return history;
    } catch (error) {
      return window.HosaBiotechLoader.createEmptyHistoryState();
    }
  }

  function saveHistory() {
    if (!canUseLocalStorage()) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    } catch (error) {
      // If storage becomes unavailable, the app should still stay usable.
    }
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function setTheme(theme) {
    document.body.classList.toggle("theme-light", theme === "light");
    document.body.classList.toggle("theme-dark", theme !== "light");
    state.history.theme = theme;
    saveHistory();
  }

  function setNavigatorCollapsed(collapsed) {
    if (!dom.testLayout || !dom.toggleNavigatorBtn) return;
    dom.testLayout.classList.toggle("nav-collapsed", collapsed);
    dom.toggleNavigatorBtn.textContent = collapsed ? "Show Navigation" : "Hide Navigation";
    dom.toggleNavigatorBtn.setAttribute("aria-expanded", String(!collapsed));
    dom.toggleNavigatorBtn.setAttribute("aria-label", collapsed ? "Show navigation panel" : "Hide navigation panel");
    if (state.history) {
      state.history.navigatorCollapsed = collapsed;
      saveHistory();
    }
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function formatConfidenceLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "Confidence not listed";
    return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} confidence`;
  }

  function getPerformanceTier(percent) {
    if (percent >= 95) {
      return {
        label: "Excellent!",
        note: "Elite result. This is right where you want a polished simulation score to land.",
        tone: "excellent",
        positive: true,
      };
    }
    if (percent >= 85) {
      return {
        label: "Very Good!",
        note: "Strong performance. You are answering like someone who is genuinely ready to compete.",
        tone: "very_good",
        positive: true,
      };
    }
    if (percent >= 75) {
      return {
        label: "Good!",
        note: "Solid round. You are in good shape, with room to sharpen a few edges.",
        tone: "good",
        positive: true,
      };
    }
    if (percent >= 70) {
      return {
        label: "Above Average",
        note: "This is a respectable score, but there is still clear room to raise the floor.",
        tone: "above_average",
        positive: false,
      };
    }
    if (percent >= 60) {
      return {
        label: "Average",
        note: "You are in the workable range, but this still needs tightening before you should feel comfortable.",
        tone: "average",
        positive: false,
      };
    }
    return {
      label: "Below Average",
      note: "This round exposed important weak spots. Use the review and retry flow to clean them up.",
      tone: "below_average",
      positive: false,
    };
  }

  function getFlagButtonMarkup(flagged) {
    return `
      <span class="flag-button-inner">
        <svg class="flag-button-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1Z"></path>
        </svg>
        <span>${flagged ? "Bookmarked" : "Flag for Review"}</span>
      </span>
    `;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getChoiceContextLines(choice) {
    if (!choice || !Array.isArray(choice.choice_context)) return [];
    return choice.choice_context
      .map((line) => String(line || "").trim())
      .filter(Boolean);
  }

  function renderChoiceContextMarkup(choice, headingText = "Your selected choice corresponds to:") {
    const lines = getChoiceContextLines(choice);
    if (!lines.length) return "";

    return `
      <div class="choice-context-block">
        <strong class="choice-context-title">${escapeHtml(headingText)}</strong>
        <ul class="choice-context-list">
          ${lines.map((line) => `<li class="choice-context-item">${escapeHtml(line)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function updateCrossOutModeButton() {
    if (!dom.crossOutModeBtn || !state.currentTest) return;
    const active = Boolean(state.currentTest.crossOutMode);
    dom.crossOutModeBtn.classList.toggle("is-active", active);
    dom.crossOutModeBtn.setAttribute("aria-pressed", String(active));
    dom.crossOutModeBtn.setAttribute("aria-label", active ? "Turn off cross out mode" : "Turn on cross out mode");
  }

  function showView(viewName) {
    ["setupView", "testView", "resultsView"].forEach((name) => {
      dom[name].classList.toggle("hidden", name !== viewName);
      dom[name].classList.toggle("active", name === viewName);
    });
  }

  function getFlaggedCount() {
    if (!state.currentTest) return 0;
    return state.currentTest.questions.filter((entry) => entry.flagged).length;
  }

  function getUnansweredCount() {
    if (!state.currentTest) return 0;
    return state.currentTest.questions.filter((entry) => !entry.userAnswerId).length;
  }

  function closeSubmitConfirmModal() {
    if (!dom.submitConfirmModal) return;
    dom.submitConfirmModal.classList.add("hidden");
    dom.submitConfirmModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function openSubmitConfirmModal() {
    if (!state.currentTest) return;
    const flagged = getFlaggedCount();
    const unanswered = getUnansweredCount();
    const answered = state.currentTest.questions.length - unanswered;
    dom.submitConfirmSummary.textContent = `You are about to submit this session. You currently have ${flagged} flagged and ${unanswered} unanswered question(s).`;
    dom.submitConfirmCounts.innerHTML = [
      { label: "Flagged", value: flagged },
      { label: "Unanswered", value: unanswered },
      { label: "Answered", value: answered },
    ].map((item) => `
      <div class="modal-count-card">
        <span class="label">${item.label}</span>
        <strong>${item.value}</strong>
      </div>
    `).join("");
    dom.jumpFlaggedBtn.disabled = flagged === 0;
    dom.submitConfirmModal.classList.remove("hidden");
    dom.submitConfirmModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    try {
      await navigator.serviceWorker.register("./service-worker.js");
    } catch (error) {
      console.warn("Service worker registration failed.", error);
    }
  }

  function buildCustomDomainInputs() {
    const labels = window.HosaBiotechLoader.DOMAIN_LABELS;
    dom.customDomainGrid.innerHTML = "";
    Object.entries(labels).forEach(([key, label]) => {
      const wrapper = document.createElement("div");
      wrapper.className = "custom-domain-input";

      const title = document.createElement("label");
      title.setAttribute("for", `domain-${key}`);
      title.textContent = label;

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "100";
      input.value = String(state.config.exact_50_distribution[key] || 0);
      input.id = `domain-${key}`;
      input.dataset.domainKey = key;

      wrapper.appendChild(title);
      wrapper.appendChild(input);
      dom.customDomainGrid.appendChild(wrapper);
    });
  }

  function applyConfigDefaults() {
    const config = state.config || {};
    const defaultFilters = config.default_filters || {};

    if (config.default_mode) {
      const hasMode = Array.from(dom.modeSelect.options).some((option) => option.value === config.default_mode);
      if (hasMode) {
        dom.modeSelect.value = config.default_mode;
      }
    }

    if (typeof config.default_test_length === "number") {
      const lengthValue = String(config.default_test_length);
      const hasPresetLength = Array.from(dom.lengthSelect.options).some((option) => option.value === lengthValue);
      dom.lengthSelect.value = hasPresetLength ? lengthValue : "custom";
      if (!hasPresetLength) {
        dom.customLengthInput.value = String(config.default_test_length);
      }
    }

    if (typeof config.default_timer_minutes === "number") {
      dom.timerMinutesInput.value = String(config.default_timer_minutes);
    }

    if (typeof defaultFilters.answer_randomization === "boolean") {
      dom.answerRandomizationToggle.checked = defaultFilters.answer_randomization;
    }

    if (defaultFilters.priority_mode) {
      const hasPriorityMode = Array.from(dom.priorityModeSelect.options).some((option) => option.value === defaultFilters.priority_mode);
      if (hasPriorityMode) {
        dom.priorityModeSelect.value = defaultFilters.priority_mode;
      }
    }
  }

  function getDomainInputs() {
    return Array.from(dom.customDomainGrid.querySelectorAll("input[data-domain-key]"));
  }

  function getLengthValue() {
    if (dom.lengthSelect.value === "custom") {
      return Math.max(5, Math.min(200, Number(dom.customLengthInput.value) || 50));
    }
    return Number(dom.lengthSelect.value) || 50;
  }

  function computeAccuracy(correct, attempts) {
    if (!attempts) return null;
    return correct / attempts;
  }

  function getWeakDomainSet() {
    const labels = window.HosaBiotechLoader.DOMAIN_LABELS;
    const scored = Object.keys(labels).map((domain) => {
      const stats = state.history.perDomain[domain] || { attempts: 0, correct: 0, incorrect: 0 };
      const accuracy = stats.attempts ? stats.correct / stats.attempts : 0;
      return {
        domain,
        attempts: stats.attempts,
        accuracy,
      };
    });
    scored.sort((a, b) => {
      if (a.attempts === 0 && b.attempts > 0) return -1;
      if (b.attempts === 0 && a.attempts > 0) return 1;
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return a.domain.localeCompare(b.domain);
    });
    return new Set(scored.slice(0, 4).map((item) => item.domain));
  }

  function buildWeakDomainDistribution(length) {
    const weakest = Array.from(getWeakDomainSet());
    const ifEmpty = Object.keys(window.HosaBiotechLoader.DOMAIN_LABELS).slice(0, 4);
    const chosen = weakest.length ? weakest : ifEmpty;
    const weights = [0.35, 0.25, 0.2, 0.2];
    const distribution = {};
    let allocated = 0;
    chosen.forEach((domain, index) => {
      distribution[domain] = Math.floor(length * (weights[index] || 0.2));
      allocated += distribution[domain];
    });
    while (allocated < length) {
      const domain = chosen[allocated % chosen.length];
      distribution[domain] += 1;
      allocated += 1;
    }
    return distribution;
  }

  function collectSettings(options = {}) {
    const mode = options.forceMode || dom.modeSelect.value;
    const length = options.forceLength || getLengthValue();
    const timerEnabled = mode === "untimed_review_mode" ? false : (options.forceTimerEnabled ?? dom.timerEnabledToggle.checked);
    const timerMinutes = options.forceTimerMinutes || Math.max(1, Number(dom.timerMinutesInput.value) || length);
    const feedbackMode = mode === "untimed_review_mode" ? "immediate_review" : dom.feedbackModeSelect.value;
    const priorityMode = dom.priorityModeSelect.value;
    const selectedBankId = dom.bankSelect.value || state.bankCatalog?.banks?.[0]?.id || "chapter_1";
    const selectedSubtopicId = dom.subtopicSelect.value || "all_subtopics";

    let customDistribution = null;
    let warnings = [];

    if (mode === "custom_domain_mix") {
      customDistribution = {};
      let total = 0;
      getDomainInputs().forEach((input) => {
        const value = Math.max(0, Number(input.value) || 0);
        customDistribution[input.dataset.domainKey] = value;
        total += value;
      });
      if (total !== length) {
        warnings.push(`Custom domain mix currently sums to ${total}, not ${length}.`);
      }
    }

    if (mode === "hosa_weighted_full_simulation") {
      customDistribution = window.HosaBiotechLoader.getScaledDistribution(state.config.exact_50_distribution, length);
    }

    return {
      mode,
      length,
      timerEnabled,
      timerMinutes,
      feedbackMode,
      priorityMode,
      answerRandomization: dom.answerRandomizationToggle.checked,
      showDomainLabels: dom.showDomainToggle.checked,
      customDistribution,
      weakDomainSet: getWeakDomainSet(),
      warnings,
      roundMode: Boolean(options.roundMode),
      selectedBankId,
      selectedSubtopicId,
    };
  }

  function getQuestionStats(questionId) {
    return state.history.questionStats[questionId] || null;
  }

  function isRetryEligibleStats(stats) {
    if (!stats || !stats.attempts) return false;
    if (typeof stats.retryEligible === "boolean") return stats.retryEligible;
    return Boolean(stats.flaggedForRetry);
  }

  function isEligibleByMemory(question, settings) {
    const stats = getQuestionStats(question.corpus_id);
    const unseen = !stats || !stats.attempts;
    const retryEligible = isRetryEligibleStats(stats);

    if (settings.mode === "fresh_questions_only") {
      return unseen;
    }

    if (settings.mode === "missed_questions") {
      return Boolean(stats && stats.attempts && retryEligible);
    }

    return unseen || retryEligible;
  }

  function questionMatchesPriorityMode(question, priorityMode) {
    if (priorityMode === "gold_high_only") {
      return ["gold_anchor", "high_yield_seed", "manual_scored_high", "provisional_high"].includes(question.priority_tier);
    }

    if (priorityMode === "exclude_low") {
      return question.priority_tier !== "low_priority";
    }

    return true;
  }

  function questionAllowedByCareerSource(question, mode = "") {
    if (mode === "bank_practice") return true;
    if (question.primary_domain !== "biotechnology_industry_practices_and_careers") return true;
    return question.source_group === "careers";
  }

  function questionAllowed(question, settings) {
    if (question.manual_review) return false;
    if (question.priority_tier === "avoid_until_review") return false;
    if (!questionAllowedByCareerSource(question, settings.mode)) return false;
    if (settings.mode === "bank_practice" && !questionMatchesBankFilters(question, settings)) return false;
    if (settings.mode === "weak_domains" && !getWeakDomainSelectionSet(settings).has(question.primary_domain)) return false;
    if (!isEligibleByMemory(question, settings)) return false;
    if (!questionMatchesPriorityMode(question, settings.priorityMode)) return false;

    if (settings.mode === "high_yield_only") {
      return ["gold_anchor", "high_yield_seed", "manual_scored_high", "provisional_high"].includes(question.priority_tier);
    }

    return true;
  }

  function createGenerationRng() {
    const seed = ((Date.now() >>> 0) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    return makeRng(seed);
  }

  function sampleRandomWithoutReplacement(items, count, rng) {
    const pool = items.slice();
    shuffleArray(pool, rng);
    return pool.slice(0, count);
  }

  function makeRng(seed) {
    let stateValue = seed >>> 0;
    return function next() {
      stateValue = (1664525 * stateValue + 1013904223) >>> 0;
      return stateValue / 0x100000000;
    };
  }

  function generateTest(settings) {
    if (settings.warnings.length) {
      throw new Error(settings.warnings.join(" "));
    }

    if (settings.mode === "bank_practice") {
      return generateBankPracticeTest(settings);
    }

    if (!usesExactDomainDistribution(settings.mode)) {
      return generateFlexibleMixedTest(settings);
    }

    const rng = createGenerationRng();
    const warnings = [];
    const selectedIds = new Set();
    const questions = [];

    for (const domain of Object.keys(settings.customDistribution)) {
      const needed = settings.customDistribution[domain];
      if (!needed) continue;

      const allCandidates = state.bank
        .filter((question) => question.primary_domain === domain)
        .filter((question) => !selectedIds.has(question.corpus_id))
        .filter((question) => questionAllowed(question, settings));

      const candidates = allCandidates;
      if (candidates.length < needed) {
        throw new Error(`${window.HosaBiotechLoader.DOMAIN_LABELS[domain]} only has ${candidates.length} eligible question(s) for a quota of ${needed}. Correctly answered unflagged questions are retired until you reset history.`);
      }

      const picked = sampleRandomWithoutReplacement(candidates, needed, rng);
      if (picked.length < needed) {
        throw new Error(`${window.HosaBiotechLoader.DOMAIN_LABELS[domain]} could not produce enough randomized picks.`);
      }

      picked.forEach((question) => {
        selectedIds.add(question.corpus_id);
        questions.push(question);
      });
    }

    shuffleArray(questions, rng);

    const roundLabel = getDefaultRoundLabel(settings);

    const preparedQuestions = questions.map((question, index) => prepareQuestionForSession(question, index, settings, rng));

    return {
      testId: `test-${Date.now()}`,
      createdAt: Date.now(),
      roundLabel,
      mode: settings.mode,
      settings,
      crossOutMode: false,
      warnings,
      questions: preparedQuestions,
      startedAt: Date.now(),
      endsAt: settings.timerEnabled ? Date.now() + settings.timerMinutes * 60 * 1000 : null,
    };
  }

  function getDefaultRoundLabel(settings) {
    if (settings.roundMode) return `Round ${state.history.roundCounter + 1}`;
    if (settings.mode === "custom_domain_mix") return "Custom Mix";
    if (settings.mode === "hosa_weighted_full_simulation") return "Simulation";
    return getModeLabel(settings.mode);
  }

  function generateFlexibleMixedTest(settings) {
    const rng = createGenerationRng();
    const warnings = [];
    const candidates = getFlexibleModeCandidates(settings);

    if (!candidates.length) {
      throw new Error(`${getModeLabel(settings.mode)} currently has 0 eligible questions under the active filters. Adjust the bank, priority filter, or reset scored-test history.`);
    }

    const actualLength = Math.min(settings.length, candidates.length);
    if (actualLength < settings.length) {
      warnings.push(`Requested ${settings.length} question(s), but only ${actualLength} are currently eligible. This practice session uses the full available pool.`);
    }

    const picked = sampleRandomWithoutReplacement(candidates, actualLength, rng);
    shuffleArray(picked, rng);
    const preparedQuestions = picked.map((question, index) => prepareQuestionForSession(question, index, settings, rng));

    return {
      testId: `test-${Date.now()}`,
      createdAt: Date.now(),
      roundLabel: getDefaultRoundLabel(settings),
      mode: settings.mode,
      settings,
      crossOutMode: false,
      warnings,
      questions: preparedQuestions,
      startedAt: Date.now(),
      endsAt: settings.timerEnabled ? Date.now() + settings.timerMinutes * 60 * 1000 : null,
    };
  }

  function generateBankPracticeTest(settings) {
    const rng = createGenerationRng();
    const warnings = [];
    const bank = state.bankCatalog?.byId?.[settings.selectedBankId];
    if (!bank) {
      throw new Error("The selected bank could not be found in the compiled platform.");
    }

    const subtopic = bank.subtopics.find((item) => item.id === settings.selectedSubtopicId) || bank.subtopics[0];
    const allCandidates = bank.questions.filter((question) => questionAllowed(question, settings));

    const candidates = allCandidates;

    if (!candidates.length) {
      throw new Error(`${bank.label}${subtopic && subtopic.id !== "all_subtopics" ? ` - ${subtopic.label}` : ""} currently has 0 eligible questions under the active filters.`);
    }

    const actualLength = Math.min(settings.length, candidates.length);
    if (actualLength < settings.length) {
      warnings.push(`${bank.label}${subtopic && subtopic.id !== "all_subtopics" ? ` - ${subtopic.label}` : ""} only has ${actualLength} currently eligible question(s), so this session uses the full available pool.`);
    }
    const picked = sampleRandomWithoutReplacement(candidates, actualLength, rng);

    shuffleArray(picked, rng);
    const preparedQuestions = picked.map((question, index) => prepareQuestionForSession(question, index, settings, rng));

    return {
      testId: `test-${Date.now()}`,
      createdAt: Date.now(),
      roundLabel: bank.label,
      contextLine: subtopic?.label || "All broad subtopics",
      mode: settings.mode,
      settings,
      crossOutMode: false,
      warnings,
      questions: preparedQuestions,
      startedAt: Date.now(),
      endsAt: settings.timerEnabled ? Date.now() + settings.timerMinutes * 60 * 1000 : null,
    };
  }

  function prepareQuestionForSession(question, index, settings, rng) {
    const choices = deepClone(question.choices);
    const stats = getQuestionStats(question.corpus_id);
    if (settings.answerRandomization && question.shuffle_safe && choices.length > 1) {
      const recentSignatures = Array.isArray(stats?.recentChoiceOrderSignatures)
        ? stats.recentChoiceOrderSignatures.filter((item) => typeof item === "string" && item)
        : [];
      const blockedSignatures = new Set(
        recentSignatures.length
          ? recentSignatures
          : (stats?.lastChoiceOrderSignature ? [stats.lastChoiceOrderSignature] : [])
      );
      const baselineOrder = choices.slice();
      let signature = choices.map((choice) => choice.letter_original).join("");
      let attempts = 0;
      while (attempts < 16) {
        shuffleArray(choices, rng);
        signature = choices.map((choice) => choice.letter_original).join("");
        if (!blockedSignatures.has(signature)) break;
        attempts += 1;
      }
      if (blockedSignatures.has(signature)) {
        for (let i = 0; i < baselineOrder.length - 1; i += 1) {
          const variant = baselineOrder.slice();
          [variant[i], variant[i + 1]] = [variant[i + 1], variant[i]];
          const variantSignature = variant.map((choice) => choice.letter_original).join("");
          if (!blockedSignatures.has(variantSignature)) {
            choices.splice(0, choices.length, ...variant);
            signature = variantSignature;
            break;
          }
        }
      }
    }

    const renderedChoices = choices.map((choice, choiceIndex) => ({
      id: LETTERS[choiceIndex],
      original_letter: choice.letter_original,
      text: choice.text,
      choice_context: Array.isArray(choice.choice_context) ? choice.choice_context.slice() : [],
      isCorrect: normalize(choice.text) === normalize(question.correct_answer_text),
    }));

    return {
      orderIndex: index,
      question,
      renderedChoices,
      userAnswerId: "",
      flagged: false,
      crossedOutChoiceIds: [],
      answeredAt: null,
    };
  }

  function shuffleArray(array, rng) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function renderSetupSummary() {
    const summary = window.HOSA_BIOTECH_BANK_SUMMARY || {};
    const defaultUsable = state.bank.filter((question) => {
      if (question.manual_review) return false;
      if (["avoid_until_review", "low_priority"].includes(question.priority_tier)) return false;
      return questionAllowedByCareerSource(question, "hosa_weighted_full_simulation");
    });
    const stats = [
      { label: "Compiled Bank", value: summary.totalQuestions || state.bank.length },
      { label: "Default Usable", value: defaultUsable.length },
      { label: "Anchors", value: state.bank.filter((question) => question.slc_sqt_anchor).length },
      { label: "Rounds Taken", value: state.history.tests.length },
      { label: "Saved Rounds", value: state.history.savedRounds.length },
      {
        label: "Average Accuracy",
        value: `${Math.round(getOverallAccuracy() * 100)}%`,
      },
    ];

    dom.overviewStats.innerHTML = stats
      .map((stat) => `
        <div class="stat-card">
          <span class="label">${stat.label}</span>
          <strong>${stat.value}</strong>
        </div>
      `)
      .join("");

    const counts = new Map();
    defaultUsable.forEach((question) => counts.set(question.primary_domain, (counts.get(question.primary_domain) || 0) + 1));
    const maxValue = Math.max(...Array.from(counts.values()), 1);
    dom.domainAvailabilityCaption.textContent = "Default-usable counts by domain";
    dom.domainBars.innerHTML = Object.entries(window.HosaBiotechLoader.DOMAIN_LABELS)
      .map(([domain, label]) => {
        const count = counts.get(domain) || 0;
        const pct = Math.round((count / maxValue) * 100);
        return `
          <div class="domain-bar">
            <div class="domain-bar-top">
              <strong>${label}</strong>
              <span>${count}</span>
            </div>
            <div class="domain-bar-track">
              <div class="domain-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
        `;
      })
      .join("");

    renderRecentRounds();
    renderSavedRounds();
  }

  function renderRecentRounds() {
    const rounds = state.history.tests.slice(-6).reverse();
    dom.recentRoundsList.innerHTML = rounds
      .map((round) => {
        const accuracy = round.total ? Math.round((round.correct / round.total) * 100) : 0;
        return `
          <div class="stack-item">
            <strong>${round.roundLabel || round.modeLabel || "Simulation"}</strong>
            <div class="muted-text">${new Date(round.completedAt).toLocaleString()}</div>
            <div class="muted-text">${round.correct}/${round.total} correct • ${accuracy}% • ${round.timeUsedLabel}</div>
          </div>
        `;
      })
      .join("");
  }

  function renderSavedRounds() {
    if (!state.history.savedRounds.length) {
      dom.savedRoundsList.innerHTML = "";
      return;
    }

    dom.savedRoundsList.innerHTML = state.history.savedRounds
      .slice()
      .reverse()
      .map((preset) => `
        <div class="stack-item">
          <strong>${preset.label}</strong>
          <div class="muted-text">${preset.questionIds.length} questions • ${new Date(preset.createdAt).toLocaleString()}</div>
          <div class="action-row">
            <button class="secondary-button small-button" type="button" data-load-preset="${preset.id}">Load</button>
            <button class="ghost-button small-button" type="button" data-delete-preset="${preset.id}">Delete</button>
          </div>
        </div>
      `)
      .join("");
  }

  function getOverallAccuracy() {
    const stats = Object.values(state.history.questionStats || {});
    const attempts = stats.reduce((sum, item) => sum + (item.attempts || 0), 0);
    const correct = stats.reduce((sum, item) => sum + (item.correct || 0), 0);
    if (!attempts) return 0;
    return correct / attempts;
  }

  function startGeneratedTest(roundMode) {
    try {
      const settings = collectSettings({ roundMode, forceMode: roundMode ? "hosa_weighted_full_simulation" : undefined, forceLength: roundMode ? 50 : undefined, forceTimerEnabled: roundMode ? true : undefined, forceTimerMinutes: roundMode ? 50 : undefined });
      const test = generateTest(settings);
      if (roundMode) {
        state.history.roundCounter += 1;
        saveHistory();
      }
      beginTest(test);
    } catch (error) {
      renderSetupWarnings([error.message]);
    }
  }

  function beginTest(test) {
    test.crossOutMode = Boolean(test.crossOutMode);
    test.questions.forEach((entry) => {
      if (!Array.isArray(entry.crossedOutChoiceIds)) {
        entry.crossedOutChoiceIds = [];
      }
    });
    state.currentTest = test;
    state.currentQuestionIndex = 0;
    renderGenerationWarnings(test.warnings);
    showView("testView");
    renderTestScaffold();
    renderCurrentQuestion();
    startTimer();
  }

  function renderSetupWarnings(messages) {
    dom.setupWarnings.classList.toggle("hidden", !messages.length);
    dom.setupWarnings.innerHTML = messages.map((message) => `<div class="warning-card">${message}</div>`).join("");
  }

  function renderGenerationWarnings(messages) {
    dom.generationWarnings.classList.toggle("hidden", !messages.length);
    dom.generationWarnings.innerHTML = messages.map((message) => `<div class="warning-card">${message}</div>`).join("");
  }

  function renderTestScaffold() {
    const test = state.currentTest;
    dom.testModeChip.textContent = getModeLabel(test.mode);
    dom.roundTitle.textContent = test.roundLabel;
    const metaParts = [];
    if (test.contextLine) metaParts.push(test.contextLine);
    metaParts.push(`${test.questions.length} questions`);
    metaParts.push(test.settings.timerEnabled ? `${test.settings.timerMinutes} minute timer` : "untimed");
    metaParts.push(test.settings.feedbackMode === "immediate_review" ? "instant feedback" : "end grading");
    dom.roundMeta.textContent = metaParts.join(" • ");
    updateCrossOutModeButton();
    renderQuestionGrid();
    renderTestProgress();
  }

  function renderQuestionGrid() {
    const currentIndex = state.currentQuestionIndex;
    dom.questionGrid.innerHTML = state.currentTest.questions
      .map((entry, index) => {
        const classes = ["grid-button"];
        if (index === currentIndex) classes.push("current");
        if (entry.userAnswerId) classes.push("answered");
        if (entry.flagged) classes.push("flagged");
        return `<button class="${classes.join(" ")}" type="button" data-grid-index="${index}">${index + 1}</button>`;
      })
      .join("");
  }

  function renderTestProgress() {
    const questions = state.currentTest.questions;
    const answered = questions.filter((entry) => entry.userAnswerId).length;
    const flagged = questions.filter((entry) => entry.flagged).length;
    const progressPercent = Math.round((answered / questions.length) * 100);
    dom.progressCount.textContent = `${state.currentQuestionIndex + 1} / ${questions.length}`;
    dom.answeredCount.textContent = String(answered);
    dom.flaggedCount.textContent = String(flagged);
    dom.progressFill.style.width = `${progressPercent}%`;
  }

  function updateNavigationButtons() {
    if (!state.currentTest) return;
    const isFirst = state.currentQuestionIndex === 0;
    const isLast = state.currentQuestionIndex === state.currentTest.questions.length - 1;
    dom.previousQuestionBtn.disabled = isFirst;
    dom.previousQuestionBtn.classList.toggle("is-edge-disabled", isFirst);
    dom.nextQuestionBtn.textContent = isLast ? "Submit Test" : "Next";
    dom.nextQuestionBtn.classList.toggle("is-submit-mode", isLast);
  }

  function renderCurrentQuestion() {
    const entry = state.currentTest.questions[state.currentQuestionIndex];
    const question = entry.question;
    const crossOutMode = Boolean(state.currentTest.crossOutMode);
    dom.questionCounterChip.textContent = `Question ${state.currentQuestionIndex + 1} of ${state.currentTest.questions.length}`;
    dom.priorityChip.textContent = question.priority_tier.replace(/_/g, " ");
    dom.sourceChip.textContent = question.source_name;
    dom.domainChip.textContent = window.HosaBiotechLoader.DOMAIN_LABELS[question.primary_domain] || question.primary_domain;
    dom.domainChip.classList.toggle("hidden", !state.currentTest.settings.showDomainLabels);
    dom.questionBackdropNumber.textContent = String(state.currentQuestionIndex + 1).padStart(2, "0");
    dom.questionText.textContent = question.question_text;
    dom.questionMetaLine.textContent = formatConfidenceLabel(question.domain_confidence);
    dom.flagQuestionBtn.innerHTML = getFlagButtonMarkup(entry.flagged);
    dom.flagQuestionBtn.classList.toggle("is-flagged", entry.flagged);
    updateCrossOutModeButton();

    dom.choiceList.innerHTML = entry.renderedChoices
      .map((choice) => {
        const crossedOut = entry.crossedOutChoiceIds.includes(choice.id);
        const selected = entry.userAnswerId === choice.id;
        const classes = ["choice-button"];
        const rowClasses = ["choice-row"];
        if (selected) classes.push("selected");
        if (crossOutMode) rowClasses.push("crossout-mode-on");
        if (crossedOut) {
          rowClasses.push("is-crossed-out");
          classes.push("is-crossed-out");
        }
        return `
          <div class="${rowClasses.join(" ")}">
            <button class="${classes.join(" ")}" type="button" data-choice-id="${choice.id}">
              <span class="choice-badge">${choice.id}</span>
              <span class="choice-copy">${choice.text}</span>
            </button>
            ${crossOutMode ? `
              <button
                class="choice-crossout-toggle ${crossedOut ? "is-crossed" : ""}"
                type="button"
                data-crossout-choice-id="${choice.id}"
                aria-pressed="${crossedOut ? "true" : "false"}"
                aria-label="${crossedOut ? `Undo cross out for choice ${choice.id}` : `Cross out choice ${choice.id}`}"
              >
                <span class="choice-crossout-glyph" aria-hidden="true">${choice.id}</span>
              </button>
            ` : ""}
          </div>
        `;
      })
      .join("");

    renderImmediateFeedback(entry);
    renderQuestionGrid();
    renderTestProgress();
    updateNavigationButtons();
  }

  function renderImmediateFeedback(entry) {
    const enabled = state.currentTest.settings.feedbackMode === "immediate_review";
    if (!enabled || !entry.userAnswerId) {
      dom.immediateFeedbackBox.className = "feedback-box hidden";
      dom.immediateFeedbackBox.innerHTML = "";
      return;
    }

    const picked = entry.renderedChoices.find((choice) => choice.id === entry.userAnswerId);
    const correctChoice = entry.renderedChoices.find((choice) => choice.isCorrect);
    const isCorrect = Boolean(picked && picked.isCorrect);
    const selectedChoiceContextMarkup = renderChoiceContextMarkup(picked);
    dom.immediateFeedbackBox.className = `feedback-box ${isCorrect ? "correct" : "incorrect"}`;
    dom.immediateFeedbackBox.innerHTML = `
      <strong>${isCorrect ? "Correct" : "Not correct yet"}</strong>
      <div class="review-block">Your answer: ${picked ? `${picked.id}. ${picked.text}` : "No answer selected"}</div>
      <div class="review-block">Correct answer: ${correctChoice.id}. ${correctChoice.text}</div>
      ${selectedChoiceContextMarkup}
      <div class="review-block">${entry.question.explanation}</div>
      <div class="review-block">Source cue: ${entry.question.source_cue || "Not listed."}</div>
    `;
  }

  function chooseAnswer(choiceId) {
    const entry = state.currentTest.questions[state.currentQuestionIndex];
    entry.crossedOutChoiceIds = entry.crossedOutChoiceIds.filter((id) => id !== choiceId);
    entry.userAnswerId = choiceId;
    entry.answeredAt = Date.now();
    renderCurrentQuestion();
  }

  function toggleCrossOutMode() {
    if (!state.currentTest) return;
    const nextMode = !state.currentTest.crossOutMode;
    state.currentTest.crossOutMode = nextMode;
    if (!nextMode) {
      state.currentTest.questions.forEach((entry) => {
        entry.crossedOutChoiceIds = [];
      });
    }
    renderCurrentQuestion();
  }

  function toggleChoiceCrossOut(choiceId) {
    if (!state.currentTest) return;
    const entry = state.currentTest.questions[state.currentQuestionIndex];
    const alreadyCrossed = entry.crossedOutChoiceIds.includes(choiceId);

    if (alreadyCrossed) {
      entry.crossedOutChoiceIds = entry.crossedOutChoiceIds.filter((id) => id !== choiceId);
    } else {
      entry.crossedOutChoiceIds = entry.crossedOutChoiceIds.concat(choiceId);
      if (entry.userAnswerId === choiceId) {
        entry.userAnswerId = "";
      }
    }

    renderCurrentQuestion();
  }

  function jumpToQuestion(index) {
    if (!state.currentTest) return;
    state.currentQuestionIndex = Math.max(0, Math.min(state.currentTest.questions.length - 1, index));
    renderCurrentQuestion();
  }

  function toggleFlagCurrentQuestion() {
    const entry = state.currentTest.questions[state.currentQuestionIndex];
    entry.flagged = !entry.flagged;
    renderCurrentQuestion();
  }

  function jumpToFirstUnanswered() {
    const index = state.currentTest.questions.findIndex((entry) => !entry.userAnswerId);
    if (index >= 0) {
      jumpToQuestion(index);
    } else {
      alert("Every question already has an answer.");
    }
  }

  function jumpToFirstFlagged() {
    const index = state.currentTest.questions.findIndex((entry) => entry.flagged);
    if (index >= 0) {
      closeSubmitConfirmModal();
      jumpToQuestion(index);
    } else {
      alert("No flagged questions to review.");
    }
  }

  function startTimer() {
    stopTimer();
    if (!state.currentTest.settings.timerEnabled || !state.currentTest.endsAt) {
      dom.timerDisplay.textContent = "Untimed";
      return;
    }

    function tick() {
      const remaining = state.currentTest.endsAt - Date.now();
      dom.timerDisplay.textContent = formatDuration(remaining);
      if (remaining <= 0) {
        stopTimer();
        finalizeTest(true);
      }
    }

    tick();
    state.timerId = setInterval(tick, 1000);
  }

  function finalizeTest(autoSubmitted) {
    stopTimer();
    const test = state.currentTest;
    const endedAt = Date.now();
    const reviewEntries = test.questions.map((entry) => {
      const correctChoice = entry.renderedChoices.find((choice) => choice.isCorrect);
      const userChoice = entry.renderedChoices.find((choice) => choice.id === entry.userAnswerId);
      const unansweredEntry = !entry.userAnswerId;
      const correct = Boolean(userChoice && userChoice.isCorrect);
      return {
        entry,
        correctChoice,
        userChoice,
        unanswered: unansweredEntry,
        correct,
      };
    });

    const correctCount = reviewEntries.filter((item) => item.correct).length;
    const unansweredCount = reviewEntries.filter((item) => item.unanswered).length;
    const incorrectCount = reviewEntries.length - correctCount - unansweredCount;
    const percent = Math.round((correctCount / reviewEntries.length) * 100);
    const timeUsedMs = endedAt - test.startedAt;
    const timeUsedLabel = formatDuration(timeUsedMs);

    const byDomain = {};
    reviewEntries.forEach((item) => {
      const domain = item.entry.question.primary_domain;
      const stat = byDomain[domain] || { total: 0, correct: 0, incorrect: 0, unanswered: 0 };
      stat.total += 1;
      if (item.correct) stat.correct += 1;
      else if (item.unanswered) stat.unanswered += 1;
      else stat.incorrect += 1;
      byDomain[domain] = stat;
    });

    const result = {
      testId: test.testId,
      roundLabel: test.roundLabel,
      mode: test.mode,
      modeLabel: dom.testModeChip.textContent,
      feedbackMode: test.settings.feedbackMode,
      completedAt: endedAt,
      correct: correctCount,
      incorrect: incorrectCount,
      unanswered: unansweredCount,
      total: reviewEntries.length,
      percent,
      timeUsedMs,
      timeUsedLabel,
      reviewEntries,
      byDomain,
      warnings: test.warnings,
      autoSubmitted,
      questionIds: test.questions.map((entry) => entry.question.corpus_id),
    };

    updateHistoryFromResult(result);
    state.currentTest.result = result;
    renderResults(result);
    showView("resultsView");
    closeSubmitConfirmModal();
  }

  function updateHistoryFromResult(result) {
    if (result.feedbackMode === "immediate_review") {
      renderSetupSummary();
      return;
    }

    result.reviewEntries.forEach((item) => {
      const id = item.entry.question.corpus_id;
      const stats = state.history.questionStats[id] || {
        attempts: 0,
        correct: 0,
        incorrect: 0,
        retryEligible: false,
        flaggedForRetry: false,
        lastChoiceOrderSignature: "",
        recentChoiceOrderSignatures: [],
        lastSeenAt: null,
        lastTestId: null,
        lastAttemptCorrect: null,
        lastAttemptUnanswered: null,
      };
      stats.attempts += 1;
      if (item.correct) stats.correct += 1;
      else if (!item.unanswered) stats.incorrect += 1;
      const choiceOrderSignature = item.entry.renderedChoices.map((choice) => choice.original_letter).join("");
      const priorSignatures = Array.isArray(stats.recentChoiceOrderSignatures)
        ? stats.recentChoiceOrderSignatures.filter((signature) => typeof signature === "string" && signature && signature !== choiceOrderSignature)
        : [];
      stats.retryEligible = Boolean(item.entry.flagged || !item.correct);
      stats.flaggedForRetry = Boolean(item.entry.flagged);
      stats.lastChoiceOrderSignature = choiceOrderSignature;
      stats.recentChoiceOrderSignatures = [...priorSignatures, choiceOrderSignature].slice(-6);
      stats.lastSeenAt = result.completedAt;
      stats.lastTestId = result.testId;
      stats.lastAttemptCorrect = item.correct;
      stats.lastAttemptUnanswered = item.unanswered;
      state.history.questionStats[id] = stats;

      const domain = item.entry.question.primary_domain;
      const domainStats = state.history.perDomain[domain] || { attempts: 0, correct: 0, incorrect: 0 };
      domainStats.attempts += 1;
      if (item.correct) domainStats.correct += 1;
      else if (!item.unanswered) domainStats.incorrect += 1;
      state.history.perDomain[domain] = domainStats;
    });

    state.history.tests.push({
      testId: result.testId,
      roundLabel: result.roundLabel,
      mode: result.mode,
      modeLabel: result.modeLabel,
      completedAt: result.completedAt,
      correct: result.correct,
      incorrect: result.incorrect,
      unanswered: result.unanswered,
      total: result.total,
      percent: result.percent,
      timeUsedLabel: result.timeUsedLabel,
      questionIds: result.questionIds,
    });

    if (state.history.tests.length > 30) {
      state.history.tests = state.history.tests.slice(-30);
    }

    saveHistory();
    renderSetupSummary();
  }

  function renderResults(result) {
    const flaggedCount = result.reviewEntries.filter((item) => item.entry.flagged).length;
    const missedCount = result.reviewEntries.filter((item) => !item.correct).length;
    const performanceTier = getPerformanceTier(result.percent);

    dom.resultsModeChip.textContent = result.roundLabel;
    dom.resultsHeadline.textContent = result.autoSubmitted ? "Time Expired — Test Submitted" : "Simulation Complete";
    dom.resultsSummaryText.textContent = `${result.correct} correct • ${result.incorrect} incorrect • ${result.unanswered} unanswered • ${result.timeUsedLabel} used`;
    dom.resultsJudgement.textContent = performanceTier.label;
    dom.resultsEncouragement.textContent = performanceTier.note;
    dom.scorePercent.textContent = `${result.percent}%`;
    dom.scoreRaw.textContent = `${result.correct} / ${result.total}`;
    dom.scoreRing.className = `score-ring score-ring-${performanceTier.tone}`;

    const stats = [
      { label: "Correct", value: result.correct },
      { label: "Incorrect", value: result.incorrect },
      { label: "Unanswered", value: result.unanswered },
      { label: "Flagged", value: flaggedCount },
      { label: "Missed", value: missedCount },
      { label: "Time Used", value: result.timeUsedLabel },
    ];
    dom.resultsStats.innerHTML = stats.map((stat) => `
      <div class="stat-card">
        <span class="label">${stat.label}</span>
        <strong>${stat.value}</strong>
      </div>
    `).join("");

    const domainBars = Object.entries(window.HosaBiotechLoader.DOMAIN_LABELS).map(([domain, label]) => {
      const stat = result.byDomain[domain] || { total: 0, correct: 0, incorrect: 0, unanswered: 0 };
      const pct = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
      return `
        <div class="domain-bar">
          <div class="domain-bar-top">
            <strong>${label}</strong>
            <span>${stat.correct}/${stat.total || 0}</span>
          </div>
          <div class="domain-bar-track">
            <div class="domain-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    });
    dom.resultsDomainBars.innerHTML = domainBars.join("");

    const orderedReviewEntries = result.reviewEntries
      .slice()
      .sort((a, b) => {
        const aIncorrectRank = a.correct ? 1 : 0;
        const bIncorrectRank = b.correct ? 1 : 0;
        if (aIncorrectRank !== bIncorrectRank) return aIncorrectRank - bIncorrectRank;
        if (a.entry.flagged !== b.entry.flagged) return a.entry.flagged ? -1 : 1;
        return a.entry.orderIndex - b.entry.orderIndex;
      });

    dom.reviewList.innerHTML = orderedReviewEntries.map((item) => {
      const question = item.entry.question;
      const questionNumber = item.entry.orderIndex + 1;
      const stateText = item.correct ? "CORRECT" : "NOT CORRECT";
      const userAnswer = item.userChoice ? `${item.userChoice.id}. ${item.userChoice.text}` : "No answer selected";
      const questionStateClass = item.correct ? "is-correct" : "is-not-correct";
      const stateChipClass = item.correct ? "review-status-chip review-status-correct" : "review-status-chip review-status-not-correct";
      const selectedChoiceContextMarkup = !item.correct && item.userChoice
        ? renderChoiceContextMarkup(item.userChoice)
        : "";
      return `
        <article class="review-card ${questionStateClass}">
          <div class="review-card-head">
            <div>
              <h4>Question ${questionNumber}. ${question.question_text}</h4>
              <div class="question-meta-line">${question.corpus_id} • ${window.HosaBiotechLoader.DOMAIN_LABELS[question.primary_domain]} • ${question.priority_tier.replace(/_/g, " ")}</div>
            </div>
            <div class="review-chip-stack">
              <span class="${stateChipClass}">${stateText}</span>
              ${item.entry.flagged ? `<span class="review-status-chip review-flagged-chip">FLAGGED</span>` : ""}
            </div>
          </div>
          <div class="review-block"><strong>Your answer:</strong> ${userAnswer}</div>
          ${selectedChoiceContextMarkup}
          <div class="review-block"><strong>Correct answer:</strong> ${item.correctChoice.id}. ${item.correctChoice.text}</div>
          <div class="review-block"><strong>Explanation:</strong> ${question.explanation || "No explanation listed."}</div>
          <div class="review-block"><strong>Source cue:</strong> ${question.source_cue || "Not listed."}</div>
          <div class="review-block"><strong>Source:</strong> ${question.source_name}</div>
          ${item.entry.flagged ? `<div class="review-block"><strong>Flagged during test:</strong> yes</div>` : ""}
          ${question.manual_review ? `<div class="review-block"><strong>Manual review:</strong> ${question.manual_review_reason}</div>` : ""}
        </article>
      `;
    }).join("");
  }

  function startRetryMissedSession() {
    if (!state.currentTest || !state.currentTest.result) return;
    const missedQuestions = state.currentTest.result.reviewEntries
      .filter((item) => !item.correct || item.entry.flagged)
      .map((item) => item.entry.question);

    if (!missedQuestions.length) {
      alert("There are no missed or flagged questions to retry.");
      return;
    }

    const rng = createGenerationRng();
    const settings = Object.assign({}, state.currentTest.settings, {
      mode: "untimed_review_mode",
      timerEnabled: false,
      feedbackMode: "immediate_review",
      length: missedQuestions.length,
    });

    const test = {
      testId: `retry-${Date.now()}`,
      createdAt: Date.now(),
      roundLabel: "Retry Missed / Flagged Questions",
      mode: "untimed_review_mode",
      settings,
      warnings: [],
      questions: missedQuestions.map((question, index) => prepareQuestionForSession(question, index, settings, rng)),
      startedAt: Date.now(),
      endsAt: null,
    };

    beginTest(test);
  }

  function saveCurrentRound() {
    if (!state.currentTest || !state.currentTest.result) return;
    const preset = {
      id: `preset-${Date.now()}`,
      label: `${state.currentTest.result.roundLabel} • ${state.currentTest.result.percent}%`,
      createdAt: Date.now(),
      questionIds: state.currentTest.questions.map((entry) => entry.question.corpus_id),
      settings: state.currentTest.settings,
    };
    state.history.savedRounds.push(preset);
    if (state.history.savedRounds.length > 20) {
      state.history.savedRounds = state.history.savedRounds.slice(-20);
    }
    saveHistory();
    renderSavedRounds();
    alert("Round saved locally.");
  }

  function loadSavedRound(presetId) {
    const preset = state.history.savedRounds.find((item) => item.id === presetId);
    if (!preset) return;
    const rng = createGenerationRng();
    const loadedQuestions = preset.questionIds
      .map((id) => state.bank.find((question) => question.corpus_id === id))
      .filter(Boolean);
    const skippedQuestions = loadedQuestions.filter((question) => question.manual_review || question.priority_tier === "avoid_until_review");
    const questions = loadedQuestions.filter((question) => !question.manual_review && question.priority_tier !== "avoid_until_review");

    if (!questions.length) {
      alert(skippedQuestions.length
        ? "That saved round only contains questions that are now excluded for manual review."
        : "That saved round no longer matches any questions in the compiled bank.");
      return;
    }

    const test = {
      testId: `preset-${Date.now()}`,
      createdAt: Date.now(),
      roundLabel: preset.label,
      mode: "saved_preset",
      settings: Object.assign({}, preset.settings, { timerEnabled: false }),
      warnings: [
        "Loaded from local saved round preset.",
        ...(skippedQuestions.length ? [`${skippedQuestions.length} legacy saved question(s) were skipped because they are now marked for manual review.`] : []),
      ],
      questions: questions.map((question, index) => prepareQuestionForSession(question, index, Object.assign({}, preset.settings, { timerEnabled: false }), rng)),
      startedAt: Date.now(),
      endsAt: null,
    };
    beginTest(test);
  }

  function deleteSavedRound(presetId) {
    state.history.savedRounds = state.history.savedRounds.filter((item) => item.id !== presetId);
    saveHistory();
    renderSavedRounds();
  }

  function resetHistory() {
    const confirmed = window.confirm("Reset local question history, scores, saved rounds, and retry memory?");
    if (!confirmed) return;
    state.history = window.HosaBiotechLoader.createEmptyHistoryState();
    saveHistory();
    renderSetupSummary();
    updateSetupModeUi();
    setTheme("dark");
    setNavigatorCollapsed(false);
    alert("History reset.");
  }

  function bindEvents() {
    dom.themeToggle.addEventListener("click", () => {
      const nextTheme = document.body.classList.contains("theme-light") ? "dark" : "light";
      setTheme(nextTheme);
    });

    dom.toggleNavigatorBtn.addEventListener("click", () => {
      const collapsed = dom.testLayout.classList.contains("nav-collapsed");
      setNavigatorCollapsed(!collapsed);
    });

    dom.crossOutModeBtn.addEventListener("click", toggleCrossOutMode);

    dom.lengthSelect.addEventListener("change", () => {
      updateSetupModeUi();
      renderSetupWarnings([]);
    });

    dom.modeSelect.addEventListener("change", () => {
      updateSetupModeUi();
      renderSetupWarnings([]);
    });

    dom.bankSelect.addEventListener("change", () => {
      populateSubtopicOptions(dom.bankSelect.value);
      updateSetupModeUi();
      renderSetupWarnings([]);
    });

    dom.subtopicSelect.addEventListener("change", () => {
      updateSetupModeUi();
      renderSetupWarnings([]);
    });

    dom.priorityModeSelect.addEventListener("change", () => {
      updateSetupModeUi();
      renderSetupWarnings([]);
    });

    dom.feedbackModeSelect.addEventListener("change", () => {
      updateSetupModeUi();
      renderSetupWarnings([]);
    });

    dom.customLengthInput.addEventListener("input", () => {
      updateSetupModeUi();
      renderSetupWarnings([]);
    });

    dom.startSimulationBtn.addEventListener("click", () => startGeneratedTest(false));
    dom.startNextRoundBtn.addEventListener("click", () => startGeneratedTest(true));
    dom.resetHistoryBtn.addEventListener("click", resetHistory);
    dom.clearSavedRoundsBtn.addEventListener("click", () => {
      if (window.confirm("Clear all locally saved round presets?")) {
        state.history.savedRounds = [];
        saveHistory();
        renderSavedRounds();
      }
    });

    dom.questionGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-grid-index]");
      if (!button) return;
      jumpToQuestion(Number(button.dataset.gridIndex));
    });

    dom.choiceList.addEventListener("click", (event) => {
      const crossOutButton = event.target.closest("[data-crossout-choice-id]");
      if (crossOutButton) {
        toggleChoiceCrossOut(crossOutButton.dataset.crossoutChoiceId);
        return;
      }
      const button = event.target.closest("[data-choice-id]");
      if (!button) return;
      chooseAnswer(button.dataset.choiceId);
    });

    dom.previousQuestionBtn.addEventListener("click", () => jumpToQuestion(state.currentQuestionIndex - 1));
    dom.nextQuestionBtn.addEventListener("click", () => {
      const isLast = state.currentQuestionIndex >= state.currentTest.questions.length - 1;
      if (isLast) {
        openSubmitConfirmModal();
      } else {
        jumpToQuestion(state.currentQuestionIndex + 1);
      }
    });
    dom.flagQuestionBtn.addEventListener("click", toggleFlagCurrentQuestion);
    dom.jumpUnansweredBtn.addEventListener("click", jumpToFirstUnanswered);
    dom.submitTestBtn.addEventListener("click", openSubmitConfirmModal);
    dom.abandonTestBtn.addEventListener("click", () => {
      stopTimer();
      closeSubmitConfirmModal();
      showView("setupView");
    });
    dom.closeSubmitConfirmBtn.addEventListener("click", closeSubmitConfirmModal);
    dom.cancelSubmitConfirmBtn.addEventListener("click", closeSubmitConfirmModal);
    dom.jumpFlaggedBtn.addEventListener("click", jumpToFirstFlagged);
    dom.confirmSubmitBtn.addEventListener("click", () => finalizeTest(false));
    dom.submitConfirmModal.addEventListener("click", (event) => {
      if (event.target === dom.submitConfirmModal) {
        closeSubmitConfirmModal();
      }
    });

    dom.retryMissedBtn.addEventListener("click", startRetryMissedSession);
    dom.newSimulationBtn.addEventListener("click", () => {
      showView("setupView");
      renderSetupWarnings([]);
    });
    dom.saveRoundBtn.addEventListener("click", saveCurrentRound);
    dom.resultsBackBtn.addEventListener("click", () => {
      showView("setupView");
      renderSetupWarnings([]);
    });

    dom.savedRoundsList.addEventListener("click", (event) => {
      const load = event.target.closest("[data-load-preset]");
      const remove = event.target.closest("[data-delete-preset]");
      if (load) loadSavedRound(load.dataset.loadPreset);
      if (remove) deleteSavedRound(remove.dataset.deletePreset);
    });
  }

  async function init() {
    cacheDom();
    registerServiceWorker();
    state.config = await window.HosaBiotechLoader.loadConfig();
    applyConfigDefaults();
    state.bank = window.HosaBiotechLoader.getBank();
    state.bankCatalog = buildBankCatalog();
    state.history = loadHistory();
    buildCustomDomainInputs();
    populateBankOptions();
    bindEvents();
    setTheme(state.history.theme || "dark");
    setNavigatorCollapsed(Boolean(state.history.navigatorCollapsed));
    updateSetupModeUi();
    renderSetupWarnings([]);
    renderSetupSummary();
    showView("setupView");
  }

  init();
})();
