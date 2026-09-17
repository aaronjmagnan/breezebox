'use server';

import { revalidatePath } from 'next/cache';
import { serverClient, getSessionContext } from '@breezebox/auth/server';
import { recordFromValues, type CheckInFormValues } from '@/lib/form-state';

/**
 * Server actions for the check-in form.
 *
 * district_id and created_by are set HERE, from the session, and are never
 * accepted from the client. RLS enforces the same thing independently
 * (created_by must equal app.current_staff_id()), so a forged value is refused
 * by the database even if this code were wrong.
 */

type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function currentStaff() {
  const session = await getSessionContext();
  if (!session.signedIn || !session.staff) return null;
  return session.staff;
}

/** Create a draft and return its id. The form then autosaves into it. */
export async function createDraft(values: CheckInFormValues): Promise<ActionResult> {
  const staff = await currentStaff();
  if (!staff) return { ok: false, error: 'Your session has expired. Sign in again.' };
  if (!values.siteId) return { ok: false, error: 'Choose a school first.' };

  const supabase = await serverClient();
  const { data, error } = await supabase
    .from('learning_cycle_checkins')
    .insert({
      ...recordFromValues(values),
      district_id: staff.district_id,
      created_by: staff.id,
      entry_method: 'typed',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[learning-cycles] createDraft failed:', error?.message);
    return { ok: false, error: 'We could not start this check-in. Please try again.' };
  }

  return { ok: true, id: data.id };
}

/**
 * Autosave. Writes to the server, never to localStorage or IndexedDB: a
 * check-in names a school and a named principal's practice, and §11 keeps
 * district data off the device.
 */
export async function saveDraft(
  id: string,
  values: CheckInFormValues,
): Promise<ActionResult> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from('learning_cycle_checkins')
    .update(recordFromValues(values))
    .eq('id', id);

  if (error) {
    console.error('[learning-cycles] saveDraft failed:', error.message);
    return { ok: false, error: 'Not saved. We will keep trying.' };
  }

  return { ok: true, id };
}

export async function submitCheckIn(
  id: string,
  values: CheckInFormValues,
): Promise<ActionResult> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from('learning_cycle_checkins')
    .update({ ...recordFromValues(values), submitted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[learning-cycles] submit failed:', error.message);
    return { ok: false, error: 'We could not submit this check-in. Please try again.' };
  }

  revalidatePath('/');
  revalidatePath(`/${id}`);
  return { ok: true, id };
}

/** Save an already-submitted record without changing submitted_at. */
export async function updateSubmitted(
  id: string,
  values: CheckInFormValues,
): Promise<ActionResult> {
  const supabase = await serverClient();

  const { error } = await supabase
    .from('learning_cycle_checkins')
    .update(recordFromValues(values))
    .eq('id', id);

  if (error) {
    console.error('[learning-cycles] update failed:', error.message);
    return { ok: false, error: 'We could not save your changes. Please try again.' };
  }

  revalidatePath('/');
  revalidatePath(`/${id}`);
  return { ok: true, id };
}

/** Staff at a site, for the principal picker when the site changes. */
export async function staffAtSite(siteId: string) {
  const supabase = await serverClient();
  const { data } = await supabase
    .from('staff')
    .select('id, name')
    .eq('site_id', siteId)
    .eq('status', 'active')
    .order('name');
  return data ?? [];
}
