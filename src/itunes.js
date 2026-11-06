import { useEffect, useState } from 'react'

// Strip edition noise so sleeves read like the original record.
const cleanAlbum = (name) =>
  name
    .replace(/\s*[([][^)\]]*(deluxe|remaster|edition|version|anniversary|expanded)[^)\]]*[)\]]/gi, '')
    .replace(/\s*-\s*(single|ep)$/i, '')
    .trim()

const toRecord = (t) => ({
  id: t.trackId,
  artist: t.artistName,
  album: cleanAlbum(t.collectionName || t.trackName),
  track: t.trackName.replace(/\s*\((\d{4} )?remaster(ed)?\)/i, ''),
  year: t.releaseDate?.slice(0, 4) ?? '',
  genre: t.primaryGenreName ?? '',
  cover: t.artworkUrl100.replace('100x100bb', '600x600bb'),
  preview: t.previewUrl,
})

/** Live song search against the public iTunes Search API (CORS-enabled). */
export function useItunesSearch(query, { limit = 15, delay = 450 } = {}) {
  const term = query.trim()
  const [state, setState] = useState({ term: '', status: 'idle', results: [] })

  useEffect(() => {
    if (term.length < 2) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, term, status: 'loading' }))
      try {
        const url = `https://itunes.apple.com/search?media=music&entity=song&limit=${limit}&term=${encodeURIComponent(term)}`
        const data = await fetch(url, { signal: ctrl.signal }).then((r) => {
          if (!r.ok) throw new Error(r.status)
          return r.json()
        })
        // One song per album keeps the shelf varied.
        const seen = new Set()
        const results = data.results
          .filter((t) => t.previewUrl && t.artworkUrl100)
          .filter((t) => !seen.has(t.collectionId) && seen.add(t.collectionId))
          .map(toRecord)
        setState({ term, status: 'done', results })
      } catch (e) {
        if (e.name !== 'AbortError') setState({ term, status: 'error', results: [] })
      }
    }, delay)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [term, limit, delay])

  return term.length < 2 ? { term, status: 'idle', results: [] } : state
}
