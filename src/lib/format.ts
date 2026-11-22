/** "2026-11-21" → "November 21, 2026". Unparseable input is returned unchanged. */
export function formatDate(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return date
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/** Drop a leading "# Title" line when the page already shows the title. */
export function stripLeadingTitle(body: string, title: string): string {
  const m = body.match(/^\s*#\s+(.+)\r?\n/)
  return m && m[1].trim().toLowerCase() === title.trim().toLowerCase() ? body.slice(m[0].length) : body
}
