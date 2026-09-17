'use client';

import { Button } from '@breezebox/ui';

/**
 * Opens the browser's own print dialog (§4 of the tool spec: no server-side
 * PDF generation). "Save as PDF" is a destination inside that dialog on every
 * current platform, so one button covers print and PDF both.
 */
export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()} className="print-hide">
      Print or save as PDF
    </Button>
  );
}
