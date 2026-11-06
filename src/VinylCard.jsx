import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { onCurrentChange, play, stop } from './audio'

// Phones/tablets have no hover: there, a tap toggles the record instead.
const TOUCH = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

export default function VinylCard({ album, index, badge, hidden, action, onNowPlaying }) {
  const root = useRef(null)
  const tl = useRef(null)
  const spin = useRef(null)
  const tilt = useRef(null)
  const [progress, setProgress] = useState(0)
  const active = useRef(false)

  // A card can unmount mid-hover (e.g. added to the crate); don't leave its audio running.
  useEffect(() => () => stop(album.id), [album.id])

  useGSAP(
    () => {
      // Pull-out timeline: sleeve shifts left, record slides right and grows.
      tl.current = gsap
        .timeline({ paused: true, defaults: { duration: 0.6, ease: 'power3.out' } })
        .to('.sleeve', { xPercent: -14, rotate: -3, boxShadow: '0 30px 60px rgba(0,0,0,.6)' }, 0)
        .to('.record', { xPercent: window.innerWidth < 600 ? 28 : 42, scale: 1.02 }, 0)
        .to('.meta', { y: -6, opacity: 1 }, 0.1)
        .to('.shine', { opacity: 1, xPercent: 120, duration: 0.9, ease: 'power2.inOut' }, 0)

      // Continuous spin, starts paused and ramps up via timeScale.
      spin.current = gsap.to('.disc', { rotate: 360, duration: 1.8, ease: 'none', repeat: -1, paused: true })

      const card = root.current.querySelector('.stage')
      tilt.current = {
        rx: gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3' }),
        ry: gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3' }),
      }
    },
    { scope: root }
  )

  const enter = () => {
    if (active.current) return
    active.current = true
    tl.current.play()
    spin.current.timeScale(0).play()
    gsap.to(spin.current, { timeScale: 1, duration: 1.2, ease: 'power2.in' }) // motor spin-up
    play(album.id, album.preview, setProgress)
    onNowPlaying(album)
  }

  // Visual + state teardown; `stopAudio` is false when another record already took the player.
  const settle = (stopAudio) => {
    if (!active.current) return
    active.current = false
    tl.current.reverse()
    gsap.to(spin.current, { timeScale: 0, duration: 1, ease: 'power2.out', onComplete: () => spin.current.pause() })
    tilt.current.rx(0)
    tilt.current.ry(0)
    if (stopAudio) stop(album.id)
    onNowPlaying((cur) => (cur?.id === album.id ? null : cur))
    setProgress(0)
  }
  const leave = () => settle(true)

  useEffect(
    () => onCurrentChange((id) => id !== album.id && settle(false)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [album.id]
  )

  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    tilt.current.ry(x * 14)
    tilt.current.rx(-y * 14)
  }

  return (
    <article
      ref={root}
      className={hidden ? 'card is-hidden' : 'card'}
      data-flip-id={album.id}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : 0}
      {...(TOUCH
        ? { onClick: () => (active.current ? leave() : enter()) }
        : { onMouseEnter: enter, onMouseLeave: leave, onMouseMove: move, onFocus: enter, onBlur: leave })}
      aria-label={`${album.album} by ${album.artist}. ${TOUCH ? 'Tap' : 'Hover'} to play ${album.track}`}
    >
      <div className="stage">
        <div className="record">
          <div className="disc">
            <div className="label" style={{ backgroundImage: `url(${album.cover})` }} />
            <span className="hole" />
          </div>
          <svg className="ring" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="48" pathLength="1" style={{ strokeDashoffset: 1 - progress }} />
          </svg>
        </div>
        <div className="sleeve">
          <img src={album.cover} alt="" loading="lazy" />
          <span className="shine" />
          <span className="num">{badge ?? String(index + 1).padStart(2, '0')}</span>
        </div>
      </div>
      <div className="meta">
        <h3>{album.album}</h3>
        <p>
          {album.artist} <span>· {album.year}</span>
        </p>
        {action && (
          <button
            className={`card-action ${action.tone ?? ''}`}
            onClick={(e) => {
              e.stopPropagation()
              action.onClick()
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </article>
  )
}
