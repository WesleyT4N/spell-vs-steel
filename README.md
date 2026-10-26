<p align="center">
  <img src="docs/media/logo.gif" alt="Spell VS Steel" width="720">
</p>

<p align="center"><b>A fantasy class-based battler in the spirit of Mega Man Battle Network.</b><br>
Build a grimoire, pick a class, and duel another player on a 6×3 grid in real time.</p>

<p align="center">
  <img src="docs/media/hero.gif" alt="A Mage and a Warrior trading fire, ice and steel on a snowy mountain pass" width="720">
</p>

## The pitch

Spell VS Steel is a head-to-head card battler where the cards are thrown in real time. Two fighters face off on a grid of panels, three rows each, and dodge, slash and fire spells at each other. Every few seconds the action pauses so both players can draft fresh spells from the decks they built, then the fight picks right back up.

- **Five classes, five ways to play.** A Warrior who gets stronger as they take hits, a glass-cannon Mage, a Rogue who chains cheap tricks, a Ranger with traps and pets, and a Priest who outlasts you with heals and curses.
- **Your deck is your character.** Every class has its own pool of spells, each with a Legendary set and a Mythic signature card. You build a 30-spell grimoire and it shapes how you fight.
- **Fast and readable.** Matches are best of 3 short rounds. Big area attacks flash their panels before they land, so a sharp player can always see them coming.
- **Made for PvP.** Local versus for two players on one keyboard, and online play with room codes, ranked matches and rollback netcode that keeps fights smooth over a real connection.
- **NES-style pixel art.** 24×24 fighters with hand-drawn frames, painted stages, spell effects colored by element, and parchment menus with wax-seal costs.

## How a fight works

New to Battle Network-style games? Here's the whole loop in five steps.

### 1. Pick a class and a grimoire

Choose one of the five classes and the deck of spells you'll bring. Every class comes with ready-made decks, and the deck builder lets you make your own: 30 spells, up to 4 copies of a common and 2 of an uncommon, up to 5 Legendaries, and exactly 1 Mythic.

<p align="center"><img src="docs/media/select.gif" alt="Arcade mode character select: switching from Warrior to Mage" width="480"></p>

### 2. Fight on the grid

The arena is 6 panels wide and 3 tall. The left half (red) is yours, the right half (blue) is your opponent's, and neither of you can step onto the other side. You move between your 9 panels to line up shots and dodge theirs.

Every class has the same basic kit: a **light attack** (tap) for quick chip damage and a **heavy attack** (hold and release) that hits harder. Each class also has its own resource bar that pays for spells: Rage for the Warrior, Mana for the Mage and Priest, Energy for the Rogue and Ranger.

<p align="center"><img src="docs/media/fight.gif" alt="Priest and Warrior trading blows on the grid at Elderwood Ruins" width="480"></p>

### 3. Fill the Draw gauge, then draft spells

The bar at the top of the screen is the **Draw gauge**. It fills in about 10 seconds. When it's full, either player can open the **Draw screen**: the fight freezes and both players are dealt 5 spells from their grimoire. Pick the ones you want and the order you'll cast them in, keeping an eye on what they cost, then hit **FIGHT!** to jump back in.

<p align="center"><img src="docs/media/draw.gif" alt="The Draw screen: reading cards and queueing Ice Wall and Fireball" width="480"></p>

### 4. Cast your spells

Back in the fight, your picks sit in a queue, and one button casts the next one. Spells are where the big plays happen: fireballs that set panels alight, ice walls that block shots, traps, pets, stuns and freezes. A frozen or stunned target takes 50% more damage from everything, so landing a freeze and following it up is the heart of a good combo.

<p align="center"><img src="docs/media/cast.gif" alt="Ranger and Mage casting traps, beams and fire at Emberforge" width="480"></p>

### 5. Knock them out

Drop your opponent's HP to 0 to win the round. Win two rounds (best of 3) to take the match. After each round a stats screen breaks down damage, accuracy, crowd control and your best spell.

<p align="center"><img src="docs/media/ko.gif" alt="A Mage finishes a Warrior with a K.O., then the round stats screen" width="480"></p>

Then it starts over: fight, draw, cast, repeat. A round usually lasts somewhere between 30 seconds and a minute.

## The classes

