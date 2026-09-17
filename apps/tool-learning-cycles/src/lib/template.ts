/**
 * The LCC-v1 template: the five steps of a learning cycle, the levels, the
 * stages, and the box labels from the paper organizer.
 *
 * ONE definition, read by the form, the table, the chart and the print view.
 * If a step's wording changes it changes here and everywhere at once; nothing
 * re-types a title into a heading.
 *
 * Bumping the wording in a way that changes meaning means a new
 * template_version, so old records keep the words they were answered against.
 */

export const TEMPLATE_VERSION = 'LCC-v1';

export type StepKey = 'pick' | 'learn' | 'try' | 'see' | 'check';

export type StepDefinition = {
  key: StepKey;
  /** Box label on the paper organizer, e.g. 3a. */
  box: string;
  title: string;
  hint: string;
  /** Column names on learning_cycle_checkins. */
  levelColumn: `step_${StepKey}_level`;
  noteColumn: `step_${StepKey}_note`;
};

export const STEPS: readonly StepDefinition[] = [
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

// --- Levels -----------------------------------------------------------------

export const LEVELS = ['not_yet', 'happening', 'routine'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  not_yet: 'Not yet',
  happening: 'Happening',
  routine: 'Routine',
};

/** The legend shown above the steps, and reused in the print view. */
export const LEVEL_MEANINGS: Record<Level, string> = {
  not_yet: "hasn't started",
  happening: 'underway, still uneven',
  routine: 'part of how the school works',
};

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

// --- Stage ------------------------------------------------------------------

export const STAGES = ['just_starting', 'in_the_middle', 'wrapping_up'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  just_starting: 'Just starting',
  in_the_middle: 'In the middle',
  wrapping_up: 'Wrapping up',
};

export function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}

// --- Cycle ------------------------------------------------------------------

export const CYCLES = [1, 2, 3, 4] as const;
export type CycleNumber = (typeof CYCLES)[number];

// --- Section labels, matching the paper organizer ---------------------------

export const SECTIONS = {
  basics: { number: 1, title: 'The basics' },
  focus: { number: 2, title: 'The focus' },
  cycle: { number: 3, title: 'The cycle' },
  conversation: { number: 4, title: 'The conversation' },
} as const;

/** Box labels for section 4, in the order they appear on paper. */
export const CONVERSATION_BOXES = {
  working: '4a',
  barrier: '4b',
  next_step: '4c',
  district_support: '4d',
  next_checkin_date: '4e',
} as const;
