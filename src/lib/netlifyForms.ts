// Submits a form to Netlify Forms. The form name must match one of the hidden
// static forms in index.html (Netlify scans those at build time to register
// form handlers + email notifications).
//
// On a Netlify-hosted site this POST is intercepted by Netlify and recorded as
// a form submission. In local dev (vite serve) it will hit the Vite dev server
// and may 404 / 405 — that's expected and not a bug.

export type NetlifyFormFields = Record<string, string | number | null | undefined>;

export async function submitToNetlifyForm(
  formName: string,
  fields: NetlifyFormFields
): Promise<void> {
  const body = new URLSearchParams();
  body.append('form-name', formName);
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    body.append(key, String(value));
  }

  const response = await fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Netlify form "${formName}" submission failed (${response.status})`);
  }
}
