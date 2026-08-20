# Design Document Review: Fantasy Writer / 幻想作家 — 产品与架构重构规划

**Document**: `docs/Fantasy-Writer-重构规划与开发方案.md`  
**Baseline verified against**: `D:\Grisia Studio\H Nove List` @ `h-novelist` 1.8.1  
**Reviewer stance**: staff design review; claims checked against source, not taken at face value.

### Summary

**Needs revision.** The document is unusually complete (chapters 1–8 + Key Decisions + PR Plan, Chinese, no application-code implementation) and the core strategy—keep the Next/Electron/IDB stack, make `WritingMode` first-class, isolate via Prompt/Policy/Asset packs, migrate old books to `mode=erotic`—is the right one. It is **not ready for implementation as-is**: the M4 installer/updater contract is internally inconsistent, dual-board can ship while still leaking erotic UI, several isolation surfaces (outline JSON, `optimize_settings`, `learn_style`, `useProjectStore`) are unspecified, and a few architecture claims contradict the actual process model. Fix the blocking issues below before opening PR1.

Verified: package identity, storage keys, prompt stack, updater regex, preload bridge, and most GitHub citations match reality. Dual-mode isolation is sketched at the right five layers but is not yet concrete enough to implement literary prompts/policies without inventing product rules.

---

### Issue 1: `productName` with a space will not produce `Fantasy-Writer-Setup-*.exe`
- **Severity**: critical
- **Section**: 3.1, 3.5 #2/#6/#7, M4 SETUP_RE, 8.5, KD10
- **Description**: The rename plan sets `productName` to `Fantasy Writer` and says `build.win.artifactName` (`${productName}-Setup-${version}`) will “随 productName 变”, while the updater regex and acceptance require `Fantasy-Writer-Setup-x.y.z.exe`.

  Current `package.json`:
  ```
  "artifactName": "${productName}-Setup-${version}.${ext}"
  "productName": "H-NoveList"
  ```
  Today this happens to work because `H-NoveList` has no spaces. After M4 it will emit **`Fantasy Writer-Setup-2.0.0.exe`** (space). That file **does not match** the documented regex:

  ```
  SETUP_RE = /(Fantasy-Writer|H-NoveList)-Setup-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\.exe$/i
  ```

  1.9.0+ clients would then fail to see the 2.0 installer they themselves published. Shortcut/uninstall display names may keep the space; the **artifact filename must not**.
- **Suggestion**: Freeze three independent strings: display `Fantasy Writer` / `幻想作家`; `artifactName: "Fantasy-Writer-Setup-${version}.${ext}"`; regex that accepts only the hyphenated artifact (optionally also the space variant as a defensive extra). Add a M0/M4 unit test for `versionFromSetupName("Fantasy Writer-Setup-2.0.0.exe")` so this cannot regress. Do not derive the setup filename from `productName`.
- **Status**: open

---

### Issue 2: 1.8.1 → 2.0 skip-level upgrade is treated as optional
- **Severity**: critical
- **Section**: 6.5, 8.5, R3, KD10
- **Description**: 1.8.1 `electron/main.cjs` is:

  ```
  SETUP_RE = /H-NoveList-Setup-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\.exe$/i
  ```

  A 1.8.1 client **cannot see** `Fantasy-Writer-Setup-2.0.0.exe`. Section 8.5 says publishing a `H-NoveList-Setup-2.0.0.exe` copy is “则更佳”. Section 6.5 says keep the old filename copy “直到 2.1”. These conflict, and “更佳” is too weak for a P0 upgrade path.

  The *only* way 1.8.1 users reach a dual-regex client is via an intermediate `H-NoveList-Setup-1.9.x.exe`. The doc never states that 1.8.1 → 1.9.x → 2.0 is the **supported** path, nor that skip-level 1.8.1 → 2.0 requires a mandatory dual artifact.
