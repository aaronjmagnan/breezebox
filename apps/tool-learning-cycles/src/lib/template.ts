/**
 * The LCC-v1 template: the five steps of a learning cycle, the levels, the
 * stages, and the box labels from the paper organizer.
 *
 * ONE definition, read by the form, the table, the chart, the print view and
 * the Word export. If wording changes it changes here and everywhere at once;
 * nothing re-types a title into a heading.
 *
 * ---------------------------------------------------------------------------
 * VOCABULARY vs MEANING
 * ---------------------------------------------------------------------------
 * A district may rename anything below through `tool_instances.config`. It may
 * not add, remove or reorder steps.
 *
 * That line is deliberate. The five steps ARE the method, and the chart's
 * whole job is to compare schools -- and districts -- on the same five. If one
 * district drops "Try it" and another adds two, "three of five are Routine"
 * stops meaning anything. What a district calls a step is vocabulary; how many
 * there are and what they measure is meaning.
 *
 * So: districts change words, the platform changes structure. A structural
 * change is a new `template_version` authored centrally, and old records keep
 * the version they were answered against.
 *
 * Renames are presentation-only and apply to existing records too. That is the
 * right default -- a district that renames "Pick one practice" to "Choose a
 * focus" is using new words for the same question, and seeing old records in
 * the old vocabulary would be confusing. A rename that changes what the
 * question MEANS is a new template version, not a label override.
 */

export const TEMPLATE_VERSION = 'LCC-v1';

export type StepKey = 'pick' | 'learn' | 'try' | 'see' | 'check';

export type StepDefinition = {
  key: StepKey;
  /** Box label on the paper organizer, e.g. 3a. Never overridable. */
  box: string;
  title: string;
  hint: string;
  levelColumn: `step_${StepKey}_level`;
  noteColumn: `step_${StepKey}_note`;
};

const DEFAULT_STEPS: readonly StepDefinition[] = [
  {
    key: 'pick',
    box: '3a',
    title: 'Pick one practice',
    hint: 'Chosen based on what students need',
    levelColumn: 'step_pick_level',
    noteColumn: 'step_pick_note',
  },
  {
    key: 'learn',
    box: '3b',
    title: 'Learn it together',
    hint: 'Training and a little reading',
    levelColumn: 'step_learn_level',
    noteColumn: 'step_learn_note',
  },
  {
    key: 'try',
    box: '3c',
    title: 'Try it',
    hint: 'Teachers practice before anyone judges it',
    levelColumn: 'step_try_level',
    noteColumn: 'step_try_note',
  },
  {
    key: 'see',
    box: '3d',
    title: 'See it and talk about it',
    hint: 'Visiting colleagues, looking at student work',
    levelColumn: 'step_see_level',
    noteColumn: 'step_see_note',
  },
  {
    key: 'check',
    box: '3e',
    title: 'Check how it is going',
    hint: 'Looking across classrooms and deciding what is next',
    levelColumn: 'step_check_level',
    noteColumn: 'step_check_note',
  },
] as const;

export const LEVELS = ['not_yet', 'happening', 'routine'] as const;
export type Level = (typeof LEVELS)[number];

const DEFAULT_LEVEL_LABELS: Record<Level, string> = {
  not_yet: 'Not yet',
  happening: 'Happening',
  routine: 'Routine',
};

const DEFAULT_LEVEL_MEANINGS: Record<Level, string> = {
  not_yet: "hasn't started",
  happening: 'underway, still uneven',
  routine: 'part of how the school works',
};

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

export const STAGES = ['just_starting', 'in_the_middle', 'wrapping_up'] as const;
export type Stage = (typeof STAGES)[number];

const DEFAULT_STAGE_LABELS: Record<Stage, string> = {
  just_starting: 'Just starting',
  in_the_middle: 'In the middle',
  wrapping_up: 'Wrapping up',
};

export function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}

export const CYCLES = [1, 2, 3, 4] as const;
export type CycleNumber = (typeof CYCLES)[number];

export type SectionKey = 'basics' | 'focus' | 'cycle' | 'conversation';

const DEFAULT_SECTIONS: Record<SectionKey, { number: number; title: string }> = {
  basics: { number: 1, title: 'The basics' },
  focus: { number: 2, title: 'The focus' },
  cycle: { number: 3, title: 'The cycle' },
  conversation: { number: 4, title: 'The conversation' },
};

