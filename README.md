This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

English Version
_____________________________________________________________________________________________________________________________________________________________
# Discord (roll mirror)

The site can publish already-calculated rolls to a Discord channel. The bot does not roll dice — it only reproduces the result produced by the site. A single bot serves multiple servers: each table chooses its server and channel. Sending uses the Discord REST API (no gateway), which is stable on Vercel's serverless platform.

1. Create the bot at https://discord.com/developers/applications, copy the token and invite it to your servers (permissions: only **View Channel** and **Send Messages** — do not use Administrator).
2. Create a Supabase project and run the SQL in `supabase/migrations/20260923120000_mesa_discord_configs.sql` in the SQL Editor (it only creates the `mesa_discord_configs` table).
3. Copy `.env.example` to `.env.local` and fill in:
   ```
   DISCORD_BOT_TOKEN=
   SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   ```
4. Start the project (`npm run dev`). On the first visit the site asks whether you want to send rolls to Discord; the choice can be changed later in **🎲 Dados** (Dice).
5. In **🎲 Dados → Discord**: generate/set the table code (e.g. `night-city`) and click **⚙ Configurar servidor** (Configure server) to choose the server and channel. Players use the same table code.
6. When you roll on the character sheet with sending enabled, the message appears only in the channel of the server linked to that table.
7. For deployment: also add the three variables above in **Vercel → Settings → Environment Variables** and redeploy.

**Details:**

- The database stores only `sessionCode → guildId → channelId` (no rolls, sheets or characters). RLS is enabled with no policies: only the server (service role) has access.
- Without consent or without a table code, no information leaves the browser.
- The token and keys live only on the server (server-side env) and never reach the browser — no `NEXT_PUBLIC_*`.
- If Discord or the database fails, rolling on the site keeps working normally.

# Online table (group mode)

In addition to local mode (sheet, character creation, combat and rolls all working without a server), the app supports group play: a GM creates a table, players join with a 5-character code, and combat is shared in real time.

## Setup