- **Suggestion**: Pick one and write it as a Key Decision:
  1. Supported path is 1.8.1 → ≥1.9.0 → 2.0 (must keep publishing `H-NoveList-Setup-*` through the last 1.9.x); or
  2. 1.8.1 → 2.0 is supported, in which case M4 **must** publish both filenames of the same binary (not “更佳”).
  Put the chosen rule in 8.5 as a checkbox, and in PR12 file list (`scripts/publish-update.mjs` must find **both** names).
- **Status**: open

---

### Issue 3: Server-side `writingMode === project.mode` is not implementable on this architecture
- **Severity**: major
- **Section**: 4.1 sequence diagram, 4.4, T4
- **Description**: The generate sequence does:

  > `API->>API: assert writingMode == project.mode`  
  > M1：若 `writingMode !== project.mode`（若请求带了 projectId）→ 400

  `POST /api/generate` runs in the Next standalone Node process (`src/app/api/generate/route.ts`). Project state lives in **renderer** IndexedDB / localStorage (`src/lib/storage.ts`). The server has no IDB, no `getProject(id)`, and today does not receive a `projectId`. Even if the client sends `projectId`, the server cannot load the canonical `NovelProject`.

  Isolation therefore cannot be a server-side read of stored mode. It is a **client-declared** `writingMode` plus pack assembly plus tests. The diagram overclaims a guarantee the process model cannot provide.
- **Suggestion**: Delete the server-vs-IDB assert. Specify: (1) `postGenerate` / `streamGenerate` require a typed `writingMode` taken only from `project.mode`; (2) server trusts that field and runs the matching PolicyPack on the **request payload** (tags, `eroticLevel`, rewrite mode, extraInstructions); (3) `upsertProject` rejects silent mode changes. If you want a stronger check, send a hash of `{id, mode, updatedAt}`—still client-supplied, so do not market it as authoritative.
- **Status**: open

---

### Issue 4: `WritingMode = "literary"` collides with existing `WritingStyle = "literary"`
- **Severity**: major
- **Section**: 4.2, 4.5, KD3
- **Description**: `src/lib/types.ts` already has:

  ```
  export type WritingStyle = "literary" | "plain" | ...  // 文学细腻
  ```

  `optimize_settings` JSON and `STYLE_LABELS` use the same token. Adding `WritingMode = "literary" | "erotic"` makes `settings.writingStyle === "literary"` and `project.mode === "literary"` mean different products. Leak tests that grep `/literary/`, log lines, and `usage.byMode` (already a **task-type** map) will be unreadable. This is not mentioned in Key Decisions or Open Questions.
- **Suggestion**: Do not reuse `literary` for the board. Prefer `WritingMode = "standard" | "erotic"` or `"general" | "erotic"` with UI copy 「常规 / 色情」. Add a KD. If you keep `literary`, document the disambiguation (`mode` vs `writingStyle`) and ban unprefixed `literary` in logs/tests.
- **Status**: open

---

### Issue 5: PR6 can ship a leaky literary board; incremental release is unsafe
- **Severity**: major
- **Section**: PR Plan PR6–PR7, Flag table `dualBoard`, M1
- **Description**: PR6 turns on `dualBoard` by default and adds home filter + AgeGate + library buckets. PR7 is the first PR that hides 色情尺度 / 行为标签 in `SettingsPanel` / `TagsPanel`. After PR6 merges to main, a user can create a `mode=literary` book and still see:

  - `SettingsPanel` first field 「色情尺度」 (`src/components/SettingsPanel.tsx:80`)
  - `TagsPanel` 「本书强制标签 / 行为标签」
  - `optimize_settings` still requesting `"eroticLevel": 1到5` (`prompts.ts` ~445–448)
  - `useProjectStore` loading the **global** tag library with no mode (`src/hooks/useProjectStore.ts`)

  The plan says every PR is independently shippable. A mid-M1 build would violate Goal 5 (“零色情泄漏”).
