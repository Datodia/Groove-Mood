import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Flip } from 'gsap/Flip'
import { useGSAP } from '@gsap/react'
import albums from './albums.json'
import VinylCard from './VinylCard'
import { SHELVES, shelfOf } from './genres'
import { onSoundLockChange } from './audio'
import { useItunesSearch } from './itunes'

gsap.registerPlugin(useGSAP, ScrollTrigger, Flip)

const ALL = 'All'
const TOUCH = window.matchMedia('(hover: none)').matches
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const toRecord = (a) => ({
  ...a,
  shelf: shelfOf(a.genre),
  haystack: norm([a.artist, a.album, a.track, a.year, a.genre, shelfOf(a.genre)].join(' ')),
})
const baseRecords = albums.map(toRecord)

// Songs added from live search live in this browser only.
const STORE_KEY = 'groove-room:added'
const loadAdded = () => {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
const saveAdded = (list) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

const TITLE = 'Groove Room'

export default function App() {
  const root = useRef(null)
  const [ready, setReady] = useState(false)
  const [now, setNow] = useState(null)
  const [soundLocked, setSoundLocked] = useState(false)
  const [query, setQuery] = useState('')
  const [shelf, setShelf] = useState(ALL)
  const flipState = useRef(null)
  const flipTl = useRef(null)
  const searchRef = useRef(null)
  const revealTriggers = useRef([])
  const justAdded = useRef(null)
  const [added, setAdded] = useState(loadAdded)
  // Songs added during the current search stay visible even if the local filter wouldn't match them.
  const [pinned, setPinned] = useState(() => new Set())

  const records = useMemo(() => [...added.map((a) => ({ ...toRecord(a), userAdded: true })), ...baseRecords], [added])
  const ids = useMemo(() => new Set(records.map((a) => a.id)), [records])
  const shelfCounts = useMemo(
    () => records.reduce((m, a) => ({ ...m, [a.shelf]: (m[a.shelf] || 0) + 1 }), {}),
    [records]
  )
  const online = useItunesSearch(query)
  const onlineResults = online.results.filter((a) => !ids.has(a.id))

  const visible = useMemo(() => {
    const words = norm(query).split(/\s+/).filter(Boolean)
    return new Set(
      records
        .filter(
          (a) =>
            pinned.has(a.id) || ((shelf === ALL || a.shelf === shelf) && words.every((w) => a.haystack.includes(w)))
        )
        .map((a) => a.id)
    )
  }, [query, shelf, records, pinned])

  const addRecord = (a) =>
    withFlip(() => {
      const next = [a, ...added]
      setAdded(next)
      saveAdded(next)
      setPinned((p) => new Set(p).add(a.id))
      justAdded.current = a.id
    })

  const removeRecord = (id) =>
    withFlip(() => {
      const next = added.filter((a) => a.id !== id)
      setAdded(next)
      saveAdded(next)
    })

  const changeQuery = (q) =>
    withFlip(() => {
      setQuery(q)
      setPinned(new Set())
    })

  // Snapshot card positions before the filter changes, so Flip can animate from them.
  const withFlip = (fn) => {
    // Scroll-reveal would fight Flip over the same cards; retire it on first filter.
    if (revealTriggers.current.length) {
      revealTriggers.current.forEach((t) => t.kill())
      revealTriggers.current = []
      gsap.killTweensOf('.card')
      gsap.set('.card', { opacity: 1, y: 0, rotate: 0, scale: 1 })
    }
    flipState.current = Flip.getState('.card')
    flipTl.current?.kill()
    fn()
  }

  useLayoutEffect(() => {
    if (!flipState.current) return
    flipTl.current = Flip.from(flipState.current, {
      targets: '.card',
      duration: 0.6,
      ease: 'power3.inOut',
      absolute: true,
      stagger: 0.015,
      onEnter: (els) =>
        gsap.fromTo(els, { opacity: 0, scale: 0.7, y: 0 }, { opacity: 1, scale: 1, rotate: 0, duration: 0.5, delay: 0.15 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.7, duration: 0.35 }),
      onComplete: () => {
        ScrollTrigger.refresh()
        // Bring a freshly added record into view and give it a little bump.
        const el = justAdded.current && root.current.querySelector(`main.grid [data-flip-id="${justAdded.current}"]`)
        justAdded.current = null
        if (!el) return
        const r = el.getBoundingClientRect()
        if (r.top < 80 || r.bottom > innerHeight) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        gsap.fromTo(el, { scale: 1 }, { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out', delay: 0.4 })
      },
    })
    flipState.current = null
  }, [visible])

  // "/" focuses search, Escape clears it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const reset = () => withFlip(() => (setQuery(''), setShelf(ALL), setPinned(new Set())))

  useGSAP(
    () => {
      const intro = gsap.timeline({ defaults: { ease: 'expo.out' } })
      intro
        .from('.gate-disc', { scale: 0, rotate: -270, duration: 0.8 })
        .from('.gate h1 .ch', { yPercent: 120, opacity: 0, stagger: 0.025, duration: 0.6 }, 0.1)
        .from('.gate p', { y: 20, opacity: 0, duration: 0.5 }, 0.35)
        // Auto-enter 1s after load.
        .to('.gate', { clipPath: 'circle(0% at 50% 50%)', duration: 0.8, ease: 'expo.inOut', onComplete: () => setReady(true) }, 1)
      gsap.to('.gate-disc', { rotate: '+=360', duration: 6, ease: 'none', repeat: -1 })
    },
    { scope: root }
  )

  // Runs once the collection is mounted.
  useGSAP(
    () => {
      if (!ready) return
      gsap.from('header .ch', { yPercent: 110, stagger: 0.03, duration: 1, ease: 'expo.out' })
      gsap.from('header .sub', { opacity: 0, y: 16, duration: 1, delay: 0.4 })
      revealTriggers.current = ScrollTrigger.batch('.card', {
        start: 'top 92%',
        once: true,
        onEnter: (els) =>
          gsap.fromTo(
            els,
            { y: 80, opacity: 0, rotate: () => gsap.utils.random(-6, 6) },
            { y: 0, opacity: 1, rotate: 0, stagger: 0.08, duration: 1, ease: 'power4.out', overwrite: true }
          ),
      })
      // Constant slow speed (~30px/s) no matter how many artists are in the strip.
      const track = document.querySelector('.marquee-track')
      gsap.to(track, { xPercent: -50, duration: track.scrollWidth / 2 / 30, ease: 'none', repeat: -1 })
    },
    { scope: root, dependencies: [ready] }
  )

  // Equalizer + now-playing bar react to state.
  useGSAP(
    () => {
      gsap.to('.np', { y: now ? 0 : 120, duration: 0.6, ease: now ? 'back.out(1.6)' : 'power3.in' })
      gsap.killTweensOf('.eq i')
      if (now) {
        gsap.to('.eq i', {
          scaleY: () => gsap.utils.random(0.2, 1),
          duration: 0.18,
          repeat: -1,
          repeatRefresh: true,
          yoyo: true,
          stagger: 0.05,
        })
      } else gsap.to('.eq i', { scaleY: 0.15, duration: 0.3 })
    },
    { scope: root, dependencies: [now] }
  )

  useEffect(() => onSoundLockChange(setSoundLocked), [])

  // Fresh iTunes results deal in like cards from a crate.
  useGSAP(
    () => {
      if (!online.results.length) return
      gsap.fromTo(
        '.online-grid .card',
        { y: 60, opacity: 0, rotate: () => gsap.utils.random(-8, 8) },
        { y: 0, opacity: 1, rotate: 0, stagger: 0.05, duration: 0.8, ease: 'power4.out' }
      )
    },
    { scope: root, dependencies: [online.results] }
  )

  useGSAP(
    () => {
      if (soundLocked) gsap.fromTo('.sound-hint', { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(2)' })
    },
    { scope: root, dependencies: [soundLocked] }
  )

  return (
    <div ref={root}>
      {!ready && (
        <section className="gate">
          <div className="gate-disc" />
          <h1>{split(TITLE)}</h1>
          <p>{albums.length} records. {TOUCH ? 'Tap' : 'Hover'} one to drop the needle.</p>
        </section>
      )}

      {ready && (
        <>
          <header>
            <h1>{split(TITLE)}</h1>
            <p className="sub">A crate of timeless records — {TOUCH ? 'tap' : 'hover'} a sleeve, hear the groove.</p>
          </header>

          <div className="marquee" aria-hidden>
            <div className="marquee-track">
              {[...albums, ...albums].map((a, i) => (
                <span key={i}>
                  {a.artist} <b>✦</b>
                </span>
              ))}
            </div>
          </div>

          <div className="toolbar">
            <label className="search">
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                placeholder="Search crate + iTunes…"
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && changeQuery('')}
                aria-label="Search records"
              />
              <kbd>/</kbd>
            </label>
            <div className="chips" role="group" aria-label="Filter by genre">
              {[ALL, ...SHELVES.filter((g) => shelfCounts[g] || g === shelf)].map((g) => (
                <button
                  key={g}
                  className="chip"
                  aria-pressed={shelf === g}
                  onClick={() => shelf !== g && withFlip(() => setShelf(g))}
                >
                  {g}
                  <span>{g === ALL ? records.length : shelfCounts[g] || 0}</span>
                </button>
              ))}
            </div>
            <p className="count" aria-live="polite">
              {visible.size} of {records.length} records
            </p>
          </div>

          <main className="grid">
            {records.map((a, i) => (
              <VinylCard
                key={a.id}
                album={a}
                index={i}
                badge={a.userAdded ? 'Added' : undefined}
                hidden={!visible.has(a.id)}
                action={a.userAdded ? { label: 'Remove', tone: 'ghost', onClick: () => removeRecord(a.id) } : undefined}
                onNowPlaying={setNow}
              />
            ))}
          </main>
          {visible.size === 0 && (
            <div className="empty">
              <p>No records in this crate{online.status === 'idle' ? '.' : ' — dig through iTunes below.'}</p>
              <button onClick={reset}>Clear filters</button>
            </div>
          )}

          {online.status !== 'idle' && (
            <section className="online" aria-live="polite">
              <div className="online-head">
                <h2>
                  Find more on iTunes <em>“{query.trim()}”</em>
                </h2>
                <p>
                  {online.status === 'loading' && 'Digging through the stacks…'}
                  {online.status === 'error' && 'iTunes did not answer. Try again in a moment.'}
                  {online.status === 'done' &&
                    (onlineResults.length
                      ? `${TOUCH ? 'Tap' : 'Hover'} to preview, add the ones you like to your crate.`
                      : 'Nothing new here — it may already be in your crate.')}
                </p>
              </div>
              <div className="grid online-grid">
                {onlineResults.map((a, i) => (
                  <VinylCard
                    key={a.id}
                    album={a}
                    index={i}
                    badge="iTunes"
                    action={{ label: '+ Add to crate', onClick: () => addRecord(a) }}
                    onNowPlaying={setNow}
                  />
                ))}
              </div>
            </section>
          )}

          <footer>Album art & 30s previews via the iTunes Search API.</footer>
        </>
      )}

      {soundLocked && (
        <div className="sound-hint" role="status">
          Browser muted autoplay — click anywhere to turn sound on ♪
        </div>
      )}

      <div className="np" aria-live="polite">
        <div className="eq">
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        {now && (
          <div>
            <small>Now spinning</small>
            <strong>{now.track}</strong> — {now.artist}
          </div>
        )}
      </div>
    </div>
  )
}

// Letters animate individually, but each word stays unbreakable so lines wrap between words.
function split(text) {
  const words = text.split(' ')
  return words.map((word, w) => (
    <span className="word" key={w}>
      {word.split('').map((c, i) => (
        <span className="ch-wrap" key={i}>
          <span className="ch">{c}</span>
        </span>
      ))}
      {w < words.length - 1 && ' '}
    </span>
  ))
}

