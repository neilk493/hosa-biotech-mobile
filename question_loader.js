(function () {
  const DOMAIN_LABELS = {
    biotechnology_industry_practices_and_careers: "Industry Practices & Careers",
    biotechnology_in_health: "Biotechnology in Health",
    governmental_regulation_of_biotechnology: "Government Regulation",
    basic_laboratory_skills: "Basic Laboratory Skills",
    microbiology_and_cell_culture: "Microbiology & Cell Culture",
    dna_structure_and_analysis: "DNA Structure & Analysis",
    bacterial_transformation: "Bacterial Transformation",
    polymerase_chain_reaction: "Polymerase Chain Reaction",
    protein_structure_function_and_analysis: "Protein Structure / Function / Analysis",
    immunological_applications: "Immunological Applications",
  };

  const DEFAULT_CONFIG = {
    app_name: "HOSA Biotechnology Simulation Platform",
    version: "1.0.0",
    default_mode: "hosa_weighted_full_simulation",
    default_test_length: 50,
    default_timer_minutes: 50,
    exact_50_distribution: {
      biotechnology_industry_practices_and_careers: 2,
      biotechnology_in_health: 2,
      governmental_regulation_of_biotechnology: 2,
      basic_laboratory_skills: 7,
      microbiology_and_cell_culture: 6,
      dna_structure_and_analysis: 7,
      bacterial_transformation: 5,
      polymerase_chain_reaction: 7,
      protein_structure_function_and_analysis: 7,
      immunological_applications: 5,
    },
    priority_weights: {
      gold_anchor: 8,
      high_yield_seed: 6,
      manual_scored_high: 5,
      provisional_high: 4,
      normal: 2,
      low_priority: 0.5,
      avoid_until_review: 0,
    },
    freshness_weights: {
      unseen_multiplier: 1.8,
      missed_multiplier: 1.2,
      recent_correct_multiplier: 0.72,
      recent_last_two_tests_multiplier: 0.08,
    },
    default_filters: {
      include_manual_review: false,
      include_entity_bank: true,
      include_old_chat_master: true,
      include_careers: true,
      chapter_only: false,
      priority_mode: "normal_weighted",
      answer_randomization: true,
      career_bias: "education_training_bias",
    },
    domain_labels: DOMAIN_LABELS,
  };

  const PRIORITY_LABELS = {
    gold_anchor: "Gold Anchor",
    high_yield_seed: "High-Yield Seed",
    manual_scored_high: "Manual High",
    provisional_high: "Provisional High",
    normal: "Normal",
    low_priority: "Low Priority",
    avoid_until_review: "Avoid Until Review",
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function getBank() {
    return Array.isArray(window.HOSA_BIOTECH_QUESTION_BANK) ? window.HOSA_BIOTECH_QUESTION_BANK : [];
  }

  async function loadConfig() {
    if (window.HOSA_BIOTECH_PLATFORM_CONFIG) {
      return deepClone(window.HOSA_BIOTECH_PLATFORM_CONFIG);
    }

    try {
      const response = await fetch("platform_config.json", { cache: "no-store" });
      if (response.ok) {
        const json = await response.json();
        return Object.assign({}, deepClone(DEFAULT_CONFIG), json);
      }
    } catch (error) {
      // Local file mode can block fetch; the default config keeps the app usable.
    }

    return deepClone(DEFAULT_CONFIG);
  }

  function getScaledDistribution(baseDistribution, length) {
    if (length === 50) {
      return Object.assign({}, baseDistribution);
    }

    const entries = Object.entries(baseDistribution).map(([domain, count]) => {
      const raw = (count / 50) * length;
      return {
        domain,
        floor: Math.floor(raw),
        remainder: raw - Math.floor(raw),
      };
    });

    let remaining = length - entries.reduce((sum, entry) => sum + entry.floor, 0);
    entries.sort((a, b) => b.remainder - a.remainder || a.domain.localeCompare(b.domain));
    for (let i = 0; i < entries.length && remaining > 0; i += 1) {
      entries[i].floor += 1;
      remaining -= 1;
    }

    const output = {};
    for (const entry of entries) output[entry.domain] = entry.floor;
    return output;
  }

  function createEmptyHistoryState() {
    return {
      version: 1,
      questionStats: {},
      perDomain: {},
      tests: [],
      savedRounds: [],
      roundCounter: 0,
      theme: "dark",
      navigatorCollapsed: false,
    };
  }

  window.HosaBiotechLoader = {
    DOMAIN_LABELS,
    PRIORITY_LABELS,
    DEFAULT_CONFIG,
    createEmptyHistoryState,
    getBank,
    getScaledDistribution,
    loadConfig,
    deepClone,
    normalize,
  };
})();