- **Suggestion**: Either merge PR6+PR7 as one release slice (flag `dualBoard` stays **false** until PR7 lands), or move Settings/Tags/copy branching into PR6. Add an explicit “do not cut 1.9.5 until PR7 + leak tests are green” gate. List `useProjectStore.ts` on PR6/PR7—today it is the persist + library load path and is **absent from the PR table**.
- **Status**: open

---

### Issue 6: Literary isolation is not specified on the actual prompt/API surfaces
- **Severity**: major
- **Section**: 4.3, 4.5 OutlineChapter, 8.2 banned-substring table, M2
- **Description**: Pack files and a banned-substring fixture are not enough. Current literary-leaking surfaces that the doc does not rewrite:

  1. **Outline JSON schema** still requires `eroticNote` (`prompts.ts` 150–160). Journey A says literary uses `craftNote`; no replacement JSON is given. `parseOutlineJson` will keep an adult field name in every literary outline.
  2. **`formatSettings()`** always emits `色情尺度：n/5` (line 61). 4.9 says “按 mode 分支” but does not give the literary line set.
  3. **`SETTING_SYSTEM`** is “专业的成人向虚构小说设定编辑…内容服务于成人情色/情感小说” (line 265–269). Literary expand/optimize character & background all use this. No literary `setting` system text is provided.
  4. **`buildOptimizeSettingsUserPrompt`** forces `"eroticLevel": 1到5` and `writingStyle` including `"literary"` as a *style*. M2 says literary optimize must not emit `eroticLevel` semantics—no new JSON schema.
  5. **`buildLearnStyleUserPrompt` / `parseLearnedStyleFields`** always require `"erotic"` (lines 605, 631). M2 only says “文学结果 JSON 无必填 erotic”—not the prompt or parser change.
  6. **`polish_chapter_outline`** returns 400 if there are no act tags (`route.ts` 452–461). Literary projects with `allowActTags=false` cannot polish outlines unless this gate is mode-aware. Not in M1/M2 tasks.
  7. **User-prompt builders** (`buildChapterUserPrompt`, continue, rewrite, scene_*) hardcode `情色说明：${chapter.eroticNote}` and `formatTagBlock` “强制行为标签”. Registry `system = CRAFT + pack.system[task]` does not say user prompts are also packed.
  8. **`CRAFT_SYSTEM`** is specified as “成年人同意的虚构…”. That is adult-consent framing and will fail a serious leak fixture even if `ADULT_SYSTEM` is gone.

  An engineer cannot write `literary.ts` from this doc without inventing product policy (see also Open Question 2).
- **Suggestion**: Add an appendix with **verbatim** literary vs erotic strings for: setting/outline/chapter/rewrite/styleLearn system; outline JSON schema; `formatSettings`; `formatTagBlock`; optimize_settings JSON; learn_style JSON; polish gate. State that **user** builders are packed, not only system. Remove “成年人同意” from craft. Resolve Q2 (hard-block sex vs allow extraInstructions) *before* PR5, and put the decision in KD14.
- **Status**: open

---

### Issue 7: Migration of `erotic-novel-studio:*` / `h-novelist:*` is incomplete
- **Severity**: major
- **Section**: 6.1, 3.5 #16–#18, 4.5, KD5
- **Description**: Live keys (verified in `storage.ts` / `theme.ts` / `page.tsx`):

  | Key / store | Migrated in 6.1? |
  |-------------|------------------|
  | `erotic-novel-studio:projects` + IDB `projects` | yes |
  | IDB `auto-backup` | mentioned in M0.4, not in 6.1 algorithm |
  | `erotic-novel-studio:tag-library` / `style-library` | yes → libraries |
  | `erotic-novel-studio:reader-prefs` | **no** |
  | `erotic-novel-studio:usage-stats` | **no** |
  | `erotic-novel-studio:backup-meta` | **no** |
  | `h-novelist:theme` / `h-novelist:app-prefs` | yes |
  | `h-novelist:project-tab:${id}` | checklist only; not in 6.1 |
  | Custom event `h-novelist-theme-change` (`ThemeToggle.tsx`, `AppSettingsMenu.tsx`) | **not on 3.5 list** |
  | `scripts/rename-lock.mjs` hardcodes `h-novelist` | **not on 3.5 list** |
  | Electron dialogs (`未找到安装包…H-NoveList-Setup`, picker title) | **not on 3.5 list** |

  Overview says old keys are “只读兼容后写入”; M0/KD5 say **dual-write** through M3. Those are different contracts.

  `normalizeProject` pseudocode uses `createDefaultVolume()` with no ID rule. Prose says `stableUuid`. `loadProjects()` / `useProjectStore` call `normalizeProject` on every read. A random UUID per call will churn `volumeId` on outline chapters until the first save—and can disagree across tabs.

  There is **no** `importFullBackup` today (`downloadFullBackup` only). M4 “修复工具里导入一次” is new product surface with no design (file format, which keys, idempotency).
