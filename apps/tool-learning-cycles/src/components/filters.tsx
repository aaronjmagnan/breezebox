'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Field, Select, TextInput } from '@breezebox/ui';
import { CYCLES, STAGES, STAGE_LABELS } from '@/lib/template';
import { appHref } from '@/lib/routes';

/**
 * List filters (§7).
 *
 * State lives in the URL, not in component state: a filtered view is then
 * shareable, survives a reload, and the CSV export reuses the same query
 * string rather than reimplementing the filter.
 */
export function Filters({ sites }: { sites: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/?${next.toString()}`);
  }

  const hasFilters = ['site', 'cycle', 'stage', 'from', 'to'].some((k) => params.get(k));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="School">
          {({ id }) => (
            <Select id={id} value={params.get('site') ?? ''} onChange={(e) => set('site', e.target.value)}>
              <option value="">All schools</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Cycle">
          {({ id }) => (
            <Select id={id} value={params.get('cycle') ?? ''} onChange={(e) => set('cycle', e.target.value)}>
              <option value="">All cycles</option>
              {CYCLES.map((n) => (
                <option key={n} value={n}>
                  Cycle {n}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Stage">
          {({ id }) => (
            <Select id={id} value={params.get('stage') ?? ''} onChange={(e) => set('stage', e.target.value)}>
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="From">
          {({ id }) => (
            <TextInput id={id} type="date" value={params.get('from') ?? ''} onChange={(e) => set('from', e.target.value)} />
          )}
        </Field>

        <Field label="To">
          {({ id }) => (
            <TextInput id={id} type="date" value={params.get('to') ?? ''} onChange={(e) => set('to', e.target.value)} />
          )}
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" href={appHref(`/api/export?${params.toString()}`)}>
          Export CSV
        </Button>
        {hasFilters ? (
          <Button variant="ghost" onClick={() => router.replace('/')}>
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
