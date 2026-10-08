/** One request per result-card activation. Never retry an ambiguous increment. */
export function recordSearchClick(websiteId: string, keywordId: string): void {
  void fetch(`/api/websites/${encodeURIComponent(websiteId)}/search-click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword_id: keywordId }),
    keepalive: true,
  }).catch(() => { /* Opening details must not depend on analytics availability. */ })
}