<table>
  <tr>
    <td width="50%" align="center"><img src="docs/media/class-warrior.gif" alt="Warrior" width="100%"><br><b>Warrior</b>: heavy armor, big hits. Builds Rage from heavy attacks and from getting hit, then spends it on brutal finishers and grid control.</td>
    <td width="50%" align="center"><img src="docs/media/class-mage.gif" alt="Mage" width="100%"><br><b>Mage</b>: glass cannon. Mana grows every Draw, so the Mage scales into the hardest-hitting spells and the best crowd control in the game.</td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="docs/media/class-rogue.gif" alt="Rogue" width="100%"><br><b>Rogue</b>: chains cheap cards, vanishes, strikes from behind and stacks poison.</td>
    <td width="50%" align="center"><img src="docs/media/class-ranger.gif" alt="Ranger" width="100%"><br><b>Ranger</b>: arrows, traps and pets. Standing still builds Energy for big shots.</td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="docs/media/class-priest.gif" alt="Priest" width="100%"><br><b>Priest</b>: outlasts and chips. Heals, shields and curses that burn hotter the longer you stand in them.</td>
    <td width="50%" align="center"><img src="docs/media/title.gif" alt="The title screen" width="100%"><br>Every class counters two others and is countered by two, so no matchup is a lost cause.</td>
  </tr>
</table>

## Modes

| Mode | What it is |
| --- | --- |
| **Arcade** | Climb a ladder of four rivals from Easy to Hard, then face your Shadow Self. |
| **Versus** | Two players on one keyboard, or you against the CPU. |
| **Online** | Play a friend with a 5-letter room code, or play ranked matches. Rollback netcode keeps it responsive. |
| **Training** | A sandbox for testing decks and practicing combos. |
| **Tutorial** | Short lessons that teach the grid, attacks, the Draw screen and casting from zero. |
| **Deck builder** | Build, save, import and export grimoires for every class. |
| **Replays** | Watch your past matches. |

## Controls

| Key | Action |
| --- | --- |
| WASD or arrows | Move |
| J (tap) | Light attack |
| J (hold, release) | Heavy attack |
| K | Cast the next spell |
| Space | Open the Draw screen when the gauge is full |
| Esc | Pause |

Menus work with the mouse. Phones and tablets get an on-screen pad, and every key can be rebound in **Options**.

## Play it locally

You need [Node.js](https://nodejs.org/) 22 or newer.

```sh
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173).

## Contributing

Thanks for wanting to help! Here's how to get going.

1. **Set up.** Fork and clone the repo, then run `npm install` and `npm run dev`. Dev builds have a **DEV TOOLS** item on the title screen with a card encyclopedia, a sandbox for testing any spell, and a balance lab that runs CPU-vs-CPU matches.
2. **Learn the layout.** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) shows how the systems fit together, with diagrams. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) covers every script, the dev tools, online play internals and the code map.
3. **Make your change on a branch** and open a pull request against `main`. Keep each PR to one idea.
4. **Run the checks before you push.**
   ```sh
   npm run typecheck     # the game and the tests
   npm test              # full CPU-vs-CPU matches, online determinism, saves
   npm run test:screens  # every screen at every screen shape (needs Playwright's Chromium)
   ```
   CI runs the same checks on every PR, and posts a visual diff of any screen whose pixels changed so reviewers can see what moved.

### House rules

- **The battle must stay deterministic.** Online play runs the same simulation on both machines, so anything random in the rules uses the battle's own generator (`b.rand()`), never `Math.random`. Sound and visual effects never live in the simulation: the battle emits events and the engine plays them. `npm run netcheck` and `npm run rollcheck` catch slips.
- **Spells are data.** Each spell is one entry in its class's card file under `src/game/`, and every number worth tuning is in `src/game/tuning.ts`. A new spell also needs a 20×20 card icon in `src/art/cardIcons.ts`.
- **Respect the pixel grid.** Fighters are 24×24 with hand-drawn frames. Never stretch sprites; pad them instead.
- **Saves go through the save module** (`src/engine/save.ts`), never straight to `localStorage`.
- **New screens get a screenshot test**: add them to `tests/screens/harness.ts`.
- **New classes get tutorial lessons** and show up in every character select.
- **Balance changes come with numbers.** `npm run sim` and `npm run balance` run thousands of CPU-vs-CPU matches; include the before and after win rates in your PR.

## Credits

Designed by Wes, built with Claude.