- **Suggestion**: Expand 6.1 to a full key matrix (old → new, read order, dual-write, stop-write milestone) including reader-prefs / usage-stats / backup-meta / tab keys / theme event. Define default volume id as deterministic, e.g. `${project.id}:vol:1`. Specify a Repair/Import tool (or reuse `importProjectJson` + a new `importFullBackup`) in PR2 or PR12. Align Overview wording with KD5 (dual-write, not read-only).
- **Status**: open

---

### Issue 8: `AppPreference` ignores the existing `AppPrefs` type; mode writes bypass the real persist hook
- **Severity**: major
- **Section**: 4.2 AppPreference, 6.3 E3, PR2, T4
- **Description**: Live prefs are `AppPrefs` in `src/lib/theme.ts` (`theme`, `autoConsistencyAfterBookJob`) stored at `h-novelist:app-prefs`. The design invents a parallel `AppPreference` with `schemaVersion`, `defaultBoard`, `adultConfirmedAt`, `flags`. No merge/migration of the existing interface is specified. `THEME_BOOT_SCRIPT` inlines the **old** key names at compile time—changing keys without a dual-read boot script will flash the wrong theme.

  Mode immutability is specified as `upsertProject` asserting mode. Actual edits go through `useProjectStore` (debounced `upsertProject(project)`). Any panel that does `setProject({ ...p, mode })` will persist. PR table never lists this hook. `createEmptyProject` is only called from `src/app/page.tsx`; that call site must gain `mode` in PR6, not only the type signature in PR1.
- **Suggestion**: Extend `AppPrefs` rather than adding `AppPreference`. Dual-read theme keys inside `THEME_BOOT_SCRIPT`. Put `useProjectStore.ts` + `page.tsx` create flow on the PR file lists. Implement mode lock in one function used by both `upsertProject` and the hook (compare previous record’s `mode`).
- **Status**: open

---

### Issue 9: PR / milestone order cannot ship 2.0 as specified
- **Severity**: major
- **Section**: PR Plan, M3/M4 tasks, 5 Rollout
- **Description**:
  - M4 task 6 is “导出目录预览按卷分组”. PR12 (2.0 brand) depends only on PR3+PR8, **not** PR9 (volumes UI / export). Either 2.0 includes volumes (PR12 must depend on PR9) or M4 must drop that task.
  - PR11 (workshop) can land before PR9; fine. PR10 depending on PR9 is fine.
  - PR4 promises “行为字节级兼容” for `buildChapterSystemPrompt()`. Introducing `CRAFT_SYSTEM + erotic pack` is almost certainly **not** byte-identical to current `ADULT_SYSTEM`. That bar will fail the PR or force a no-op extract.
  - PR5 says frontend `writingMode` is required, but `src/lib/api.ts` is `Record<string, unknown>`—TypeScript will **not** catch omissions unless the type is actually changed and every call site (28 `postGenerate`/`streamGenerate` uses across 7 files) is updated. PR5 file list omits those panels.
  - `GenerateRequest` introduces `taskMode` while 4.4 also says “不改任务字段名…仍接受 body.mode”. Implementers will not know which field to send.
  - No PR adds CI. Repo has **no** `.github/` workflows. “泄漏测试为发版门禁” has no runner. `npm test` does not exist in `package.json`.
  - Flag module `flags.ts` / `FW_FLAG_*` has no implementation sketch (default merge of env vs `AppPrefs.flags`).
