'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  ChoiceGroup,
  Field,
  Select,
  TextInput,
  Textarea,
} from '@breezebox/ui';
import {
  CYCLES,
  LEVELS,
  STAGES,
  type Level,
  type Stage,
  type Template,
} from '@/lib/template';
import {
  emptyValues,
  submitBlockers,
  type CheckInFormValues,
} from '@/lib/form-state';
import {
  createDraft,
  saveDraft,
  staffAtSite,
  submitCheckIn,
  updateSubmitted,
} from '@/app/actions';

/**
 * The check-in form (backbone §6, §7).
 *
 * PHONE FIRST. This is filled in during a coaching conversation, standing in a
 * hallway, on a phone.
 *
 * Two things shape the design:
 *
 *  - It takes `initialValues`, so the future photo-capture step can hand it a
 *    pre-filled object for review without this component knowing a photo was
 *    ever involved. That is the whole extension point.
 *  - Autosave goes to the SERVER, debounced. Nothing is written to
 *    localStorage or IndexedDB: a check-in names a school and a named
 *    principal's practice, and §11 keeps district data off the device.
 */

const AUTOSAVE_DEBOUNCE_MS = 1200;

export type CheckInFormProps = {
  initialValues?: CheckInFormValues;
  /** Existing record being edited, if any. */
  recordId?: string;
  /** True when editing something already submitted. */
  alreadySubmitted?: boolean;
  sites: Array<{ id: string; name: string }>;
  /** Site-bound users cannot change school. */
  canChooseSite: boolean;
  initialStaff?: Array<{ id: string; name: string }>;
  /** The district's own wording. Every visible string comes from here. */
  template: Template;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function CheckInForm({
  initialValues,
  recordId,
  alreadySubmitted = false,
  sites,
  canChooseSite,
  initialStaff = [],
  template,
}: CheckInFormProps) {
  const router = useRouter();

  const [values, setValues] = useState<CheckInFormValues>(
    () => initialValues ?? emptyValues({ siteId: sites.length === 1 ? sites[0]?.id : '' }),
  );
  const [id, setId] = useState<string | null>(recordId ?? null);
  const [staff, setStaff] = useState(initialStaff);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The first render must not trigger a save, or opening the form would create
  // an empty draft for anyone who glances at it and leaves.
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);

  const update = useCallback(<K extends keyof CheckInFormValues>(
    key: K,
    value: CheckInFormValues[K],
  ) => {
    dirty.current = true;
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  const setStepLevel = useCallback((key: string, level: Level) => {
    dirty.current = true;
    setValues((current) => ({
      ...current,
      levels: { ...current.levels, [key]: current.levels[key] === level ? null : level },
    }));
  }, []);

  const setStepNote = useCallback((key: string, note: string) => {
    dirty.current = true;
    setValues((current) => ({ ...current, notes: { ...current.notes, [key]: note } }));
  }, []);

  // Autosave, debounced. Only once a school is chosen: the row cannot exist
  // without one, and nagging about it while someone is still reading would be
  // noise.
  useEffect(() => {
    if (!dirty.current || !values.siteId) return;

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaveState('saving');
      const result = id
        ? alreadySubmitted
          ? await updateSubmitted(id, values)
          : await saveDraft(id, values)
        : await createDraft(values);

      if (result.ok) {
        if (!id) setId(result.id);
        setSaveState('saved');
      } else {
        setSaveState('error');
        setError(result.error);
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [values, id, alreadySubmitted]);

  // Reloading the principal list is the one side effect of changing school.
  useEffect(() => {
    if (!values.siteId) {
      setStaff([]);
      return;
    }
    let cancelled = false;
    void staffAtSite(values.siteId).then((rows) => {
      if (!cancelled) setStaff(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [values.siteId]);

  const blockers = submitBlockers(values);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (blockers.length > 0) return;

    setSubmitting(true);
    setError(null);

    // Flush any pending autosave rather than racing it.
    if (timer.current) window.clearTimeout(timer.current);

    let targetId = id;
    if (!targetId) {
      const created = await createDraft(values);
      if (!created.ok) {
        setError(created.error);
        setSubmitting(false);
        return;
      }
      targetId = created.id;
      setId(targetId);
    }

    const result = alreadySubmitted
      ? await updateSubmitted(targetId, values)
      : await submitCheckIn(targetId, values);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    router.push(`/${targetId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* 1. The basics */}
      <Card as="section" aria-labelledby="sec-basics">
        <h2 id="sec-basics" className="text-base font-semibold">
          {template.sections.basics.number}. {template.sections.basics.title}
        </h2>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="School" required>
            {({ id: fieldId, describedBy }) =>
              canChooseSite ? (
                <Select
                  id={fieldId}
                  aria-describedby={describedBy}
                  value={values.siteId}
                  onChange={(e) => update('siteId', e.target.value)}
                  required
                >
                  <option value="">Choose a school</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <>
                  <TextInput
                    id={fieldId}
                    aria-describedby={describedBy}
                    value={sites.find((s) => s.id === values.siteId)?.name ?? ''}
                    readOnly
                    disabled
                  />
                  <input type="hidden" value={values.siteId} />
                </>
              )
            }
          </Field>

          <Field
            label="Principal"
            hint="Optional. Only shows people who have signed in at this school."
          >
            {({ id: fieldId, describedBy }) => (
              <Select
                id={fieldId}
                aria-describedby={describedBy}
                value={values.principalStaffId}
                onChange={(e) => update('principalStaffId', e.target.value)}
                disabled={!values.siteId}
              >
                <option value="">Not recorded</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Date" required>
            {({ id: fieldId, describedBy }) => (
              <TextInput
                id={fieldId}
                aria-describedby={describedBy}
                type="date"
                value={values.checkinDate}
                onChange={(e) => update('checkinDate', e.target.value)}
                required
              />
            )}
          </Field>
        </div>
      </Card>

      {/* 2. The focus */}
      <Card as="section" aria-labelledby="sec-focus">
        <h2 id="sec-focus" className="text-base font-semibold">
          {template.sections.focus.number}. {template.sections.focus.title}
        </h2>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="What practice is the staff working on?">
            {({ id: fieldId }) => (
              <Textarea
                id={fieldId}
                value={values.practice}
                onChange={(e) => update('practice', e.target.value)}
              />
            )}
          </Field>

          <Field label="What student need led to it?">
            {({ id: fieldId }) => (
              <Textarea
                id={fieldId}
                value={values.studentNeed}
                onChange={(e) => update('studentNeed', e.target.value)}
              />
            )}
          </Field>
        </div>
      </Card>

      {/* 3. The cycle */}
      <Card as="section" aria-labelledby="sec-cycle">
        <h2 id="sec-cycle" className="text-base font-semibold">
          {template.sections.cycle.number}. {template.sections.cycle.title}
        </h2>

        <div className="mt-4 flex flex-col gap-5">
          <ChoiceGroup
            name="cycle"
            legend="Which cycle?"
            options={CYCLES.map((n) => ({ value: String(n), label: `Cycle ${n}` }))}
            value={values.cycleNumber === null ? null : String(values.cycleNumber)}
            onChange={(v) => update('cycleNumber', Number(v))}
          />

          <ChoiceGroup
            name="stage"
            legend="Where are they in it?"
            options={STAGES.map((s) => ({ value: s, label: template.stageLabels[s] }))}
            value={values.stage}
            onChange={(v) => update('stage', v as Stage)}
          />

          <div>
            <h3 className="text-sm font-semibold">
              The {template.steps.length} steps
            </h3>
            <dl className="mt-2 flex flex-col gap-1 text-sm leading-relaxed text-bb-muted">
              {LEVELS.map((level) => (
                <div key={level} className="flex gap-1">
                  <dt className="font-semibold">{template.levelLabels[level]}:</dt>
                  <dd>{template.levelMeanings[level]}</dd>
                </div>
              ))}
            </dl>
          </div>

          {template.steps.map((step) => (
            <div key={step.key} className="border-t border-bb-border pt-4">
              <h4 className="text-base font-semibold">{step.title}</h4>
              <p className="mt-0.5 text-sm leading-relaxed text-bb-muted">{step.hint}</p>

              <ChoiceGroup
                name={`level-${step.key}`}
                legend={`How is "${step.title}" going?`}
                hideLegend
                variant="segmented"
                options={LEVELS.map((level) => ({
                  value: level,
                  label: template.levelLabels[level],
                }))}
                value={values.levels[step.key] ?? null}
                onChange={(v) => setStepLevel(step.key, v as Level)}
                className="mt-3"
              />

              <Field label="Note" className="mt-3">
                {({ id: fieldId }) => (
                  <Textarea
                    id={fieldId}
                    rows={2}
                    value={values.notes[step.key] ?? ''}
                    onChange={(e) => setStepNote(step.key, e.target.value)}
                  />
                )}
              </Field>
            </div>
          ))}
        </div>
      </Card>

      {/* 4. The conversation */}
      <Card as="section" aria-labelledby="sec-conversation">
        <h2 id="sec-conversation" className="text-base font-semibold">
          {template.sections.conversation.number}. {template.sections.conversation.title}
        </h2>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="What is working?">
            {({ id: fieldId }) => (
              <Textarea
                id={fieldId}
                value={values.working}
                onChange={(e) => update('working', e.target.value)}
              />
            )}
          </Field>

          <Field label="What is getting in the way?">
            {({ id: fieldId }) => (
              <Textarea
                id={fieldId}
                value={values.barrier}
                onChange={(e) => update('barrier', e.target.value)}
              />
            )}
          </Field>

          <Field label="Next step">
            {({ id: fieldId }) => (
              <Textarea
                id={fieldId}
                value={values.nextStep}
                onChange={(e) => update('nextStep', e.target.value)}
              />
            )}
          </Field>

          <Field label="Support needed from the district">
            {({ id: fieldId }) => (
              <Textarea
                id={fieldId}
                value={values.districtSupport}
                onChange={(e) => update('districtSupport', e.target.value)}
              />
            )}
          </Field>

          <Field label="Next check-in">
            {({ id: fieldId }) => (
              <TextInput
                id={fieldId}
                type="date"
                value={values.nextCheckinDate}
                onChange={(e) => update('nextCheckinDate', e.target.value)}
              />
            )}
          </Field>
        </div>
      </Card>

      {/* Save state and submit. Sticky on a phone so Submit is always reachable. */}
      <div className="sticky bottom-0 -mx-4 border-t border-bb-border bg-bb-bg px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p aria-live="polite" className="text-sm text-bb-muted">
          {saveState === 'saving'
            ? 'Saving…'
            : saveState === 'saved'
              ? 'Saved'
              : saveState === 'error'
                ? 'Not saved yet'
                : alreadySubmitted
                  ? 'Editing a submitted check-in'
                  : 'Saves as you go'}
        </p>

        {error ? (
          <p role="alert" className="mt-1 text-sm text-accent-coral-ink">
            {error}
          </p>
        ) : null}

        {blockers.length > 0 ? (
          <p className="mt-1 text-sm text-bb-muted">
            Add {blockers.join(' and ')} to submit.
          </p>
        ) : null}

        <Button
          variant="primary"
          fullWidth
          type="submit"
          className="mt-3"
          disabled={submitting || blockers.length > 0}
        >
          {submitting
            ? 'Submitting…'
            : alreadySubmitted
              ? 'Save changes'
              : 'Submit'}
        </Button>
      </div>
    </form>
  );
}