Run in the Supabase SQL Editor (alongside the Discord migration) the files `supabase/migrations/20260926000000_mesa_sessions.sql`, `supabase/migrations/20260927000000_mesa_combatant_source_key.sql` and `supabase/migrations/20260927000001_mesa_battles.sql` — these create the tables `mesa_sessions`, `mesa_participants`, `mesa_characters`, `mesa_combats`, `mesa_combatants` and `mesa_battles` (RLS enabled with no policies: only the server has access, via service role) and the column `mesa_combatants.source_key`, which identifies which encounter enemy each table row is (without it the app works, it just doesn't mirror enemy HP). The `mesa_battles` table stores match history and makes each encounter single-use (without it combat still works, there is just no history and no blocking of repeated encounters).

Add to `.env.local` (the last two variables are public and go to the browser):

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=        # same project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Project Settings → API → anon public
```

Without the `NEXT_PUBLIC_*` variables the app doesn't break: online mode falls back to 4 s polling instead of Realtime. For true real time, fill them in.

## How to test with 2+ people (different browsers)

1. Run `npm run dev` and open http://localhost:3000 in browser A (the GM).
2. On the sheet, click **🌐 Mesa online** → **[CRIAR MESA]** (Create table) → GM name → **Criar** (Create). The room opens as a panel over the sheet itself (the URL stays on the main screen); the invite link is `http://localhost:3000/mesa/XXXXX`.
3. In browser B (or an incognito window), open the same sheet and click **🌐 Mesa online** → **[ENTRAR EM MESA]** (Join table) → type the code → **Entrar** (Join). (The direct link `http://localhost:3000/mesa/XXXXX` also works: it leads to the same main screen with the panel already open — there is no separate table screen.)
4. Each person links a character (**📋 Usar este personagem na Mesa** — "Use this character at the table"; a copy of the sheet is sent to the server for rules validation).
5. The GM opens **⚔️ Encontros** (Encounters), creates the encounter (faction, level, enemies) and clicks **[ ⚔ Iniciar combate na Mesa ]** (Start combat at the table) — the enemies created there enter the shared table. Then just **[ ROLAR INICIATIVA ]** (Roll initiative) (1d10 + REF — no critical rule: the extra d10 does not apply to Initiative) and **▶ Iniciar Turno** (Start turn): players act only on their own turn and with the turn's 2 Actions; the server rejects any action outside of that (the UI only hides the buttons).
6. Action economy: attack/item/other cost 1 of the 2 Actions; moving costs 0 Actions and draws from its own budget of MOVE × 2 meters per turn (MOVE 10 → 20 m, with the cyberware bonus already included). The player types the meters in the field next to **[ MOVER ]** (Move) and the server validates what's left. Enemies use the bestiary MOVE (`moveStat`).
7. Without opening the panel, roll an attack on the sheet (**🎲 Rolar ataque**, card 03) and reopen the table: the roll is already in **Dados na mesa** (Table dice) and the turn's Actions have been deducted.
8. Repeat the test by publishing on two devices (same LAN or via a tunnel/ngrok).

The Discord table code (🎲 Dados) is a different thing from the table invite code (`joinCode`, 5 characters). Invite = who joins the session; Discord = where the roll is published.

## Where the table lives in the interface

The table is not a separate screen. The **🌐 Mesa online** button is always in the sheet's nav; creating/joining opens the room as a panel over the main screen (`MesaRoomDock`), and closing it returns the sheet exactly as it was. The `/mesa/XXXXX` route exists only for the invite link and mounts the same main screen with the panel already open. The "which table is open" state lives in `src/lib/mesa/mesaUiStore.ts` (in memory — reloading the page closes the panel; reopen it from the nav).

The connection does not depend on the panel. As long as there is a subscription in `membershipStore`, the player stays at the table even with the panel closed (the sheet, inventory and local rolls keep working normally); the nav button turns into an indicator **● Mesa XXXXX** to show this. There are only two ways out:

- the player clicks **[ Sair da mesa ]** (Leave table) — in the room footer or next to each table in the nav list (`DELETE /api/mesa/[id]/participant` removes them from the player list; the GM can only leave after ending the session);
- the GM ends the session — then everyone is dropped automatically, including those with the panel closed (the check happens when opening the screen and, with the panel open, in real time).

**[ ⚔ Iniciar combate na Mesa ]** lives in **⚔️ Encontros** (`/gm/encounters`), next to the encounter the GM just built: that is where enemies enter the shared table. The table panel only points to that screen.

## Dice rolled on the sheet count at the table

While the player is connected, the die rolled in `CharacterSheet` *is* the table action — there's no need to repeat the click in the panel:

- The mirroring happens at the same point as the Discord mirror (`CharacterToolkit.onUpdate → publishMesaRoll`), fire-and-forget: an ended table or a network outage never breaks the local sheet; without an active subscription nothing is sent (local mode untouched).
- `POST /api/mesa/[id]/combat/roll` validates on the server using the same `resolveAction` as the **ATAQUE** (Attack) button. On the player's turn, attacks, skill checks and Evasion deduct 1 Action. Outside their turn or with no Actions left, the roll still enters the log, marked with the reason (`· fora do seu turno` — out of your turn, `· sem Actions sobrando` — no Actions left).
- Damage, damage taken and free/initiative rolls enter the log without costing an Action (they belong to the same attack or aren't combat actions).
- Lines appear in **Dados na mesa** (top of the combat panel) and in the **Registro do combate** (Combat log), with name, total and expression: `Zuberi: Ataque Pistola 17 (REF 6 + 1d10 [7])`.
- With no active combat there is no log: the roll is not sent (`registered: false`). Types with no meaning at the table (e.g. humanity) are rejected with `400 invalid_roll`.
- **GM in ⚔️ Encontros:** attack, Evasion, damage and initiative rolled for an enemy of the encounter linked to the table are sent along with its key (`key` → `source_key` column) — attack and Evasion deduct 1 Action from the enemy's row (Evasion costs the same as on the sheet) and the log records it under the enemy's name (`Militante: Ataque Fuzil 14 …`). Damage and initiative go in at no cost, as always. Without a key (enemy catalog, encounter not at the table) the roll remains a pure report.

The panel's **[ ATAQUE ]**, **[ ITEM ]** and **[ MOVER ]** buttons still exist as shortcuts (GM or a player without an open sheet) — both paths go through the same server validation. The policy (which rolls are sent and how much they cost) lives in `src/lib/mesa/rollPolicy.ts`, a pure module shared by browser, server and tests.

## HP mirrored at the table

The HP of everyone in combat changes at the source and appears at the table for everyone, in one direction only (sheet/encounter → table; nothing flows back from the table to the sheet — decision of 27/09/2026):

- **Player:** HP, max HP or death that change on the sheet (`CharacterToolkit.onUpdate → publishMesaHp`) update the participant's own row in `mesa_combatants.hp_current`. Damage taken, healing, First Aid, healing items and sheet edits all go through the same path — all fire-and-forget; with no active table nothing is sent.
- **Enemies:** damage/healing applied on the **⚔️ Encontros** screen (`handleApplyDamage` / `handleHeal → publishMesaEnemyHp`) update the corresponding table row, identified by the new column `mesa_combatants.source_key` (= the stable id of the encounter participant, sent when combat starts). That's why encounters gained `participant.id` (`ensureEncounterIds` fills in those saved before this feature).
- `POST /api/mesa/[id]/combat/hp` validates on the server: without `key` it's the requester's own combatant; with `key` it's an enemy — GM only. With no active combat or no matching row it returns `updated: false` and nothing changes. The new state is published to Realtime like any other mutation.
- **Death:** an enemy at 0 HP leaves the turn order and returns with HP > 0 (enemies don't make death saves here); a character is only marked dead when the sheet says `isDead` — 0 HP with a pending death save stays in play.
- **Migration required for enemies:** if `source_key` doesn't exist in the database, combat still starts normally (the server re-inserts without the column) and enemy HP mirroring refuses with `503 migration_pending`; player mirroring does not depend on that column.
- Manual GM adjustments in the table panel (−/+ buttons) are still possible, but are overwritten on the next change at the source — the player's sheet and the GM's encounter are in charge.

## Encounter linked to the table and match history

When the GM clicks **⚔ Iniciar combate na Mesa** on the **⚔️ Encontros** screen, the encounter goes along with it and a match is created in `mesa_battles` (migration `20260927000001_mesa_battles.sql`):

- **The encounter is single-use** — `mesa_battles.encounter_id` is `UNIQUE` on the server: an encounter that has already gone into combat can't start a fight again, at any table (`409 encounter_used`). The screen shows the **✅ Concluído** (Completed) badge and the start button disappears. Ad-hoc combat (no encounter) stores `encounter_id = NULL` and blocks nothing.
- **During combat, the table is in charge:** the encounter pulls enemy HP back (including death) via `source_key` — `useMesaState` (Realtime + 4 s polling) → `applyMesaStateToEncounter`, clamped to [0, max HP] so the local invariant isn't broken. Pushes still originate only from GM clicks (`publishMesaEnemyHp`), so there's no loop: outbound (encounter → table) for actions, inbound (table → encounter) for state.
- **The match closes automatically at every end of combat:** GM ending it (`endCombat`), the session ending (`finishSession`) or automatic end with all enemies down (`advanceActiveTurn`). The row becomes `completed` with the final snapshot — starting HP, final HP, who died, who left and the final round.
- **Match history** lives at the bottom of the Encounters screen (`GET /api/mesa/[id]/battles`, GM only): it lists matches with a ✅/⚔ badge and, when the screen opens, reconciles local links (`reconcileEncountersWithBattles`) — covering a fight that ended with the screen closed or one launched in another tab.
- **Restarting without breaking the rule:** `restart: true` on `POST /combat` restarts the same match that's still active at this table (same row in the history); if a different encounter is active, the server responds `combat_already_active` and the UI ends it before entering. `encounter_used` = completed (never again); `encounter_restart` = restart available.
- **Migration required for history:** without the `mesa_battles` table combat still starts normally (just without history or blocking) and `GET /battles` responds `503 migration_pending`.

The link (`EncounterData.battle` in the GM's localStorage) is a UI convenience; what actually enforces the block is the server.

## Encounters come pre-filled

`createEncounterFromFaction` builds each enemy with both layers of flavor already in place:

- **2 personality traits** (`getRandomTraits(2)`) — as always.
- **Implants (cyberware)**, with a quota per level: level 1 → 2, 2 → 3, 3 → 4, 4 → 5 implants (`implantCountForLevel` in `src/data/enemyImplants.ts`). The list starts with the cyberware already in the enemy's JSON (`Enemy.cyberware`, filled in `gm-enemies.ts`) and only then is topped up to the quota with random draws from the cyberware catalog (`items.json`). A base above the quota is not trimmed — what the enemy catalog defines wins.

Enemy implants are description only (decision of 27/09/2026): they appear as a ⚙️ tag on the enemy card, alongside personality traits, and don't affect rolls, HP, armor or Actions — catalog modifiers still apply only to the player's sheet. The field is optional: encounters saved before this feature have no tag (same lack of backfill as personality traits) and enemies created by hand in `/gm/enemies` get only the random draw. Pinned in `tests/enemy-implants.test.ts`.

## Known limitations (Scope 1+2)

- **Delivery 3 pending:** damage/HP/SP/conditions/injuries/death saves are still resolved in the browser and only replicated to other players (the schema and the `combatEngine.ts` adapter are ready to move this to the server).
- **No accounts:** identity is an anonymous per-browser token (localStorage); clearing browser data frees up the table (the GM can rejoin with the same code).
- No chat, voice, tactical map or VTT — just the sheet, lobby and shared combat panel.
- Realtime uses public broadcast by session id (unguessable uuid), not `postgres_changes`.

## Architecture in one line

localStorage remains the local source of truth; the table stores a copy of the sheet in `mesa_characters` (jsonb) so the server can validate the rules. All combat rules live in `src/lib/combatEngine.ts` (pure functions), used by both local mode and the server endpoint — the only difference is where state is persisted.

# Cyberware: what already applies an effect

The catalog (`src/data/items.json`) has these fields per item:

- `effects` — text shown to the player (shop, inventory and sheet).
- `modifiers` — structured numeric effect, which is what the engine actually applies. Only passive effects go here (always active while the piece is installed).
- `activation` — activatable effect: defines the stages of a manual toggle on the cyberware card. While the piece is inactive nothing is applied; turning the toggle on applies the modifiers for that stage.
- `action` — button-triggered ability (heal), available only while the piece is activated.

What reads `modifiers`/`activation` is `src/lib/cyberwareEffects.ts`, consumed by `rollSkillCheck`, `rollAttack`, `rollEvasion`, Initiative, damage (`src/lib/damage.ts`) and installation (`src/lib/cyberware.ts` / `src/lib/inventory.ts`). Every applied bonus is credited in the roll history as `Cyberware (Name)`.

| Cyberware | Applied effect |
|---|---|
| Gorilla Arms | +2 Brawling · unarmed attack +1d6 |
| Audio Filter | +2 Perception |
| Reinforced Tendons | +2 Athletics (jump checks) |
| Targeting Scope | +1 to ranged attacks |
| Smart Weapon Link | +1 to attacks with Smart weapons |
| Subdermal Armor / Skin Weave | SP 11 / 7 on the body (doesn't stack with armor: the higher one applies) |
| Mantis Blades / Monowire / Projectile Launch System | become their own weapon on installation (removed from the sheet along with the piece) |

**Requirements (`requires`)** — checked when installing/equipping, with the error message shown in the inventory:

- `neural_link` is required by all cyberware in the neuralware subcategory (Sandevistan, Kerenzikov, Reflex Tuner, Combat Awareness Processor, Smart Weapon Link).
- `cybereye` / `cyberaudio` for optical and audio enhancements — the Cybereye accepts at most 2 optical enhancements.
- `smart_link` to equip Smart weapons.

**Assumed approximations** (the engine doesn't model the context yet): Targeting Scope applies to any ranged attack (there's no concept of range) and Reinforced Tendons adds +2 to any Athletics check (there's no standalone jump check).

Enemies in **⚔️ Encontros** also come with implants randomly drawn by level — but there it's description only (a tag on the card, no modifiers): see *Encounters come pre-filled*.

## Manual activation (per-piece toggle)

Without a combat round system, activatable effects use a manual toggle on the cyberware card: the button cycles through the stages (inactive → stage 0 → stage 1 → … → inactive). Duration, "once per combat" and number of uses are up to the player — the toggle is the lock, not a timer.

| Cyberware | Stages | Applied effect |
|---|---|---|
| Sandevistan | Acelerado (Accelerated) | +4 Initiative · +1 Evasion (the "+1 REF on reaction checks") |
| Kerenzikov | Em movimento (In motion) | +2 Initiative · +1 Evasion |
| Combat Awareness Processor | Em combate (In combat) | +2 Perception |
| Optical Camo | Camuflado (Camouflaged) | +4 Stealth |
| Adrenaline Booster | Impulso → Rescaldo (Boost → Aftermath) | +2 MOVE (shown on the stat) → −1 on physical checks |
| Pain Editor | Ignorando dor (Ignoring pain) | cancels the −2 serious-wound (HP) penalty on First Aid, skill, attack and Evasion |
| Reflex Tuner | Pronto para repetir (Ready to repeat) | unlocks the **↻ Repetir** (Repeat) button on Initiative; using it turns the piece off |
| Nano Repair | Rodada ativa (Active round) | unlocks **✚ +2 HP** (doesn't heal above max) |

**Serious-wound penalty (issue #4, fixed):** `getWoundPenalty` (`src/lib/calculations.ts`) is the single source — it returns −2 when the character is Seriously/Mortally Wounded and 0 when the Pain Editor is active. It applies to First Aid, `rollSkillCheck`, `rollAttack`, `rollEvasion` and Initiative; in all of them it appears as the tag "Lesão grave (HP)" (Serious wound) in the modifiers, so the player can see where the −2 came from. Only the GM's enemy rolls remain out of scope — noted in `PENDENCIAS.md`.

## Roll math

A single identity holds for all four rolls and is what the sheet draws on screen:

```
total = base STAT + skill + d10 + Σ(modifiers)
```

- `rollSkillCheck` and `rollAttack` count the injury STAT penalty only once (it appears as a tag; the displayed STAT is the base) — previously it was counted twice in both.
- `rollAttack` counts `context.modifiers` once — previously it was applied twice.
- Weapon attacks get the "Distância" (Ranged) / "Corpo a corpo" (Melee) injury modifiers — previously no weapon attack got them, because detection checked `context.type` (always `"weapon"`) instead of the resolved type; the list also now uses `AttackType` (including `smg`).
- Initiative moved out of the component into `src/lib/initiative.ts` and now includes cyberware, injuries and serious wounds. The roll itself is pure 1d10 + REF: no critical rule — a natural 10 doesn't add an extra d10 and a natural 1 doesn't subtract (the same rule applies to enemies, in `rollEnemyInitiative`, and to the table's **[ ROLAR INICIATIVA ]**).

Pinned in `tests/roll-modifier-math.test.ts` and `tests/initiative.test.ts`.

## Attack × damage validation

`tests/cyberware-combat-matrix.test.ts` pins two things separately for each scenario:

- the damage expression of the attack result (`result.damageDice`) — this is what the **Rolar Dano** (Roll Damage) button uses;
- the attack modifiers (`result.modifiers`) — and the total must equal stat + skill + d10 + modifiers, proving each bonus counts exactly once.

The damage bonus (`unarmed_damage`) never appears as an attack modifier and no attack bonus changes the damage expression. `rollDamage` confirms the number of dice is actually rolled. Coverage: Gorilla Arms (Brawling, Martial Arts, Brawling weapon, melee weapon), Targeting Scope, Smart Weapon Link, cyberware armor and Mantis Blades.

To avoid "just trust it", the sheet shows the damage breakdown right below the button (`Rolar Dano (3d6) → Base (BODY 5): 2d6 · Gorilla Arms: +1d6`). The field comes from `result.damageSources`, filled in `rollAttack` for unarmed attacks; weapons have no breakdown, because the damage is the weapon's own. `tests/cyberware-damage-e2e.test.ts` repeats the exact UI flow (attack list → attack → damage → application) for BODY 2/5/7/9 with and without Gorilla Arms, for both unarmed strikes.

**Decision:** Gorilla Arms does not give +2 to Martial Arts (the stated effect is "+2 Brawling"); the +1d6 damage applies to both, since it's an unarmed-attack effect.

## Pain Editor validation

`tests/pain-editor-validation.test.ts` covers three fronts:

- **First Aid** → the −2 drops out of the calculation when the toggle is on (`injuryModifier` goes from −2 to 0, an exact difference of 2) and returns when it's off. Run at HP 0/40 (Mortally Wounded).
- **Scope** → it ignores only the −2 coming from HP. A Critical Injury of −2 to all actions still applies even with the implant on (−4 with toggle off, −2 with toggle on).
- **Skill, attack and Evasion** → at HP 10/40 and HP 0/40 all three rolls lose exactly 2 points compared to the same healthy character (and the "Lesão grave (HP)" tag appears in the modifiers). Turning on the Pain Editor restores all three to the healthy character's value and the tag disappears.

# Brawling and Martial Arts

Rules implemented on 25/09/2026 (`tests/martial-arts.test.ts` covers each item):

- **Damage by BODY, the same for both strikes:** 1–4 = 1d6 · 5–6 = 2d6 · 7–10 = 3d6 · 11+ = 4d6 (single source: `getUnarmedDamageDice`; BODY 9/10 went from 4d6 to 3d6 — issue #6 was the test expecting 2d6 at BODY 2, and it was wrong).
- **Cyberarm = 2d6 floor:** with any cyberarm installed, unarmed damage doesn't go below 2d6, and Gorilla Arms' +1d6 still stacks on top (table decision: floor + bonus, not floor instead of bonus — BODY 5 with Gorilla Arms stays at 3d6).
- **Four forms are separate skills:** Martial Arts (Karate), (Taekwondo), (Judo), (Aikido), category `fighting`, double cost, no required level at creation. They're used only for that form's Special Moves (each move rolls only its own form's level — Karate 4 + Aikido 3 never counts as 7).
- **A single attack card** (table decision of 26/09/2026): the "Rolar Ataques" (Roll Attacks) list in Card 03 has a single **Martial Arts** card, which rolls the parent skill (`martial_arts`, the IP one). The forms don't become their own attack cards. The card only appears with a parent level > 0.
- **ROF 2** appears in the details of every skill-based attack (Brawling and the forms).
- **Martial Arts ignores half of SP, rounded up** (SP 11 → 6): this applies along the `rollAttack → rollDamage → applyAttackDamage` path, which carries `attackType` all the way, and the sheet notes it below the damage. Brawling and weapons still use full SP.
- **Special Moves** (`src/data/specialMoves.ts`): the 9 moves (Recovery + 8 per form) appear in Card 03 with the original requirement, the original effect, the skill that will be used and the reason for being locked in red. Structured requirements: form skill, WILL 8+, MOVE 8+ and turn flags. `check` rolls the form's skill vs the DV from the JSON; `attack` (Bone Breaking Strike, Pressure Point Strike, Flying Kick) becomes a normal Martial Arts attack — same list, same damage button, same SP rule.
- **Special Moves start locked and cost 1 point** (table decision of 25/09/2026): points come from the parent Martial Arts skill (1 point per level; MA 4 = 4 points). The same pool pays for specializations (scaling cost: Karate 1 = 1 pt, Karate 2 = 2 pt…) and move unlocks. The card shows the balance (`level 4 = 4 pts · 3 in specializations · 1 in moves · 0 free`), a **Liberável**/**Travado** (Unlockable/Locked) badge, a **🔓 Desbloquear** (Unlock) button and **↺ Devolver** (Refund point). The original requirements still apply after paying. Tests: `tests/martial-arts.test.ts` (single pool, refund, refusal).
- **Specializations in Card 03:** the 4 forms (Karate, Taekwondo, Judo, Aikido) were removed from the skill list and got their own panel in Card 03, between Attacks and Special Moves, with ↑/↓ to raise/revert level (scaling cost in MA points), the pool balance and a debt warning. The parent Martial Arts skill stays in the skill list (bought with IP) and shows a badge **N pontos livres** (N free points) — it's the only source of points: 1 point per level.

**Out of scope for this round** (detailed in `PENDENCIAS.md`): Grapple/Grab/Choke/Throw don't exist in the app, ROF 2 is informational (there's no action economy), turn state is manual in the Card 03 panel, and effects that target someone else (injuries, ablation, Prone) are reported, not applied — the player's sheet has no target.

_____________________________________________________________________________________________________________________________________________________________
Portuguese Version
_____________________________________________________________________________________________________________________________________________________________
## Discord (espelho de rolagens)

O site pode publicar as rolagens já calculadas em um canal do Discord. O bot **não rola dados** — ele apenas reproduz o resultado produzido pelo site. Um **único bot** atende vários servidores: cada mesa escolhe servidor e canal. O envio usa a **API REST** do Discord (sem gateway), estável no serverless da Vercel.

1. Crie o bot em <https://discord.com/developers/applications>, copie o token e convide-o para os servidores (permissões apenas **Ver canal** e **Enviar mensagens** — não use *Administrator*).
2. Crie um projeto no [Supabase](https://supabase.com) e rode o SQL de `supabase/migrations/20260923120000_mesa_discord_configs.sql` no SQL Editor (cria só a tabela `mesa_discord_configs`).
3. Copie `.env.example` para `.env.local` e preencha:

```env
DISCORD_BOT_TOKEN=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

4. Inicie o projeto (`npm run dev`). Na primeira visita o site pergunta se você quer enviar as rolagens ao Discord; a escolha pode ser alterada depois em 🎲 Dados.
5. Em **🎲 Dados → Discord**: gere/defina o **código da mesa** (ex.: `night-city`) e clique em **⚙ Configurar servidor** para escolher o servidor e o canal. Os jogadores usam o mesmo código da mesa.
6. Ao rolar na ficha com o envio ativado, a mensagem aparece **somente** no canal do servidor vinculado àquela mesa.
7. Para o deploy: adicione as três variáveis acima também em **Vercel → Settings → Environment Variables** e faça redeploy.

Detalhes:

- O banco guarda **apenas** `sessionCode → guildId → channelId` (nenhuma rolagem, ficha ou personagem). RLS habilitado sem policies: só o servidor (service role) acessa.
- Sem consentimento ou sem código de mesa, **nenhuma informação sai do navegador**.
- Token e chaves ficam só no servidor (env server-side) e nunca chegam ao navegador — nada de `NEXT_PUBLIC_*`.
- Se o Discord ou o banco falhar, a rolagem do site continua funcionando normalmente.

## Mesa online (modo grupo)

Além do modo local (ficha, criação, combate e rolagens funcionando **sem servidor**), o app permite jogar em grupo: um GM cria uma **mesa**, os jogadores entram por um código de 5 caracteres e o **combate é compartilhado** em tempo real.

### Configuração

1. Rode no SQL Editor do Supabase (junto com a migração do Discord) os arquivos `supabase/migrations/20260926000000_mesa_sessions.sql`, `supabase/migrations/20260927000000_mesa_combatant_source_key.sql` e `supabase/migrations/20260927000001_mesa_battles.sql` — as tabelas `mesa_sessions`, `mesa_participants`, `mesa_characters`, `mesa_combats`, `mesa_combatants` e `mesa_battles` (RLS habilitado sem policies: só o servidor acessa, via service role) e a coluna `mesa_combatants.source_key`, que identifica **qual inimigo do encontro** é cada linha da mesa (sem ela o app funciona, só não espelha a vida dos inimigos). A tabela `mesa_battles` guarda o **histórico de partidas** e torna cada encontro de uso único (sem ela o combate continua funcionando, só não há histórico nem bloqueio de encontro repetido).
2. Adicione ao `.env.local` (as duas últimas variáveis são públicas, vão para o navegador):

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=        # mesma URL do projeto
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Project Settings → API → anon public
```

3. Sem as variáveis `NEXT_PUBLIC_*` o app não quebra: o modo online passa a usar **polling de 4s** em vez do Realtime. Para tempo real de verdade, preencha-as.

### Como testar com 2+ pessoas (navegadores diferentes)

1. `npm run dev` e abra `http://localhost:3000` no navegador A (o GM).
2. Na ficha, clique em **🌐 Mesa online** → **[CRIAR MESA]** → nome do GM → **Criar**. A sala abre como **painel sobre a própria ficha** (a URL continua sendo a tela principal); o link de convite é `http://localhost:3000/mesa/XXXXX`.
3. No navegador B (ou uma janela anônima), abra a mesma ficha e clique em **🌐 Mesa online** → **[ENTRAR EM MESA]** → digite o código → **Entrar**. (O link direto `http://localhost:3000/mesa/XXXXX` também funciona: leva à mesma tela principal com o painel já aberto — **não** existe tela separada de mesa.)
4. Cada um associa um personagem (**📋 Usar este personagem na Mesa** — uma cópia da ficha vai ao servidor para validação das regras).
5. O GM abre **⚔️ Encontros**, cria o encontro (facção, nível, inimigos) e clica em **[ ⚔ Iniciar combate na Mesa ]** — os inimigos criados ali entram na mesa partilhada. Depois é só **[ ROLAR INICIATIVA ]** (**1d10 + REF** — sem regra de crítico: o d10 extra não vale para Iniciativa) e **▶ Iniciar Turno**: jogadores agem só no próprio turno e com as 2 Actions do turno; o servidor rejeita qualquer ação fora disso (a UI apenas esconde os botões).
6. **Economia de ações**: `attack/item/other` custam 1 das 2 Actions; **mover custa 0 Actions** e sai de um orçamento próprio de **MOVE × 2 metros por turno** (MOVE 10 → 20 m, com o bônus de cyberware já somado). O jogador digita os metros no campo ao lado de **[ MOVER ]** e o servidor valida o que sobrou. Inimigos usam o MOVE do bestiário (`moveStat`).
7. Sem abrir o painel, role um ataque na ficha (**🎲 Rolar ataque**, card 03) e reabra a mesa: a rolagem já está em **Dados na mesa** e as Actions do turno foram debitadas.
8. Repita o teste publicando em dois dispositivos (mesma LAN ou via túnel/ngrok).

> O **código da mesa do Discord** (`🎲 Dados`) é uma coisa diferente do **código de convite da Mesa** (`joinCode`, 5 caracteres). Convite = quem entra na sessão; Discord = para onde a rolagem é publicada.

### Onde a mesa vive na interface

A mesa **não é uma tela separada**. O botão **🌐 Mesa online** fica sempre no nav da ficha; criar/entrar abre a sala como **painel por cima da tela principal** (`MesaRoomDock`), e fechar devolve a ficha exatamente como estava. A rota `/mesa/XXXXX` só existe para o link de convite e monta **a mesma tela principal** com o painel já aberto. O estado "qual mesa está aberta" vive em `src/lib/mesa/mesaUiStore.ts` (em memória — recarregar a página fecha o painel; reabre pelo nav).

**A conexão não depende do painel.** Enquanto houver assinatura em `membershipStore`, o jogador continua na mesa mesmo com o painel fechado (a ficha, o inventário e as rolagens locais seguem funcionando normalmente); o botão do nav vira um indicador **`● Mesa XXXXX`** para mostrar isso. Só há **dois** caminhos de saída:

- o jogador clicar em **[ Sair da mesa ]** — no rodapé da sala ou ao lado de cada mesa na lista do nav (`DELETE /api/mesa/[id]/participant` some com ele na lista de jogadores; o Mestre só pode sair depois de encerrar a sessão);
- o Mestre **encerrar a sessão** — aí todos caem fora sozinhos, inclusive quem estava com o painel fechado (a conferência acontece ao abrir a tela e, com o painel aberto, em tempo real).

O **[ ⚔ Iniciar combate na Mesa ]** mora em **⚔️ Encontros** (`/gm/encounters`), ao lado do encontro que o Mestre acabou de montar: é dali que os inimigos entram na mesa partilhada. O painel da mesa só aponta para essa tela.

### Dados rolados na ficha valem na mesa

Enquanto o jogador estiver conectado, **o dado rolado na CharacterSheet é a ação da mesa** — não é preciso repetir o clique no painel:

- O espelho acontece no mesmo ponto do espelho do Discord (`CharacterToolkit.onUpdate` → `publishMesaRoll`), **fire-and-forget**: mesa encerrada ou rede fora nunca quebra a ficha local; sem assinatura ativa nada é enviado (modo local intacto).
- `POST /api/mesa/[id]/combat/roll` valida no servidor com a **mesma `resolveAction`** do botão ATAQUE. No turno do jogador, **ataque, testes de perícia e Evasão debitam 1 Action**. Fora do turno ou sem Actions sobrando, a rolagem **ainda entra no registro**, marcada com o motivo (`· fora do seu turno`, `· sem Actions sobrando`).
- **Dano, dano recebido e rolagem livre/iniciativa** entram no registro **sem custar Action** (pertencem ao mesmo ataque ou não são ação de combate).
- As linhas aparecem em **Dados na mesa** (topo do painel de combate) e no **Registro do combate**, com nome, total e expressão: `Zuberi: Ataque Pistola 17 (REF 6 + 1d10 [7])`.
- Sem combate ativo não há registro: a rolagem não é enviada (`registered: false`). Tipos sem significado na mesa (ex.: humanidade) são recusados com `400 invalid_roll`.
- **Mestre na ⚔️ Encontros**: o ataque, a **Evasão**, o dano e a iniciativa rolados para um inimigo do encontro **vinculado à mesa** vão junto com a chave dele (`key` → coluna `source_key`) — **o ataque e a Evasão debitam 1 Action da linha do inimigo** (a Evasão é o mesmo custo da ficha) e o Registro passa a gravar com o nome do inimigo (`Militante: Ataque Fuzil 14 …`). Dano e iniciativa entram sem custo, como sempre. Sem chave (catálogo de inimigos, encontro fora da mesa) a rolagem continua sendo relatório puro.

Os botões **[ ATAQUE ]**, **[ ITEM ]** e **[ MOVER ]** do painel continuam existindo como atalho (GM ou jogador sem ficha aberta) — os dois caminhos passam pela **mesma validação** do servidor. A política (quais rolagens vão e quanto custa) fica em `src/lib/mesa/rollPolicy.ts`, módulo puro compartilhado por navegador, servidor e testes.

### Vida (HP) espelhada na mesa

A vida de quem participa do combate **muda na origem e aparece na mesa para todo mundo**, num sentido só
(ficha/encontro → mesa; nada volta da mesa para a ficha — decisão de 27/09/2026):

- **Jogador**: HP, HP máximo ou morte que mudarem na ficha (`CharacterToolkit.onUpdate` → `publishMesaHp`)
  atualizam a linha do próprio participante em `mesa_combatants.hp_current`. Dano recebido, cura, First Aid,
  item de cura e edição da ficha entram pelo mesmo caminho — tudo fire-and-forget, sem mesa ativa não sai nada.
- **Inimigos**: dano/cura aplicados na tela de **⚔️ Encontros** (`handleApplyDamage` / `handleHeal` →
  `publishMesaEnemyHp`) atualizam a linha correspondente da mesa, identificada pela coluna nova
  **`mesa_combatants.source_key`** (= o `id` estável do participante do encontro, enviado no início do
  combate). É por isso que os encontros ganharam `participant.id` (`ensureEncounterIds` completa os salvos
  antes desta feature).
- `POST /api/mesa/[id]/combat/hp` faz a validação no servidor: sem `key` é o combatente de **quem pediu**;
  com `key` é inimigo — **só o Mestre**. Sem combate ativo ou sem linha correspondente devolve
  `updated: false` e nada muda. O estado novo é publicado no Realtime como qualquer outra mutação.
- **Morte**: inimigo com 0 HP sai da ordem de turno e volta com HP > 0 (inimigo não faz death save aqui);
  personagem só é marcado morto quando a **ficha** diz `isDead` — 0 HP com death save pendente continua em jogo.
- **Migração obrigatória para os inimigos**: se `source_key` não existir no banco, o combate continua
  **começando normalmente** (o servidor re-insere sem a coluna) e o espelho de vida de inimigo recusa com
  `503 migration_pending`; o espelho dos jogadores não depende dessa coluna.
- **Ajuste manual do GM no painel da mesa** (botões −/+) continua possível, mas é **sobrescrito** na próxima
  mudança da origem — quem manda é a ficha do jogador e o encontro do Mestre.

### Encontro vinculado à mesa e histórico de partidas

Quando o Mestre clica **⚔ Iniciar combate na Mesa** na tela de **⚔️ Encontros**, o encontro viaja junto e nasce
uma **partida** em `mesa_battles` (migração `20260927000001_mesa_battles.sql`):

- **O encontro é de uso único** — `mesa_battles.encounter_id` é UNIQUE **no servidor**: quem já entrou em
  combate não inicia luta de novo, em mesa nenhuma (`409 encounter_used`). A tela mostra o selo
  **✅ Concluído** e o botão de início some. Combate avulso (sem encontro) grava `encounter_id = NULL` e não
  bloqueia nada.
- **Durante o combate quem manda é a mesa**: o encontro **puxa** de volta o HP dos inimigos (morte incluída)
  pelo `source_key` — `useMesaState` (Realtime + polling de 4s) → `applyMesaStateToEncounter`, aparado em
  `[0, HP máximo]` para não quebrar o invariante local. O empurrão continua nascendo **só de clique do Mestre**
  (`publishMesaEnemyHp`), então não há loop: ida (encontro → mesa) para **ação**, volta (mesa → encontro)
  para **estado**.
- **A partida fecha sozinha em todo fim de combate**: GM encerrar (`endCombat`), sessão encerrar
  (`finishSession`) ou fim automático com todos os inimigos caídos (`advanceActiveTurn`). A linha vira
  `completed` com o snapshot final — vida de entrada, vida final, quem morreu, quem saiu e a rodada final.
- **Histórico de partidas** vive no fim da tela de Encontros (`GET /api/mesa/[id]/battles`, só GM): lista as
  partidas com selo ✅/⚔ e, ao abrir a tela, **reconcilia** os vínculos locais
  (`reconcileEncountersWithBattles`) — cobre a luta que acabou com a tela fechada e a lançada noutro separador.
- **Reiniciar sem furar a regra**: `restart: true` no `POST /combat` recomeça a **mesma** partida ainda ativa
  nesta mesa (mesma linha no histórico); se quem está ativo é outro encontro, o servidor responde
  `combat_already_active` e a UI encerra antes de entrar. `encounter_used` = concluído (nunca mais);
  `encounter_restart` = recomeço disponível.
- **Migração obrigatória para o histórico**: sem a tabela `mesa_battles` o combate continua **começando
  normalmente** (só sem histórico e sem bloqueio) e `GET /battles` responde `503 migration_pending`.

O vínculo (`EncounterData.battle` no localStorage do Mestre) é **conveniência de UI**; quem bloqueia de verdade
é o servidor.

### Encontro já nasce preenchido

`createEncounterFromFaction` monta cada inimigo já com as duas camadas de papel:

- **2 características de personalidade** (`getRandomTraits(2)`) — desde sempre.
- **Implantes (cyberware), com cota por nível**: nível 1 → 2, 2 → 3, 3 → 4, 4 → 5 implantes
  (`implantCountForLevel` em `src/data/enemyImplants.ts`). A lista **começa pelos `cyberware` que já vêm no
  JSON do inimigo** (`Enemy.cyberware`, preenchido em `gm-enemies.ts`) e só então é completada até a cota
  com sorteio do catálogo de cyberware (`items.json`). Base acima da cota **não é cortada** — o que o
  catálogo do inimigo definiu manda.

Implante de inimigo é **só descrição** (decisão de 27/09/2026): aparece como tag ⚙️ no card do inimigo, junto
das personalidades, e **não mexe** em rolagem, HP, armor nem Actions — os `modifiers` do catálogo continuam
valendo só para a ficha do jogador. O campo é opcional: encontros salvos antes desta feature ficam sem a tag
(mesma ausência de backfill das personalidades) e inimigos criados à mão em `/gm/enemies` saem só com o
sorteio. Fixado em `tests/enemy-implants.test.ts`.

### Limitações conhecidas (Escopo 1+2)

- **Entrega 3 pendente**: dano/HP/SP/condições/lesões/death saves ainda são resolvidos **no navegador** e apenas replicados para os outros jogadores (o schema e o adaptador `combatEngine.ts` já estão prontos para subir isso para o servidor).
- Sem contas: a identidade é um token anônimo por navegador (`localStorage`); limpar os dados do navegador libera a mesa (o GM pode re-entrar com o mesmo código).
- Sem chat, voz, mapa tático ou VTT — só ficha, lobby e painel de combate compartilhado.
- O Realtime usa **broadcast público por id de sessão** (uuid não adivinhável), não `postgres_changes`.

### Arquitetura em uma linha

`localStorage` continua a fonte da verdade **local**; a Mesa guarda uma **cópia** da ficha em `mesa_characters` (jsonb) para o servidor validar as regras. Toda regra de combate vive em `src/lib/combatEngine.ts` (funções puras), usada **tanto pelo modo local quanto pelo endpoint do servidor** — a única diferença é onde o estado é persistido.

## Cyberware: o que já aplica efeito

O catálogo (`src/data/items.json`) tem dois campos por item:

- `effects` — texto exibido ao jogador (loja, inventário e ficha).
- `modifiers` — efeito **numérico estruturado**, que é o que o motor realmente aplica. Só entram aqui efeitos **passivos** (sempre ativos enquanto a peça estiver instalada).
- `activation` — efeito **ativável**: define os estágios de um **toggle manual** no card do cyberware. Enquanto a peça está inativo nada é aplicado; ligando o toggle entram em vigor os `modifiers` daquele estágio.
- `action` — habilidade disparada por botão (`heal`), liberada só enquanto a peça está ativada.

Quem lê `modifiers`/`activation` é `src/lib/cyberwareEffects.ts`, consumido por `rollSkillCheck`, `rollAttack`, `rollEvasion`, Iniciativa, dano (`src/lib/damage.ts`) e instalação (`src/lib/cyberware.ts` / `src/lib/inventory.ts`). Todo bônus aplicado aparece creditado no histórico de rolagens como `Cyberware (Nome)`.

| Cyberware | Efeito aplicado |
| --- | --- |
| Gorilla Arms | +2 Brawling · ataque desarmado +1d6 |
| Audio Filter | +2 Percepção |
| Reinforced Tendons | +2 Athletics (testes de salto) |
| Targeting Scope | +1 em ataques à distância |
| Smart Weapon Link | +1 em ataques com armas Smart |
| Subdermal Armor / Skin Weave | SP 11 / 7 no corpo (não acumula com armadura: vale o maior) |
| Mantis Blades / Monowire / Projectile Launch System | viram arma própria na instalação (saem da ficha junto na remoção) |

**Requisitos (`requires`)** — verificados ao instalar/equipar, com a mensagem de erro exibida no inventário:

- `neural_link` é exigido por todo cyberware da subcategoria *neuralware* (Sandevistan, Kerenzikov, Reflex Tuner, Combat Awareness Processor, Smart Weapon Link).
- `cybereye` / `cyberaudio` para aprimoramentos óticos e auditivos — o Cybereye aceita **no máximo 2** aprimoramentos óticos.
- `smart_link` para equipar armas Smart.

**Aproximações assumidas** (o motor não modela o contexto ainda): Targeting Scope vale para qualquer ataque à distância (não existe noção de alcance) e Reinforced Tendons soma +2 em qualquer teste de Athletics (não existe teste de salto isolado).

**Inimigos da ⚔️ Encontros** também nascem com implantes sorteados por nível — mas ali é **só descrição** (uma tag no card, sem `modifiers`): ver *Encontro já nasce preenchido*.

### Ativação manual (toggle por peça)

Sem sistema de rodadas de combate, os efeitos ativáveis usam um **toggle manual** no card do cyberware: o botão percorre os estágios (inativo → estágio 0 → estágio 1 → ... → inativo). Duração, "1 vez por combate" e o número de usos ficam a cargo do jogador — o toggle é a trava, não um cronômetro.

| Cyberware | Estágios | Efeito aplicado |
| --- | --- | --- |
| Sandevistan | Acelerado | +4 Iniciativa · +1 Evasão (o "+1 REF em testes de reação") |
| Kerenzikov | Em movimento | +2 Iniciativa · +1 Evasão |
| Combat Awareness Processor | Em combate | +2 Percepção |
| Optical Camo | Camuflagado | +4 Furtividade |
| Adrenaline Booster | Impulso → Rescaldo | +2 MOVE (exibido no atributo) → −1 em testes físicos |
| Pain Editor | Ignorando dor | anula o `−2` de lesão grave (HP) em First Aid, perícia, ataque e Evasão |
| Reflex Tuner | Pronto para repetir | libera o botão **↻ Repetir** na Iniciativa; usar desliga a peça |
| Nano Repair | Rodada ativa | libera **✚ +2 HP** (não cura acima do máximo) |

**Penalidade de lesão grave (pendência nº 4, corrigida)**: `getWoundPenalty` (`src/lib/calculations.ts`) é a fonte única — devolve `−2` quando o personagem está Seriously/Mortally Wounded e `0` quando o Pain Editor está ativo. Vale em First Aid, `rollSkillCheck`, `rollAttack`, `rollEvasion` e **Iniciativa**; em todas elas aparece como tag **"Lesão grave (HP)"** nos modificadores, para o jogador ver de onde veio o `−2`. Fora do escopo seguem só as rolagens de **inimigo do GM** — anotado em [`PENDENCIAS.md`](./PENDENCIAS.md).

### Matemática das rolagens

Uma identidade vale para os quatro rolls e é o que a ficha desenha na tela:

```
total = STAT base + perícia + d10 + Σ(modificadores)
```

- `rollSkillCheck` e `rollAttack` contam a penalidade de **STAT** da lesão **uma vez só** (ela aparece como tag; o STAT exibido é o base) — antes contava em dobro nos dois.
- `rollAttack` conta `context.modifiers` **uma vez** — antes entrava duas vezes.
- Ataque com **arma** leva os modificadores de lesão "Distância" / "Corpo a corpo" — antes nenhum ataque com arma levava, porque a detecção olhava `context.type` (sempre `"weapon"`) em vez do tipo resolvido; a lista também passou a usar `AttackType` (incluindo `smg`).
- **Iniciativa** saiu do componente para `src/lib/initiative.ts` e agora leva cyberware, lesões e a lesão grave. A rolagem em si é **1d10 + REF puro**: **sem regra de crítico** — natural 10 não soma um d10 extra e natural 1 não subtrai (a mesma regra vale para os inimigos, em `rollEnemyInitiative`, e para o **[ ROLAR INICIATIVA ]** da mesa).

Fixado em `tests/roll-modifier-math.test.ts` e `tests/initiative.test.ts`.

### Validação ataque × dano

`tests/cyberware-combat-matrix.test.ts` fixa, por cenário, as duas coisas separadamente:

1. **expressão de dano** do resultado do ataque (`result.damageDice`) — é o que o botão *Rolar Dano* usa;
2. **modificadores do ataque** (`result.modifiers`) — e o total tem de bater com `stat + perícia + d10 + modificadores`, provando que cada bônus conta **uma única vez**.

O bônus de dano (`unarmed_damage`) nunca aparece como modificador de ataque e nenhum bônus de ataque muda a expressão de dano. `rollDamage` confirma que a quantidade de dados rola de verdade. Cobertura: Gorilla Arms (Brawling, Martial Arts, arma de Brawling, arma melee), Targeting Scope, Smart Weapon Link, armadura de cyberware e Mantis Blades.

Para não ficar no "confia", a ficha mostra a **composição do dano** logo abaixo do botão (*Rolar Dano (3d6)* → `Base (BODY 5): 2d6 · Gorilla Arms: +1d6`). O campo vem de `result.damageSources`, preenchido em `rollAttack` para ataques desarmados; armas não têm composição, porque o dano é o da própria arma. `tests/cyberware-damage-e2e.test.ts` repete o fluxo exato da UI (lista de ataques → ataque → dano → aplicação) para BODY 2/5/7/9 com e sem Gorilla Arms, nos dois golpes desarmados.

**Decisão**: Gorilla Arms **não** dá +2 em Martial Arts (o efeito declarado é "+2 Briga"); o +1d6 de dano vale para os dois, por ser efeito de ataque desarmado.

### Validação Pain Editor

`tests/pain-editor-validation.test.ts` cobre três frentes:

1. **First Aid** → o `−2` sai da conta quando o toggle liga (`injuryModifier` vai de `−2` para `0`, diferença exata de 2) e volta quando desliga. Rodando em HP 0/40 (Mortally Wounded).
2. **Escopo** → ele ignora **só** o `−2` vindo do HP. Uma Critical Injury de `−2 em todas as ações` continua valendo mesmo com o implante ligado (`−4` com toggle off, `−2` com toggle on).
3. **Perícia, ataque e Evasão** → com HP 10/40 e HP 0/40 os três rolls perdem exatamente 2 pontos contra o mesmo personagem saudável (e a tag "Lesão grave (HP)" aparece nos modificadores). Ligar o Pain Editor devolve os três ao valor do personagem saudável e some a tag.

### Brawling e Martial Arts

Regras implementadas em 25/09/2026 (`tests/martial-arts.test.ts` cobre cada item):

- **Dano por BODY**, igual para os dois golpes: `1–4 = 1d6 · 5–6 = 2d6 · 7–10 = 3d6 · 11+ = 4d6`
  (fonte única: `getUnarmedDamageDice`; **BODY 9/10 passou de 4d6 para 3d6** — a pendência nº 6 era o
  teste que esperava `2d6` num BODY 2, e estava errado).
- **Cyberarm = piso de 2d6**: com qualquer cyberarm instalado o desarmado não fica abaixo de `2d6`, e o
  **+1d6 do Gorilla Arms continua somando por cima** (decisão da mesa: piso **+** bônus, não piso no lugar
  do bônus — BODY 5 com Gorilla Arms segue em `3d6`).
- **Quatro formas são perícias separadas**: `Martial Arts (Karate)`, `(Taekwondo)`, `(Judo)`, `(Aikido)`,
  categoria `fighting`, custo duplo, sem nível obrigatório na criação. Servem **só para os Special Moves**
  daquela forma (cada move rola **só o nível da sua forma** — Karate 4 + Aikido 3 nunca valem 7).
- **Um card de ataque só** (decisão da mesa de 26/09/2026): a lista "Rolar Ataques" do Card 03 tem **um
  único card `Martial Arts`**, que rola a **perícia-mãe** (`martial_arts`, a de IP). As formas não viram
  cards de ataque próprios. O card só aparece com nível na mãe > 0.
- **ROF 2** aparece no detalhe de todo ataque por perícia (Brawling e formas).
- **Martial Arts ignora metade do SP, arredondando para cima** (SP 11 → 6): vale no caminho
  `rollAttack → rollDamage → applyAttackDamage`, que carrega `attackType` até lá, e a ficha avisa embaixo
  do dano. Brawling e armas continuam usando o SP cheio.
- **Special Moves** (`src/data/specialMoves.ts`): os 9 moves (Recovery + 8 por forma) aparecem no Card 03
  com o requisito original, o efeito original, a perícia que será usada e o motivo do bloqueio em vermelho.
  Requisitos estruturados: perícia da forma, `WILL 8+`, `MOVE 8+` e as flags do turno. `check` rola a
  perícia da forma vs o DV do JSON; `attack` (Bone Breaking Strike, Pressure Point Strike, Flying Kick)
  vira um **ataque de Artes Marciais normal** — mesma lista, mesmo botão de dano, mesma regra de SP.
- **Special Moves começam travados e custam 1 ponto** (decisão da mesa de 25/09/2026): os
  pontos vêm da perícia-mãe **Martial Arts** (1 ponto por nível; MA 4 = 4 pontos). O mesmo
  bolso paga **especializações** (custo escalonado: Karate 1 = 1 pt, Karate 2 = 2 pt…) **e**
  desbloqueio de moves. O card mostra o saldo (`nível 4 = 4 pts · 3 em especializações · 1 em
  moves · 0 livre`), badge `Liberável`/`Travado`, botão **🔓 Desbloquear** e **↺ Devolver o
  ponto**. Requisitos originais continuam valendo depois de pago. Testes:
  `tests/martial-arts.test.ts` (pool único, devolução, recusa).

- **Especializações no Card 03**: as 4 formas (Karate, Taekwondo, Judo, Aikido) **saíram da
  lista de perícias** e ganharam um painel próprio no Card 03, entre Ataques e Special Moves,
  com **↑/↓** para subir/reverter nível (custo escalonado em pontos de MA), saldo do bolso e
  aviso de dívida. A perícia-mãe `Martial Arts` continua na lista de perícias (compra com IP)
  e exibe badge `N pontos livres` — ela é a **única fonte** dos pontos: 1 ponto por nível.

**Fora do escopo desta rodada** (detalhado em `PENDENCIAS.md`): Grapple/Grab/Choke/Throw não existem no
app, ROF 2 é informativo (não há economia de ações), o estado do turno é **manual** no painel do Card 03 e
efeitos que miram um alvo (lesões, ablação, Prone) são **relatados**, não aplicados — a ficha do jogador
não tem alvo.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