- **Suggestion**: Make PR4 a move-only extract (`ADULT_SYSTEM` text unchanged). Put API call-site typing in PR5. Drop `taskMode` or make it an alias only. Tie PR12 → PR9 if volume export is in 2.0. Add PR0b or extend PR0 with `package.json#scripts.test` + a GitHub Actions (or documented local) gate. Specify flag resolution.
- **Status**: open

---

### Issue 10: Dual-board data isolation still has cross-talk holes
- **Severity**: major
- **Section**: 3.3, 4.3, 4.5, 6.4, R8, KD14
- **Description**: Board vs project mode is the strongest product rule in the doc and is correct. Remaining holes:
  - `project.tags` remains the act-tag field; `settings.genreTags?` is added. Literary TagsPanel is not told which field to bind. A converted book that only hides UI still sends `tags` into `formatTagBlock`.
  - Learned styles are namespaced, but `GenerationSettings.learnedStyleId` / `learnedStyleGuide` snapshot can still inject an erotic `styleGuide` (which includes 情色写法) into a literary generate call. No rule: “apply style only if `style.mode === project.mode`”.
  - Convert wizard “归档标签 / 隐藏 eroticNote” does not strip `learnedStyleGuide` or rewrite `settings.eroticLevel` in the **saved** project. A later leak in `formatSettings` would revive them.
  - `BookGenerationJob.mode` is already `"all" | "missing" | "retry_errors"`. M3 “仅生成本卷” must **not** overload this field; needs `volumeId?: string`.
  - 2.4 says change `LearnedStyle.erotic` to `modeExtras`; 4.5 keeps `erotic?: string`. Pick one.
  - `contentRating` is added and then unused by policy/UI.
- **Suggestion**: One tag field per mode (reuse `project.tags` with pack-defined vocabulary, or split `actTags` / `genreTags` and never send act tags on literary assemble). On generate, ignore learned style when `style.mode !== project.mode`. Conversion must re-snapshot or clear `learnedStyleGuide`. Add `volumeId` on the job. Drop or bind `contentRating`.
- **Status**: open

---

### Issue 11: Internal contradictions on compile isolation and storage contract
- **Severity**: major
- **Section**: 2.5 vs 4.1; Overview vs KD5; 4.6
- **Description**: 2.5: “编译期用动态 import 隔离色情默认资源”. 4.1: static import both packs + ESLint `no-restricted-imports` is enough, dynamic import optional. These lead to different Next bundling and test strategies.

  Overview: “旧键 `erotic-novel-studio:*` 只读兼容后写入 `fantasy-writer:*`”. KD5/M0: dual-write until M4. Rollback text depends on dual-write; the Overview sentence would make M0→1.8.1 rollback lose new edits.

  Dual-write of full `projects` JSON to localStorage is already known to fail (R5, `saveProjects` catch). Rollback “旧键里仍有镜像” is only true for **IDB** dual-write, and only if the dual-write path is actually implemented for the old IDB name—not just LS.
- **Suggestion**: KD: static import + ESLint (simpler, matches Next). Say clearly: M0–M3 dual-write **old IDB + old LS (best effort)**; LS failure does not fail rollback. Update Overview. Add a PR2 test that opening both IDB names after save sees the same project ids.
- **Status**: open

---

