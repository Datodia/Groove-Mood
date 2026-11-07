import gsap from 'gsap'

// One shared player: hovering a new record fades out the old one and fades in the new.
const MAX_VOL = 0.8
let current = null // { audio, id }

// Browsers block audio until the first click/key press on the page. Hover does not count,
// so we report the locked state and retry the hovered record as soon as the user interacts.
let locked = false
const listeners = new Set()
const setLocked = (v) => {
  if (locked === v) return
  locked = v
  listeners.forEach((fn) => fn(v))
}
export function onSoundLockChange(fn) {
  listeners.add(fn)
  fn(locked)
  return () => listeners.delete(fn)
}
const unlock = () => {
  if (!locked) return
  setLocked(false)
  current?.audio.play().catch(() => {})
}
window.addEventListener('pointerdown', unlock)
window.addEventListener('keydown', unlock)

// Lets cards know when another record takes over the player (tap mode has no mouseleave).
const currentListeners = new Set()
export function onCurrentChange(fn) {
  currentListeners.add(fn)
  return () => currentListeners.delete(fn)
}
const emitCurrent = () => currentListeners.forEach((fn) => fn(current?.id ?? null))

function fadeTo(audio, volume, duration, onComplete) {
  gsap.killTweensOf(audio)
  gsap.to(audio, { volume, duration, ease: 'power2.out', onComplete })
}

function fadeOut(audio) {
  fadeTo(audio, 0, 0.5, () => {
    audio.pause()
    audio.src = ''
  })
}

export function play(id, src, onTime) {
  if (current?.id === id) return current.audio
  // Hand over straight from the old record to the new one. Going through stop() would
  // announce "nothing playing" first, and the new card would settle itself back in.
  if (current) fadeOut(current.audio)
  const audio = new Audio(src)
  audio.volume = 0
  audio.loop = true
  audio.currentTime = 0
  if (onTime) audio.addEventListener('timeupdate', () => onTime(audio.currentTime / (audio.duration || 30)))
  audio.play().catch((e) => e.name === 'NotAllowedError' && setLocked(true))
  fadeTo(audio, MAX_VOL, 0.8)
  current = { audio, id }
  emitCurrent()
  return audio
}

export function stop(id) {
  if (!current || (id && current.id !== id)) return
  const { audio } = current
  current = null
  emitCurrent()
  fadeOut(audio)
}
