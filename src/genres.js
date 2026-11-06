// iTunes returns many fine-grained genre labels; group them into a few shelves.
const GROUPS = {
  Rock: ['Rock', 'Hard Rock', 'Metal', 'Punk', 'Pop/Rock', 'Rock & Roll', 'Blues'],
  Alternative: ['Alternative', 'Indie Rock', 'Indie Pop', 'Alternative Folk'],
  Pop: ['Pop', 'Singer/Songwriter', 'K-Pop', 'J-Pop', 'Pop Latino', 'Teen Pop'],
  'Soul & R&B': ['R&B/Soul', 'Soul', 'Funk', 'Disco', 'Contemporary R&B'],
  'Hip-Hop': ['Hip-Hop/Rap', 'Rap', 'Hip-Hop', 'Hip Hop', 'Hardcore Rap', 'West Coast Rap', 'East Coast Rap'],
  Electronic: ['Electronic', 'Dance', 'House', 'Techno', 'Ambient', 'Electronica', 'Trance'],
  Jazz: ['Jazz', 'Vocal Jazz', 'Bebop', 'Fusion', 'Contemporary Jazz'],
  World: ['Reggae', 'Afro-Beat', 'Afrobeats', 'World', 'Latin', 'African', 'Dancehall'],
}

const LOOKUP = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([shelf, labels]) => labels.map((l) => [l, shelf]))
)

// "Other" catches anything new from live search (Country, Soundtrack, Classical…).
export const SHELVES = [...Object.keys(GROUPS), 'Other']

export const shelfOf = (genre) => LOOKUP[genre] ?? 'Other'
