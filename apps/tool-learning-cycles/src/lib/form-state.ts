import type { CheckIn } from './checkins';
import { STEPS, TEMPLATE_VERSION, type Level, type Stage } from './template';

/**
 * The shape the form edits.
 *
 * Deliberately a plain object with no nulls beyond the optional ids, so the
 * form never has to reason about undefined vs null vs empty string, and so the
 * future photo step can hand it a partially-filled object without knowing
 * anything about React.
 */
export type CheckInFormValues = {
  siteId: string;
  principalStaffId: string;
  checkinDate: string;
  cycleNumber: number | null;
  stage: Stage | null;
  practice: string;
  studentNeed: string;
  levels: Record<string, Level | null>;
  notes: Record<string, string>;
  working: string;
  barrier: string;
  nextStep: string;
  districtSupport: string;
  nextCheckinDate: string;
};

export function emptyValues(defaults: { siteId?: string } = {}): CheckInFormValues {
  return {
    siteId: defaults.siteId ?? '',
    principalStaffId: '',
    checkinDate: new Date().toISOString().slice(0, 10),
    cycleNumber: null,
    stage: null,
    practice: '',
    studentNeed: '',
    levels: Object.fromEntries(STEPS.map((s) => [s.key, null])),
    notes: Object.fromEntries(STEPS.map((s) => [s.key, ''])),
    working: '',
    barrier: '',
    nextStep: '',
    districtSupport: '',
    nextCheckinDate: '',
  };
}

/** Existing record -> form values. Used by Edit, and by the future photo step. */
export function valuesFromRecord(record: CheckIn): CheckInFormValues {
  return {
    siteId: record.site_id,
    principalStaffId: record.principal_staff_id ?? '',
    checkinDate: record.checkin_date,
    cycleNumber: record.cycle_number,
    stage: (record.stage as Stage | null) ?? null,
    practice: record.practice ?? '',
    studentNeed: record.student_need ?? '',
    levels: Object.fromEntries(
      STEPS.map((s) => [s.key, (record[s.levelColumn] as Level | null) ?? null]),
    ),
    notes: Object.fromEntries(
      STEPS.map((s) => [s.key, (record[s.noteColumn] as string | null) ?? ''])
    ),
    working: record.working ?? '',
    barrier: record.barrier ?? '',
    nextStep: record.next_step ?? '',
    districtSupport: record.district_support ?? '',
    nextCheckinDate: record.next_checkin_date ?? '',
  };
}

/**
 * Form values -> a database row.
 *
 * Empty strings become null, so a field someone opened and left blank is
 * indistinguishable from one they never touched. district_id and created_by
 * are absent on purpose: the server action sets them from the session, and
 * RLS refuses the insert if they do not match.
 */
export function recordFromValues(values: CheckInFormValues) {
  const blankToNull = (v: string) => (v.trim() === '' ? null : v.trim());

  const steps: Record<string, string | null> = {};
  for (const step of STEPS) {
    steps[step.levelColumn] = values.levels[step.key] ?? null;
    steps[step.noteColumn] = blankToNull(values.notes[step.key] ?? '');
  }

  return {
    site_id: values.siteId,
    principal_staff_id: blankToNull(values.principalStaffId),
    template_version: TEMPLATE_VERSION,
    checkin_date: values.checkinDate,
    cycle_number: values.cycleNumber,
    stage: values.stage,
    practice: blankToNull(values.practice),
    student_need: blankToNull(values.studentNeed),
    ...steps,
    working: blankToNull(values.working),
    barrier: blankToNull(values.barrier),
    next_step: blankToNull(values.nextStep),
    district_support: blankToNull(values.districtSupport),
    next_checkin_date: blankToNull(values.nextCheckinDate),
  };
}

/** Only the date and the site are required to submit. */
export function submitBlockers(values: CheckInFormValues): string[] {
  const missing: string[] = [];
  if (!values.siteId) missing.push('a school');
  if (!values.checkinDate) missing.push('a date');
  return missing;
}