/** Box labels for section 4, in the order they appear on paper. */
export const CONVERSATION_BOXES = {
  working: '4a',
  barrier: '4b',
  next_step: '4c',
  district_support: '4d',
  next_checkin_date: '4e',
} as const;

// ---------------------------------------------------------------------------
// Per-district overrides
// ---------------------------------------------------------------------------

/** The resolved template a page renders from. Always complete. */
export type Template = {
  version: string;
  steps: readonly StepDefinition[];
  sections: Record<SectionKey, { number: number; title: string }>;
  levelLabels: Record<Level, string>;
  levelMeanings: Record<Level, string>;
  stageLabels: Record<Stage, string>;
};

export const DEFAULT_TEMPLATE: Template = {
  version: TEMPLATE_VERSION,
  steps: DEFAULT_STEPS,
  sections: DEFAULT_SECTIONS,
  levelLabels: DEFAULT_LEVEL_LABELS,
  levelMeanings: DEFAULT_LEVEL_MEANINGS,
  stageLabels: DEFAULT_STAGE_LABELS,
};

/**
 * Longest an override may be. A label is a phrase, not a paragraph: without a
 * cap, one over-enthusiastic rename silently breaks every table column, the
 * segmented control and the print layout at once.
 */
const MAX_TITLE = 60;
const MAX_HINT = 160;

/**
 * Take one string from untrusted config, or fall back.
 *
 * "Untrusted" is the right word even though only a district admin can write
 * this: the value is rendered in five places and exported into a Word file, so
 * it gets length-capped and type-checked here rather than hoped about there.
 * React and the docx library both escape, so the risk is layout, not script.
 */
function label(value: unknown, fallback: string, max: number): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (trimmed === '') return fallback;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Merge a district's label overrides onto the defaults.
 *
 * Anything missing, misspelled, or of the wrong type falls back silently to
 * the default. A district cannot break its own tool by getting the config
 * shape wrong, and unknown keys are ignored rather than rejected, so an older
 * deployment tolerates a config written for a newer one.
 *
 * Expected shape (all optional, all strings):
 *
 *   {
 *     "labels": {
 *       "sections": { "cycle": "The work" },
 *       "steps":    { "pick": { "title": "Choose a focus", "hint": "..." } },
 *       "levels":   { "routine": { "label": "Embedded", "meaning": "..." } },
 *       "stages":   { "just_starting": "Getting going" }
 *     }
 *   }
 */
export function resolveTemplate(config: unknown): Template {
  const labels = record(record(config).labels);
  if (Object.keys(labels).length === 0) return DEFAULT_TEMPLATE;

  const sectionOverrides = record(labels.sections);
  const stepOverrides = record(labels.steps);
  const levelOverrides = record(labels.levels);
  const stageOverrides = record(labels.stages);

  const sections = { ...DEFAULT_SECTIONS };
  for (const key of Object.keys(DEFAULT_SECTIONS) as SectionKey[]) {
    sections[key] = {
      number: DEFAULT_SECTIONS[key].number,
      title: label(sectionOverrides[key], DEFAULT_SECTIONS[key].title, MAX_TITLE),
    };
  }

  const steps = DEFAULT_STEPS.map((step) => {
    const override = record(stepOverrides[step.key]);
    return {
      ...step,
      title: label(override.title, step.title, MAX_TITLE),
      hint: label(override.hint, step.hint, MAX_HINT),
    };
  });

  const levelLabels = { ...DEFAULT_LEVEL_LABELS };
  const levelMeanings = { ...DEFAULT_LEVEL_MEANINGS };
  for (const key of LEVELS) {
    const override = record(levelOverrides[key]);
    levelLabels[key] = label(override.label, DEFAULT_LEVEL_LABELS[key], MAX_TITLE);
    levelMeanings[key] = label(override.meaning, DEFAULT_LEVEL_MEANINGS[key], MAX_HINT);
  }

  const stageLabels = { ...DEFAULT_STAGE_LABELS };
  for (const key of STAGES) {
    stageLabels[key] = label(stageOverrides[key], DEFAULT_STAGE_LABELS[key], MAX_TITLE);
  }

  return {
    version: TEMPLATE_VERSION,
    steps,
    sections,
    levelLabels,
    levelMeanings,
    stageLabels,
  };
}
