(function () {
  const STORAGE_KEY = "hosa_biotech_sim_platform_v1";
  const LETTERS = ["A", "B", "C", "D", "E"];

  const state = {
    config: null,
    bank: [],
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
      "lengthSelect",
      "customLengthField",
      "customLengthInput",
      "timerEnabledToggle",
      "timerMinutesInput",
      "feedbackModeSelect",
      "priorityModeSelect",
      "careerBiasSelect",
      "answerRandomizationToggle",
      "showDomainToggle",
      "chapterOnlyToggle",
      "includeCareersToggle",
      "includeEntityToggle",
      "includeOldChatToggle",
      "includeManualReviewToggle",
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
      "toggleNavigatorBtn",
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
      "scorePercent",
      "scoreRaw",
      "resultsStats",
      "resultsDomainBars",
      "reviewList",
      "retryMissedBtn",
      "newSimulationBtn",
      "saveRoundBtn",
      "exportJsonBtn",
      "exportTextBtn",
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
      return Object.assign(window.HosaBiotechLoader.createEmptyHistoryState(), JSON.parse(raw));
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

  function showView(viewName) {
    ["setupView", "testView", "resultsView"].forEach((name) => {
      dom[name].classList.toggle("hidden", name !== viewName);
      dom[name].classList.toggle("active", name === viewName);
    });
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
    const careerBias = dom.careerBiasSelect.value;
    const includeCareers = careerBias === "exclude_careers" ? false : dom.includeCareersToggle.checked;

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

    if (mode === "weak_domains") {
      customDistribution = buildWeakDomainDistribution(length);
    }

    if (!customDistribution && mode !== "custom_domain_mix") {
      customDistribution = window.HosaBiotechLoader.getScaledDistribution(state.config.exact_50_distribution, length);
    }

    return {
      mode,
      length,
      timerEnabled,
      timerMinutes,
      feedbackMode,
      includeManualReview: dom.includeManualReviewToggle.checked,
      includeEntityBank: dom.includeEntityToggle.checked,
      includeOldChat: dom.includeOldChatToggle.checked,
      includeCareers,
      chapterOnly: dom.chapterOnlyToggle.checked,
      priorityMode,
      answerRandomization: dom.answerRandomizationToggle.checked,
      showDomainLabels: dom.showDomainToggle.checked,
      careerBias,
      customDistribution,
      allowLowPriorityFallback: !["gold_high_only", "exclude_low"].includes(priorityMode),
      weakDomainSet: getWeakDomainSet(),
      warnings,
      roundMode: Boolean(options.roundMode),
    };
  }

  function questionAllowed(question, settings) {
    if (!settings.includeManualReview && question.manual_review) return false;
    if (!settings.includeEntityBank && question.source_group === "entity_bank") return false;
    if (!settings.includeOldChat && question.source_group === "old_chat_master") return false;
    if (!settings.includeCareers && question.source_group === "careers") return false;
    if (settings.chapterOnly && !["chapter_platform", "anchor_addition"].includes(question.source_group)) return false;

    if (settings.priorityMode === "gold_high_only") {
      if (!["gold_anchor", "high_yield_seed", "manual_scored_high", "provisional_high"].includes(question.priority_tier)) return false;
    }

    if (settings.priorityMode === "exclude_low" && question.priority_tier === "low_priority") return false;
    if (question.priority_tier === "avoid_until_review" && !settings.includeManualReview) return false;

    if (settings.mode === "high_yield_only") {
      return ["gold_anchor", "high_yield_seed", "manual_scored_high", "provisional_high"].includes(question.priority_tier);
    }

    return true;
  }

  function getLastTwoTests() {
    return state.history.tests.slice(-2);
  }

  function computeQuestionWeight(question, settings) {
    let weight = state.config.priority_weights[question.priority_tier] || 1;
    const stats = state.history.questionStats[question.corpus_id];
    const recentTests = getLastTwoTests();

    if (!stats || !stats.attempts) {
      weight *= state.config.freshness_weights.unseen_multiplier;
    } else {
      if ((stats.incorrect || 0) > 0) weight *= state.config.freshness_weights.missed_multiplier * Math.min(1.5, 1 + stats.incorrect * 0.08);
      if ((stats.correct || 0) > 0 && (stats.incorrect || 0) === 0) weight *= state.config.freshness_weights.recent_correct_multiplier;
    }

    if (recentTests.some((test) => test.questionIds.includes(question.corpus_id))) {
      weight *= state.config.freshness_weights.recent_last_two_tests_multiplier;
    }

    if (settings.mode === "fresh_questions_only") {
      weight *= (!stats || !stats.attempts) ? 1.6 : 0.22;
    }

    if (settings.mode === "missed_questions") {
      weight *= stats && (stats.incorrect || 0) > 0 ? 2.4 : 0.22;
    }

    if (settings.mode === "weak_domains") {
      weight *= settings.weakDomainSet.has(question.primary_domain) ? 1.8 : 0.34;
    }

    if (question.slc_sqt_anchor && question.priority_tier === "gold_anchor") {
      weight *= 1.1;
    }

    if (question.primary_domain === "biotechnology_industry_practices_and_careers") {
      if (settings.careerBias === "education_training_bias" && question.career_question_type === "education_training") weight *= 1.55;
      if (settings.careerBias === "technician_task_bias" && question.career_question_type === "task_matching") weight *= 1.8;
      if (["related_job_areas", "career_options", "professional_skills"].includes(question.career_question_type)) weight *= 0.55;
    }

    return Math.max(0, weight);
  }

  function sampleWeightedWithoutReplacement(items, count, rng, weightFn) {
    const pool = items.slice();
    const selected = [];
    while (pool.length && selected.length < count) {
      const weights = pool.map(weightFn);
      const total = weights.reduce((sum, value) => sum + value, 0);
      if (total <= 0) break;
      let target = rng() * total;
      let chosenIndex = 0;
      for (let i = 0; i < pool.length; i += 1) {
        target -= weights[i];
        if (target <= 0) {
          chosenIndex = i;
          break;
        }
      }
      selected.push(pool[chosenIndex]);
      pool.splice(chosenIndex, 1);
    }
    return selected;
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

    const rng = makeRng(Math.floor(Date.now() % 2147483647));
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

      let candidates = allCandidates;
      if (settings.priorityMode !== "include_low") {
        candidates = candidates.filter((question) => question.priority_tier !== "low_priority");
      }

      if (candidates.length < needed && settings.allowLowPriorityFallback) {
        candidates = allCandidates;
        if (allCandidates.length >= needed) {
          warnings.push(`${window.HosaBiotechLoader.DOMAIN_LABELS[domain]} required low-priority fallback to fill quota.`);
        }
      }

      if (candidates.length < needed) {
        throw new Error(`${window.HosaBiotechLoader.DOMAIN_LABELS[domain]} only has ${candidates.length} available questions for a quota of ${needed}.`);
      }

      const picked = sampleWeightedWithoutReplacement(candidates, needed, rng, (question) => computeQuestionWeight(question, settings));
      if (picked.length < needed) {
        throw new Error(`${window.HosaBiotechLoader.DOMAIN_LABELS[domain]} could not produce enough weighted picks.`);
      }

      picked.forEach((question) => {
        selectedIds.add(question.corpus_id);
        questions.push(question);
      });
    }

    shuffleArray(questions, rng);

    const roundLabel = settings.roundMode
      ? `Round ${state.history.roundCounter + 1}`
      : settings.mode === "custom_domain_mix"
        ? "Custom Mix"
        : "Simulation";

    const preparedQuestions = questions.map((question, index) => prepareQuestionForSession(question, index, settings, rng));

    return {
      testId: `test-${Date.now()}`,
      createdAt: Date.now(),
      roundLabel,
      mode: settings.mode,
      settings,
      warnings,
      questions: preparedQuestions,
      startedAt: Date.now(),
      endsAt: settings.timerEnabled ? Date.now() + settings.timerMinutes * 60 * 1000 : null,
    };
  }

  function prepareQuestionForSession(question, index, settings, rng) {
    const choices = deepClone(question.choices);
    if (settings.answerRandomization && question.shuffle_safe) {
      shuffleArray(choices, rng);
    }

    const renderedChoices = choices.map((choice, choiceIndex) => ({
      id: LETTERS[choiceIndex],
      original_letter: choice.letter_original,
      text: choice.text,
      isCorrect: normalize(choice.text) === normalize(question.correct_answer_text),
    }));

    return {
      orderIndex: index,
      question,
      renderedChoices,
      userAnswerId: "",
      flagged: false,
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
    const stats = [
      { label: "Compiled Bank", value: summary.totalQuestions || state.bank.length },
      { label: "Default Usable", value: summary.defaultUsableQuestions || state.bank.length },
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

    const defaultUsable = state.bank.filter((question) => !question.manual_review && !["avoid_until_review", "low_priority"].includes(question.priority_tier));
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
    dom.testModeChip.textContent = test.mode === "hosa_weighted_full_simulation" ? "HOSA Weighted" : test.mode.replace(/_/g, " ");
    dom.roundTitle.textContent = test.roundLabel;
    dom.roundMeta.textContent = `${test.questions.length} questions • ${test.settings.timerEnabled ? `${test.settings.timerMinutes} minute timer` : "untimed"} • end grading`;
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

  function renderCurrentQuestion() {
    const entry = state.currentTest.questions[state.currentQuestionIndex];
    const question = entry.question;
    dom.questionCounterChip.textContent = `Question ${state.currentQuestionIndex + 1} of ${state.currentTest.questions.length}`;
    dom.priorityChip.textContent = question.priority_tier.replace(/_/g, " ");
    dom.sourceChip.textContent = question.source_name;
    dom.domainChip.textContent = window.HosaBiotechLoader.DOMAIN_LABELS[question.primary_domain] || question.primary_domain;
    dom.domainChip.classList.toggle("hidden", !state.currentTest.settings.showDomainLabels);
    dom.questionText.textContent = question.question_text;
    dom.questionMetaLine.textContent = `${question.corpus_id} • ${question.choice_count} choices • ${question.domain_confidence} confidence`;
    dom.flagQuestionBtn.textContent = entry.flagged ? "Unflag Question" : "Flag for Review";

    dom.choiceList.innerHTML = entry.renderedChoices
      .map((choice) => {
        const classes = ["choice-button"];
        if (entry.userAnswerId === choice.id) classes.push("selected");
        return `
          <button class="${classes.join(" ")}" type="button" data-choice-id="${choice.id}">
            <span class="choice-badge">${choice.id}</span>
            <span class="choice-copy">${choice.text}</span>
          </button>
        `;
      })
      .join("");

    renderImmediateFeedback(entry);
    renderQuestionGrid();
    renderTestProgress();
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
    dom.immediateFeedbackBox.className = `feedback-box ${isCorrect ? "correct" : "incorrect"}`;
    dom.immediateFeedbackBox.innerHTML = `
      <strong>${isCorrect ? "Correct" : "Not correct yet"}</strong>
      <div class="review-block">Correct answer: ${correctChoice.id}. ${correctChoice.text}</div>
      <div class="review-block">${entry.question.explanation}</div>
      <div class="review-block">Source cue: ${entry.question.source_cue || "Not listed."}</div>
    `;
  }

  function chooseAnswer(choiceId) {
    const entry = state.currentTest.questions[state.currentQuestionIndex];
    entry.userAnswerId = choiceId;
    entry.answeredAt = Date.now();
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
    const unanswered = test.questions.filter((entry) => !entry.userAnswerId).length;
    if (!autoSubmitted && unanswered > 0) {
      const confirmed = window.confirm(`You still have ${unanswered} unanswered question(s). Submit anyway?`);
      if (!confirmed) return;
    }

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
  }

  function updateHistoryFromResult(result) {
    result.reviewEntries.forEach((item) => {
      const id = item.entry.question.corpus_id;
      const stats = state.history.questionStats[id] || {
        attempts: 0,
        correct: 0,
        incorrect: 0,
        lastSeenAt: null,
        lastTestId: null,
      };
      stats.attempts += 1;
      if (item.correct) stats.correct += 1;
      else if (!item.unanswered) stats.incorrect += 1;
      stats.lastSeenAt = result.completedAt;
      stats.lastTestId = result.testId;
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
    dom.resultsModeChip.textContent = result.roundLabel;
    dom.resultsHeadline.textContent = result.autoSubmitted ? "Time Expired — Test Submitted" : "Simulation Complete";
    dom.resultsSummaryText.textContent = `${result.correct} correct • ${result.incorrect} incorrect • ${result.unanswered} unanswered • ${result.timeUsedLabel} used`;
    dom.scorePercent.textContent = `${result.percent}%`;
    dom.scoreRaw.textContent = `${result.correct} / ${result.total}`;

    const stats = [
      { label: "Correct", value: result.correct },
      { label: "Incorrect", value: result.incorrect },
      { label: "Unanswered", value: result.unanswered },
      { label: "Flagged", value: result.reviewEntries.filter((item) => item.entry.flagged).length },
      { label: "Missed", value: result.reviewEntries.filter((item) => !item.correct).length },
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

    dom.reviewList.innerHTML = result.reviewEntries.map((item, index) => {
      const question = item.entry.question;
      const stateText = item.correct ? "Correct" : item.unanswered ? "Unanswered" : "Missed";
      const userAnswer = item.userChoice ? `${item.userChoice.id}. ${item.userChoice.text}` : "No answer selected";
      return `
        <article class="review-card">
          <div class="review-card-head">
            <div>
              <h4>${index + 1}. ${question.question_text}</h4>
              <div class="question-meta-line">${question.corpus_id} • ${window.HosaBiotechLoader.DOMAIN_LABELS[question.primary_domain]} • ${question.priority_tier.replace(/_/g, " ")}</div>
            </div>
            <span class="chip ${item.correct ? "chip-primary" : "chip-secondary"}">${stateText}</span>
          </div>
          <div class="review-block"><strong>Your answer:</strong> ${userAnswer}</div>
          <div class="review-block"><strong>Correct answer:</strong> ${item.correctChoice.id}. ${item.correctChoice.text}</div>
          <div class="review-block"><strong>Explanation:</strong> ${question.explanation || "No explanation listed."}</div>
          <div class="review-block"><strong>Source cue:</strong> ${question.source_cue || "Not listed."}</div>
          <div class="review-block"><strong>Source:</strong> ${question.source_name}</div>
          ${question.manual_review ? `<div class="review-block"><strong>Manual review:</strong> ${question.manual_review_reason}</div>` : ""}
          ${item.entry.flagged ? `<div class="review-block"><strong>Flagged during test:</strong> yes</div>` : ""}
        </article>
      `;
    }).join("");
  }

  function startRetryMissedSession() {
    if (!state.currentTest || !state.currentTest.result) return;
    const missedQuestions = state.currentTest.result.reviewEntries
      .filter((item) => !item.correct)
      .map((item) => item.entry.question);

    if (!missedQuestions.length) {
      alert("There are no missed questions to retry.");
      return;
    }

    const rng = makeRng(Math.floor(Date.now() % 2147483647));
    const settings = Object.assign({}, state.currentTest.settings, {
      mode: "untimed_review_mode",
      timerEnabled: false,
      feedbackMode: "immediate_review",
      length: missedQuestions.length,
    });

    const test = {
      testId: `retry-${Date.now()}`,
      createdAt: Date.now(),
      roundLabel: "Retry Missed Questions",
      mode: "untimed_review_mode",
      settings,
      warnings: [],
      questions: missedQuestions.map((question, index) => prepareQuestionForSession(question, index, settings, rng)),
      startedAt: Date.now(),
      endsAt: null,
    };

    beginTest(test);
  }

  function exportResult(format) {
    if (!state.currentTest || !state.currentTest.result) return;
    const result = state.currentTest.result;

    let blob;
    let filename;
    if (format === "json") {
      blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      filename = `${result.testId}.json`;
    } else {
      const text = [
        `${result.roundLabel}`,
        `Score: ${result.correct}/${result.total} (${result.percent}%)`,
        `Time used: ${result.timeUsedLabel}`,
        "",
        ...result.reviewEntries.map((item, index) => {
          const question = item.entry.question;
          const userAnswer = item.userChoice ? `${item.userChoice.id}. ${item.userChoice.text}` : "No answer";
          return [
            `${index + 1}. ${question.question_text}`,
            `Your answer: ${userAnswer}`,
            `Correct answer: ${item.correctChoice.id}. ${item.correctChoice.text}`,
            `Explanation: ${question.explanation || "No explanation listed."}`,
            `Source cue: ${question.source_cue || "Not listed."}`,
            "",
          ].join("\n");
        }),
      ].join("\n");
      blob = new Blob([text], { type: "text/plain" });
      filename = `${result.testId}.txt`;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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
    const rng = makeRng(Math.floor(Date.now() % 2147483647));
    const questions = preset.questionIds
      .map((id) => state.bank.find((question) => question.corpus_id === id))
      .filter(Boolean);

    if (!questions.length) {
      alert("That saved round no longer matches any questions in the compiled bank.");
      return;
    }

    const test = {
      testId: `preset-${Date.now()}`,
      createdAt: Date.now(),
      roundLabel: preset.label,
      mode: "saved_preset",
      settings: Object.assign({}, preset.settings, { timerEnabled: false }),
      warnings: ["Loaded from local saved round preset."],
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
    const confirmed = window.confirm("Reset local question history, scores, saved rounds, and freshness tracking?");
    if (!confirmed) return;
    state.history = window.HosaBiotechLoader.createEmptyHistoryState();
    saveHistory();
    renderSetupSummary();
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

    dom.lengthSelect.addEventListener("change", () => {
      dom.customLengthField.classList.toggle("hidden", dom.lengthSelect.value !== "custom");
    });

    dom.modeSelect.addEventListener("change", () => {
      const custom = dom.modeSelect.value === "custom_domain_mix";
      dom.customDomainPanel.open = custom;
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
      const button = event.target.closest("[data-choice-id]");
      if (!button) return;
      chooseAnswer(button.dataset.choiceId);
    });

    dom.previousQuestionBtn.addEventListener("click", () => jumpToQuestion(state.currentQuestionIndex - 1));
    dom.nextQuestionBtn.addEventListener("click", () => jumpToQuestion(state.currentQuestionIndex + 1));
    dom.flagQuestionBtn.addEventListener("click", toggleFlagCurrentQuestion);
    dom.jumpUnansweredBtn.addEventListener("click", jumpToFirstUnanswered);
    dom.submitTestBtn.addEventListener("click", () => finalizeTest(false));
    dom.abandonTestBtn.addEventListener("click", () => {
      stopTimer();
      showView("setupView");
    });

    dom.retryMissedBtn.addEventListener("click", startRetryMissedSession);
    dom.newSimulationBtn.addEventListener("click", () => {
      showView("setupView");
      renderSetupWarnings([]);
    });
    dom.saveRoundBtn.addEventListener("click", saveCurrentRound);
    dom.exportJsonBtn.addEventListener("click", () => exportResult("json"));
    dom.exportTextBtn.addEventListener("click", () => exportResult("text"));

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
    state.bank = window.HosaBiotechLoader.getBank();
    state.history = loadHistory();
    buildCustomDomainInputs();
    bindEvents();
    setTheme(state.history.theme || "dark");
    setNavigatorCollapsed(Boolean(state.history.navigatorCollapsed));
    renderSetupWarnings([]);
    renderSetupSummary();
    showView("setupView");
  }

  init();
})();
