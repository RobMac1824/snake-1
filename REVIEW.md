# EMBER RUN - Game Code Review

**Version**: 0.8 | **Reviewer**: Claude | **Date**: 2026-02-09

## Overall Assessment

Well-executed, thematically cohesive snake game with a Burning Man/desert festival
aesthetic. Clean vanilla JS codebase with solid engineering practices. The game
features dynamic difficulty scaling, multiple mechanics (storms, totems, trail
heat), a global leaderboard, and mobile-first design.

---

## Strengths

### 1. Visual Design & Theming
- Cohesive neon-on-dark palette via CSS custom properties
- Animated gradient background with diagonal hatching creates atmosphere
- Canvas rendering uses radial gradients for trail glow, food orbs, and totem
  diamonds that all feel unified
- Storm overlay with screen shake and brightness dimming adds drama

### 2. Game Loop Architecture
- Accumulator-based fixed-timestep loop (app.js:691-714) is the correct approach
- Decouples rendering from physics, preventing inconsistent speeds across frame rates
- Dynamic step duration cleanly layers storm and overheat multipliers

### 3. Input Handling
- 180-degree reversal prevention and overheat direction dampening are smart touches
- Swipe detection uses a reasonable 24px threshold with dominant-axis determination
- Passive event listeners for touch performance

### 4. State Management & Persistence
- Save/resume via localStorage with visibility change and beforeunload handlers
- `sanitizeStateForStart` is notably defensive, handling malformed saves gracefully
- Structured clone with JSON fallback for deep copying

### 5. Accessibility
- Good use of `aria-live`, `aria-hidden`, `role="table"`, and `.sr-only`
- Screen transitions properly toggle `aria-hidden` attributes
- Focus-visible outlines on canvas

### 6. Audio Implementation
- Web Audio API with proper unlock mechanism for mobile browsers
- Gain envelope with quick attack and exponential decay
- Haptic feedback with vibration API and CSS pulse fallback

---

## Issues Found

### HIGH: XSS Vulnerability in Leaderboard Rendering
**File**: app.js:246

```js
entry.innerHTML = `<span>${index + 1}</span><span>${row.username}</span><span>${row.high_score}</span>`;
```

Leaderboard data from Supabase is inserted via `innerHTML` without sanitization.
While the server validates usernames with Zod, the client fetches leaderboard data
directly from Supabase (app.js:251-271), bypassing server validation. A malicious
username stored directly in Supabase could inject HTML/JS.

**Fix**: Use `document.createElement` and `textContent` instead of `innerHTML`.

### MEDIUM: Overheat Speed Factor Goes the Wrong Direction
**File**: app.js:67, app.js:686

`OVERHEAT_SPEED_FACTOR = 1.35` is multiplied against the step *duration*. A longer
duration means the snake moves *slower*. This makes overheat *easier*, not harder.
The thematic intent ("stings with heat") and the variable name both suggest it
should be a punishment (faster snake, harder to control).

**Fix**: Change `OVERHEAT_SPEED_FACTOR` to a value less than 1 (e.g., `0.74`) to
make the step duration shorter and the snake faster during overheat. Alternatively,
divide by the factor instead of multiplying.

### MEDIUM: Score Submission Validation Parity
**File**: app.js:274-311, server.js:70-91

Two submission paths exist:
1. Server path: validates with Zod, uses service role key
2. Fallback path: posts to Supabase Edge Function with anon key

If the Edge Function has weaker validation, scores could be manipulated via the
fallback. Both paths should enforce equivalent validation rules.

### LOW: Potential Infinite Loop in Placement Functions
**File**: app.js:955-965, app.js:967-977

`placeFood()` and `placeTotem()` use while-loops with random placement. On an
18x18 grid, if snake + trail fill most cells, these loops could spin for many
iterations. Extremely unlikely in practice but adding a max-iteration guard would
be more robust.

### LOW: loadLeaderboard Promise Not Awaited
**File**: app.js:535

`loadLeaderboard()` is called in `showScreen` without `await`. The async function
renders internally, but errors after the status update won't propagate to the
caller.

### LOW: No WASD Key Support
**File**: app.js:1304-1319

Only arrow keys are mapped. Adding WASD support would improve desktop player
experience.

---

## Game Design Observations

### Difficulty Curve
- Speed ramp: 2.3ms reduction per 10 points, from 270ms to 120ms minimum
- Max speed reached at score 650 — a reasonable ceiling
- Countdown (3-2-1-GO) at 250ms per step is snappy

### Mechanics Balance
- **Storms** slow the snake to 88% speed, actually *helping* the player. Consider
  whether storms should add challenge instead of granting a breather.
- **Totem gates** (wall-wrap for 5s) are a strong risk/reward mechanic. The 18-26s
  spawn interval and 9s duration feel balanced for the 18x18 grid.
- **Trail heat** with 320ms cooldown between penalties prevents spam — good UX.
- **Gate charges** expire after 5 seconds, creating urgency to use them.

### Polish
- Firework particles (16 per food pickup) with physics and gravity
- Score burst CSS animation on the HUD
- Toast notifications for power-up collection
- 6 random game-over summary messages (could use more variety)
- Run stats on summary screen (time, max intensity)

---

## CSS Quality

- Well-structured with custom properties and responsive breakpoints (600px, 480px)
- Dynamic viewport unit support via `@supports (height: 100dvh)`
- Proper safe area insets for iPhone notch
- Storm animations and score firework effects are polished
- `touch-action: none` on canvas prevents scroll interference
- `overscroll-behavior: none` prevents pull-to-refresh on mobile

---

## Recommendations (Priority Order)

1. Fix the XSS vulnerability in `renderLeaderboard` — use `textContent`
2. Verify and fix overheat speed factor direction
3. Ensure validation parity between server and Edge Function submission paths
4. Add iteration guard to `placeFood()`/`placeTotem()` loops
5. Add WASD keyboard support for desktop players
6. Expand the set of game-over summary messages