### Issue 12: Security/operability claims overreach what the repo has
- **Severity**: major
- **Section**: 4.7 T1/T5, 4.8, 8.2–8.3
- **Description**:
  - T1 “policy 扫描 extraInstructions 中的性+未成年组合” has no algorithm (regex? LLM?). False-positive rate on a literary book about “未成年配角” is a product decision, not an implementation detail.
  - T5 “持续 CSP” — `next.config.ts` and `layout.tsx` have **no** CSP. `dangerouslySetInnerHTML` is used for `THEME_BOOT_SCRIPT`. Claiming “持续 CSP” is false.
  - 8.3 “抓包或日志中该路径 system 不含禁用子串” — 4.8 also says do **not** log full prompts. You cannot accept “check the log” and “never log the prompt”. Need a debug-only, in-memory last-assemble dump behind a flag, or a unit/integration harness that calls `assemble` with the same fixtures as the UI path.
  - AgeGate on M1: after migration `defaultBoard=erotic`, **every existing user** hits 18+ before seeing their books. Not called out in 8.2. Correct, but must be accepted as UX.
- **Suggestion**: Specify the minor-sex detector as a reviewed regex list (and that literary may have non-sexual minors). Remove or add CSP as a real M4 task. Define a `DEBUG_LAST_ASSEMBLE` / test harness for 8.3. Add M1 acceptance: “升级用户确认 18+ 后看见全部旧书；拒绝则只留常规空看板，数据不删”.
- **Status**: open

---

### Issue 13: GitHub research is mostly real; one stack citation is wrong
- **Severity**: minor
- **Section**: 2.1–2.2, References
- **Description**: Spot-checked against GitHub (2026-08-18):

  | Claim | Check |
  |-------|--------|
  | vkbo/novelWriter 3.1k GPLv3 | confirmed |
  | RhythmicWave/NovelForge 1.1k AGPLv3+commercial | confirmed |
  | NousResearch/autonovel 1.5k, no LICENSE file | confirmed (file tree has PIPELINE.md / ANTI-SLOP.md / canon.md, no LICENSE) |
  | Deng-m1/MaliangAINovalWriter 851 Apache-2.0 | confirmed |
  | heider-x/vela 520 GPL-3.0 | confirmed |
  | Nigh/show-me-the-story ~476 MIT | confirmed 476 / MIT |
  | zy-zmc/tianming-novel-ai-writer 397 MIT | confirmed existence/stars; commercial README clause not re-read in full |
  | olivierkes/manuskript 2.4k GPL-3.0+ | confirmed |
  | notnotype/neuro-book 506 AGPL-3.0-only | confirmed |
  | YuanShiJiLoong/author 194 AGPL-3.0 | confirmed |
  | Xiaoyangy/novel-studio 79 Apache-2.0 | confirmed license; **stack is Go, not Python** |
  | raestrada/storycraftr 155 MIT | confirmed |
  | jackaduma/Recurrent-LLM 205 MIT | confirmed |
  | 91zgaoge/StoryMoss ISC | repo exists, ISC badge; exact “52–55” stars not independently counted from sidebar |
  | SillyTavern 32.2k AGPLv3 | confirmed ~32.2k |
  | malfoyslastname/character-card-spec-v2 183 | confirmed |
  | kwaroran/Risuai 1.6k GPL | canonical repo is `kwaroran/RisuAI` (casing); stars/license not re-counted in this review |
  | agnaistic/agnai 771 AGPL; LostRuins/koboldcpp 11.4k AGPL | not re-fetched this pass; both are well-known real repos |

  Stars/licenses do **not** look invented. The novel-studio “Python” cell is a factual error. StoryMoss star range should be a dated exact number. RisuAI slug casing should be exact.
- **Suggestion**: Fix novel-studio stack to Go. Pin star counts with the survey date already given (2026-08-17) and the exact GitHub number. Use `kwaroran/RisuAI`.
- **Status**: open

---

### Issue 14: Brand checklist misses live strings that will keep saying H-NoveList
- **Severity**: minor
- **Section**: 3.5
- **Description**: Verified live strings not on the 25-row checklist:
  - `layout.tsx` **description**: “可调尺度与文风”
  - `electron/main.cjs` dialogs and `title: "选择 H-NoveList 安装包"`
  - `scripts/rename-lock.mjs`
  - `h-novelist-theme-change` event name
  - `UpdatePanel` / `AppSettingsMenu` copy (backup `ens-backup-`, update empty-state)
  - `package.json` `description` is listed; `scripts/publish-update.mjs` comments and `findLatestSetup` still only match `H-NoveList-Setup` (M0 task 5 mentions the script, 3.5 #10 is thin)
  - Web `metadata` vs desktop window title split across M1/M4 is fine, but installer *messages* stay old until M4—call that out so QA does not fail M1 for them
- **Suggestion**: Generate the checklist from a repo-wide search of `H-NoveList|h-novelist|erotic-novel-studio|eroticNovelStudio|ENS_|ens-`. Add a M4 grep acceptance: zero matches except changelog / migration comments / dual-regex.
- **Status**: open

---

### Issue 15: Several implementable constants are still “N” / TBD
- **Severity**: minor
- **Section**: 2.4, M3, 4.5 Character, 7.2
- **Description**: Lore inject “上限 N 条”; no default literary tag list (`DEFAULT_LITERARY_TAG_LIBRARY`); 2.4 promises M3 `@char:@lore:@vol` parser but M3 tasks do not include it; 2.4 `cardV2?` vs 4.5 only `aliases`/`speechStyle`; Q2/Q3/Q4/Q6 remain open and Q2/Q4 affect M1 UX and PR5 prompts. Feasibility is asserted (“6–10 个可审 PR 即可达到 M1”) with no hour/day estimates—M1 is actually PR0–PR7 plus vitest plus every generate call site.
- **Suggestion**: Set N (e.g. 8 entries / 2k chars). Publish a starter literary tag list in the doc. Either add @-mentions to M3 or move them to later. Resolve Q2 and Q4 before PR5/PR6. Add a rough effort column if this is meant to schedule a solo/small team.
- **Status**: open

---

### Issue 16: Electron `userData` after `productName`-only change is assumed, not proven
- **Severity**: minor
- **Section**: 3.5 #11, KD8, KD9, R2
- **Description**: Keeping `package.json.name = h-novelist` and `appId = com.hnovelist.app` is the right instinct. Electron `userData` is `appData + app.getName()`, and electron-builder sometimes exposes `productName` as `app.getName()` in the packaged app. The doc treats “don’t change `name` ⇒ `%APPDATA%\h-novelist` is locked” as certain. A M4 `productName` change alone could still move the directory on some electron-builder versions. `scripts/rename-lock.mjs` exists specifically because this project already fought name drift.
- **Suggestion**: Add a M4 acceptance: after changing only `productName`, log `app.getPath("userData")` and require it still ends in `h-novelist`. If not, ship the config.env copy even when `name` is unchanged. Mention `rename-lock.mjs` in the brand plan.
- **Status**: open

---

### Issue 17: Alternatives are real but incomplete
- **Severity**: minor
- **Section**: 4.6, 2.5
- **Description**: Rejecting NovelForge-shaped rewrite, SillyTavern fork, and Vela/马良 stack is well-argued (AGPL/GPL + existing 1.8.1 desktop/IDB). Missing alternatives that an engineer would expect:
  - `WritingMode` on the **project** vs a per-request “heat” (you rejected chapter heat; good) vs a **third** “mature but not erotic” board (`contentRating` hints at this then goes unused).
  - Keeping one prompt file with `if (mode)` vs three-pack files (you chose packs; say why the extra file split is worth it vs a single `prompts.ts` with mode params—especially given leak tests grep output, not imports).
  - SQLite in M3 for volumes/lore vs staying on one JSON blob (you defer SQLite; 80–120 MB / IDB is plausible, but a 12-version stack + dual IDB write doubles disk).
- **Suggestion**: Add a short “why packs instead of `if (mode)`” and a one-line “no third board in 2.0; `contentRating` is reserved”.
- **Status**: open

---

### Issue 18: Acceptance gaps that are not mechanically testable
- **Severity**: minor
- **Section**: 8.1–8.6
- **Description**: Strong checklists overall. Weak items:
  - 8.1 “1.8.1 功能…手工冒烟通过” — no script / no list of clicks. Given zero current tests, this will be skipped under time pressure.
  - 8.2 “看板切换 < 1 次点击” is tautological for a segmented control.
  - 8.3 erotic path “正文能体现标签（人工抽检）” is not a gate; LLM output is non-deterministic. Keep JSON-field assertions; move “体现” to a rubric, not a ship blocker.
  - 8.4 Lore “keys 命中时出现在 priorBlock” — `buildMemoryPack` / `buildPriorContextBlock` signatures must change; not listed in PR10 beyond “或 priorBlock 拼接”.
  - No acceptance that **erotic** capability did not regress (`more_erotic`, scale 5, `polish_chapter_outline` still requires tags, `SETTING_SYSTEM` adult rules). 8.3 has a partial check; 8.6 does not mention erotic.
- **Suggestion**: Add a 1-page M0/M1 manual script. Add erotic regression bullets to 8.6. Make Lore injection a unit test on a pure function with a fixture project.
- **Status**: open

---

### Issue 19: Small doc/schema nits
- **Severity**: nit
- **Section**: header, 4.5, 2.4
- **Description**: Author is “待填”. `PlotThreadStatus` in repo is `planted | active | resolved`, not the cited `planted→progressing→resolved`. `WritingStyle` already contains “restrained/passionate” which are mildly erotic-coded for a literary board—decide whether those presets stay global. Header `schemaVersion` “现网隐式 1” is correct (no field today).
- **Suggestion**: Fill author. Cite actual enum values. Optionally hide `passionate`/`restrained` on the literary settings UI.
- **Status**: open

---

### Strengths

- **Matches the real 1.8.1 codebase** on the facts that matter: `name/version/appId/productName`, Next 16.2.12 + React 19.2.4 + Electron 37.10.3, IDB `erotic-novel-studio` / store `kv`, LS keys, `h-novelist:theme` / `app-prefs` / `project-tab`, `window.eroticNovelStudio`, `ADULT_SYSTEM` + `SETTING_SYSTEM`, `DEFAULT_TAG_LIBRARY` act tags, `eroticLevel` 1–5, `MAX_CHAPTER_VERSIONS = 12`, `SETUP_RE`, `ENS_PORT`, EPUB author/`ens-` bookId, `ens-backup-` filename, `next.config.ts` `output: "standalone"`, no test runner, no root LICENSE, 16 generate `body.mode` values, MD/TXT/EPUB/DOC export.
- **Product iron rule is right**: `defaultBoard` ≠ `project.mode`; conversion is a wizard; old books → `erotic`. This is the one decision that prevents the whole effort from collapsing into a toggle that corrupts data.
- **Required chapters are all present** (1–8 + Key Decisions + PR Plan), in Chinese, with a borrow/adapt/build table, named alternatives (4.6 / 2.5), a threat table, flags, and a 14-row PR sequence that is *mostly* independently reviewable.
- **GitHub comparison tables are real repos with real licenses**, not invented star counts. Refusal to vendor AGPL/GPL is explicit and correct.
- **Brand landing checklist (3.5)** is the right shape (appId stay, name delayed, dual regex from M0). KD8/KD9/KD10 show the author actually thought about Windows uninstall entries and `%APPDATA%\h-novelist`.
- **Does not weaken 18+**: erotic pack keeps scale, act tags, `more_erotic` / `less_erotic`, `eroticNote`, adult setting expand. Non-goal “不洗白” is unambiguous.
- **Rollback story** (dual-write + no down-migration + backup) is the correct local-first approach, once Issue 7’s IDB-vs-LS gap is fixed.
- **Leak-test-as-release-gate** is the right quality bar for this product; introducing vitest in PR0 is the correct first move.

---

### Implementation readiness (gate)

Do **not** start PR1 until Issues 1, 2, 4, 6 (prompt appendix + Q2), and 7 (key matrix + deterministic volume id) are written into the doc. Issues 3, 5, 8, 9 can be fixed as PR-plan edits in the same revision pass.

**Verdict: needs revision.**
