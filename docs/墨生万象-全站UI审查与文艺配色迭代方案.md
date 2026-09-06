# 墨生万象（Inkborne）· 全站 UI 审查与文艺配色迭代方案

> 状态：**规划文档，本 PR 只含本文件，不改任何业务/UI 源码，不 bump 版本，不改 appId / 安装包名。**
> 基线：`master` @ v2.1.3（`fc8cb72`，含 #104「P0-5 书房与四步独立页导航」：左【书房】｜右 问心·研墨·织卷·落笔 五页平铺）。
> 上位文档：`docs/墨生万象-UI与四步流程重构方案.md`（下称「UI 方案」）、`docs/墨生万象-首页与侧栏收敛方案.md`（「收敛方案」）、`docs/墨生万象-首页侧栏抛光与问心抽屉方案.md`（「抛光方案」）、`docs/墨生万象-书房与四步独立页导航方案.md`（「五页方案」）。与既有文档冲突处，**以本轮用户诉求为准**；**UI 方案 D.1 松绿色板与 H.8 第一条由本文 C 章整体取代**（对照表见 C.4.4）。
> 用户诉求（v2.1.3 试用后）：① 四步入口圆点只在「落笔」被选中时出现；② 全站排列不当 / 体验不好 / 文字重复多余；③ 要高级感、简洁明了；④ **不喜欢深绿主色**，要更有文艺感的配色。
> 约束：不发明新功能流程；G1 写前预检、卷纲锁定、每批 10 章确认、正典 diff 人闸、章审稿等硬闸**语义不变**，只改呈现。

---

## 〇、一段话结论

圆点缺陷不是数据问题，是**两处配色巧合**：完成态圆点 `bg-primary` 与当前页高亮底色 `bg-primary` 同色（BookWorkspaceNav.tsx L65 / L70），所以「问心、研墨、织卷」一旦既是当前页又是已完成，圆点就融进底色；未开始圆点 `bg-background + border-border` 落在 `bg-secondary/50` 上对比度只有 1.07（L66 / L72），肉眼无点。落笔按 `deriveBookStage` 永远不会是 done（book-stage.ts L147、L154），所以只有它的圆点还看得见。修法是把圆点改成 **`currentColor` 驱动的单一 `StageDot`**（实心 = 已成、环 + 朱砂芯 = 进行中、淡环 = 未及），并把「当前页」与「当前阶段」拆成两条独立视觉轴。配色上放弃松绿：推荐默认套 **甲「墨 · 宣 · 朱」**——墨色（近黑、微偏靛）做主色与 CTA，宣纸做底，朱砂只做 3px 印芯 / 24px 短线 / 章号，藤黄做「黄签」待办色，绛红只在危险区；深色模式即「白文印」反相（宣白 CTA 在墨夜上）。备选套 **乙「黛青 · 藤黄」** 保留一个有彩主色（黛青）给偏好彩色 CTA 的产品方。全站 33 个文件 240 余处 Tailwind 调色板硬编码（emerald / amber / blue）与 5 处 `oklch(...)` 字面量是「换了主色仍然像仪表盘」的真正原因，本文用 5 个语义 token 归零。信息架构层面：书内 chrome 上提到 App 层一条固定栏（五页同宽同位）、系统页面包屑全删、七种 h1 字号归一、主 CTA 六种尺寸归一、问心页去掉「落墨 / 织卷·规划 / 审计 / 市场雷达」芯片、首页与落笔的错标菜单与重复状态词修正。建议三个 PR：**P0-6 配色 + 圆点 + 文案**、**P0-7 chrome 上提 + 页头/对话框收口**、**P1-5 深页排版**，均不 bump。

---

## 术语与记号（编码代理必读）

| 记号 | 含义 |
|---|---|
| **入口** | 书内 chrome 上的五个按钮：【书房】+ 问心 / 研墨 / 织卷 / 落笔 |
| **页面轴** | 「我现在在哪一页」：五入口恰有一个是当前页（五页方案 B.2 不变） |
| **阶段轴** | 「这本书写到哪一步」：`GET /books/:id/stage` 的 `steps[id] ∈ done / current / todo`（`blocked` 类型存在但 `deriveBookStage` 目前不输出） |
| **StageDot** | 本文新增的唯一阶段圆点组件（C.8），替代 chrome 圆点、书房「四步一览」✓●○、研墨目录 ✓/!、织卷章行 ●/○、短篇无点进程条 |
| **甲 / 乙** | 两套色板：甲「墨 · 宣 · 朱」（推荐默认）、乙「黛青 · 藤黄」（备选） |
| `--seal` / `--mark` / `--ok` | 新增语义 token：朱砂（印）/ 藤黄（黄签、待办）/ 竹青（仅 toast 图标）；`--accent` 回归 shadcn 原义 = 悬停底色 |
| 文件行号 | 均指 v2.1.3 `packages/studio/src` 下文件 |

---

## A. 问题清单（按页面，带源码证据）

编号：G 全局、N 书内 chrome/圆点、S 侧栏、H 首页、P 资料设置、T 书房、Q 问心、Y 研墨、W 织卷、X 落笔、C 章页、L 实时动态/守护、M 项目设置/模型配置、E 空态与 CTA、D 对话框/抽屉、K 短篇。每条：证据 → 影响 → 处置去向。

### A0 全局

| # | 现状（证据） | 影响 | 处置 |
|---|---|---|---|
| G01 | `--accent` 被当「金线强调色」定义（index.css L102 / L134，`.literary-kicker::before` L220），但 shadcn 原语把 `--accent` 当**悬停底色**：dropdown-menu.tsx L89 / L114 / L160 `focus:bg-accent`，select.tsx 同 | 全站下拉菜单项一悬停就变成**整块金色底**；UI 方案 D.1 把 token 语义写错了 | C.4：`--accent` 回归悬停底，强调色另立 `--seal` |
| G02 | 绕过 token 的硬编码色：头像底 `bg-[oklch(0.36_0.07_160)] text-[oklch(0.70_0.09_82)]` ×3（Sidebar.tsx L293、Dashboard.tsx L200、AuthorPage.tsx L93）；金线 `bg-[oklch(0.70_0.09_82_/_0.45)]`（Dashboard L251）；圆点金环 `shadow-[0_0_0_2px_oklch(0.70_0.09_82)]`（BookWorkspaceNav L63）；Tailwind 调色板 `emerald / amber / blue / …` 出现在 33 个文件（`rg` 计数：BookDetail 16、TruthProposalCard 4、LogViewer 2、ServiceListPage 6、ProjectSettings 6、use-colors.ts 6、SerialCockpitStrip 1、ChapterReader 4、ChatPage 4 …） | 只改 `index.css` 主色，这些地方仍是深绿头像、金线、翠绿「已连接」、琥珀「待审」、蓝色「已导入」——正是「换了色仍像仪表盘」的根源 | C.4 五个语义 token；验收 `rg` 归零 |
| G03 | 页标题七种字号：40px（研墨 BookGround L193、短篇 ShortReader L152）、36px（书房 BookStudy L240、落笔 BookDetail L362）、32px（织卷 OutlineWorkspace L342）、30px（资料 AuthorPage L90、实时动态 LogViewer L63、守护 DaemonControl L64、项目设置 ProjectSettings L208、检查更新 CheckUpdate L120、题材 GenreManager L326、真相 TruthFiles L115）、24px（模型配置 ServiceListPage L346）、24px 无衬线粗体（数据分析 Analytics L55）、5xl 斜体（章页 ChapterReader L263） | 页与页之间「跳字号」，是「排列不当」的第一观感 | C.5 一套层级 |
| G04 | 面包屑双轨：书内五页已删（P0-5），系统页仍有「首页 / 页名」：AuthorPage L84–88、LogViewer L56–60、DaemonControl L57–61、ProjectSettings L201–205、CheckUpdate L113–117、ServiceListPage L335–345（还是一颗带边框按钮，第三种样式）、ChapterReader L143–162（显示 `bookId` slug 而非书名）。顶栏已有「⌂ 首页」（App.tsx L211–217） | 系统页「首页」两次、页名两次 | B.3 全删；D.8 统一页头 |
| G05 | 书内 chrome 容器宽度不同：书房 / 研墨 / 落笔在 `max-w-4xl`（App.tsx L281 / L298 / L308），织卷在 `max-w-[1400px]`（L303），问心是满宽 `px-6 py-3 border-b`（BookAskPage L43–44） | 同一行【书房】与四入口在五页间**左右位移**，问心页多一条分隔线 | D.1 上提到 App 层一条固定栏 |
| G06 | 同一「阶段」三套符号：chrome 圆点（BookWorkspaceNav L153）、书房「四步一览」✓●○（BookStudy L438–453）、研墨目录 ✓ / !（BookGround L212，`!` 用 `text-accent` 金色，对比度 2.5）、织卷章行 ●/○（OutlineWorkspace L716）、短篇进程条只有文字无点（ShortReader L104–118） | 用户学不会一套符号 | C.8 `StageDot` |
| G07 | 「仪表盘感」残留：全大写字距标签（Sidebar L701 / L713 分组标题 16px 粗体、DaemonControl L66 / L92、ServiceListPage L436 / L460、BookDetail L536 状态胶囊、ChapterReader L266、use-colors.ts `tableHeader`）；`shadow-xl / 2xl`（BookDetail L508、ChapterReader L252、ConfirmDialog L50）；正文编辑用 `font-mono`（BookGround L254、DaemonControl L96）；原生 `window.prompt / confirm`（BookDetail L203 / L226 / L249 / L281 / L551、ServiceDetailPage L197、ChapterWorkspacePanel L120 / L133） | UI 方案 D.4 禁用清单只在 5 个文件里被测试约束（p2-ask-ground.test.ts L74–83），其余漏网 | C.7 / C.9；E.4 扩测试范围 |
| G08 | index.css L162–173 把 `.text-xs / .text-sm / .text-[11px] …` 全局放大一档 | 源码写 11px 实际渲染 12px；任何人按类名推算尺寸必错，也是各页字号「差一点」的暗因 | C.5 直接写真实尺寸；P1 删除这段覆盖 |
| G09 | 图标：侧栏「模型配置」「项目设置」同用 `Settings`（Sidebar L536 / L543）；问心快捷芯片落墨用 `Zap`（QuickActions L25，UI 方案 D.3 规定 Feather）；`hover:scale-110`（L75） | 图标不承担区分，动效违反 D.3 | C.9 |
| G10 | 主 CTA 六种尺寸：书房 `px-5 py-3 text-sm font-bold rounded-xl`（BookStudy L296）、织卷 `px-3 py-2 text-xs font-bold rounded-lg`（OutlineWorkspace L356）、研墨 `px-5 py-2.5 text-sm font-medium rounded-xl`（BookGround L397）、落笔 `px-5 py-2.5 text-sm font-bold`（BookDetail L429）、空态 `px-4 py-2.5 text-sm font-medium`（LiteraryEmpty L32）、资料 `px-5 py-2.5 rounded-lg`（AuthorPage L156）；重命名对话框保存键 `bg-foreground text-background`（Sidebar L635）是第七种 | 主按钮不是一个「物」 | C.7 按钮三级 |
| G11 | 语言判断 hack `isZh = t("nav.connected") === "已连接"`（Dashboard L61、LogViewer L35）与 `useI18n().lang` 双轨 | 改文案会误伤语言判断 | P1 顺手：改读 `lang` |
| G12 | 品牌 SVG `<title>???? / Inkborne</title>` 乱码（public/inkborne-mark.svg L2） | 无障碍朗读为问号 | P0 顺手修 |

### A1 书内 chrome 与圆点（用户点名问题 1 的根因）

| # | 现状（证据） | 说明 |
|---|---|---|
| **N01 根因一：完成态圆点与当前页底色同色** | `stepDotClass("done") = "border-primary bg-primary"`（BookWorkspaceNav.tsx L65）；当前页按钮 `currentPageClass(true) = "bg-primary text-primary-foreground"`（L70–71） | 某步既是当前页又是 done → 深绿点画在深绿底上，对比度 1.0，**消失**。按 `deriveBookStage`：已建书的问心恒 done（book-stage.ts L101–105、L127）；定稿后研墨 done；锁卷且有细纲后织卷 done；**落笔只有 `status === "completed"` 才 done**（L147、L154），否则 current / todo，用 `bg-background`（L66）在深绿底上是浅点 → 可见。**这就是「只有落笔选中时有圆点」。** |
| **N02 根因二：未开始圆点在非当前页上不可见** | todo = `border-border bg-background`（L66）；非当前页按钮底 `bg-secondary/50`（L72） | 纸色点落在浅纸影上：填色对比 1.07、边线 1.29（C.2 附计算）→ 肉眼无点。非当前页里只有 done（深绿实心）与 current（金环）可见，所以四个入口看起来「时有时无」 |
| N03 根因三：阶段数据拉两次、先灰后亮 | nav 自拉 `/stage`（L97–113），页面又各拉一次（BookStudy L131、BookGround L65、OutlineWorkspace L134、BookDetail L163）；nav 未返回前用 `current === step.id ? "current" : "todo"` 兜底（L140）；`useApi` 无缓存（use-api.ts L196 起） | 进页瞬间四点先全灰再刷新，加重「不一致」观感 |
| N04 两条轴一种语言 | 「当前页」= 填底；「当前阶段」= 金环；两者都叫 current | 用户分不清「我在哪一页」和「书写到哪一步」 |
| N05 入口排版 | `text-xs font-bold`（L132 / L150）、`gap-1`、连接线 `h-px w-3`（L144） | 13px 粗体胶囊像标签不像导航；连接线太短，四步「串」不起来 |
| N06 硬编码金环 | L63 `shadow-[0_0_0_2px_oklch(0.70_0.09_82)]` | 换色板即失效 |

### A2 全局侧栏（`components/Sidebar.tsx`）

| # | 现状 | 处置 |
|---|---|---|
| S01 | 分组标题与条目同为 16px（SectionHeader L701 vs CreateItem L736），标题还是粗体 + 全大写字距 | 标题降为 13px 中等字重 kicker，条目 14px（C.5） |
| S02 | 头像底硬编码松绿 + 金（L293） | 改 `bg-primary text-primary-foreground`（甲：墨底宣白字；乙：黛底纸白字） |
| S03 | 「模型配置」「项目设置」同一 `Settings` 图标（L536 / L543） | 模型配置 → `Cpu`（或 `Plug`）；项目设置保留 `Settings` |
| S04 | 「工具列表」（use-i18n L173）多「列表」；「系统设置」六格里「资料设置 / 项目设置 / 模型配置」——「设置」三连 | B.1 |
| S05 | 会话相对时间 `text-[11px] text-muted-foreground/40`（L380）对比度 < 3 | 改 12px `muted-foreground/70` |
| S06 | 品牌行（L580–588）与作者头（L285–301） | **保留** |

### A3 首页与封面卡（`pages/Dashboard.tsx`）

| # | 现状 | 处置 |
|---|---|---|
| H01 | 头像底 / 金线硬编码（L200 / L251） | token 化：金线 → `--seal` 24px 短线或 `--border` 全宽发丝线（D.2） |
| H02 | 卡菜单「书籍设置」调 `nav.toBookSettings`（L424–427），而 `toBookSettings` 是落笔页别名（App.tsx L113） | **文不对题**。菜单项改名「落笔」，或改为打开 `BookSettingsDrawer`（B.2） |
| H03 | 长短篇菜单不对称：长篇「连载书房 / 导出原文 / 书籍设置 / 移入暂停 / 删除书籍」；短篇「写下一章（`dash.writeNext`，L487）/ 书籍设置 / 统计 / 导出原文 / 删除书籍」 | 两卡同构（B.2）；短篇首项用闲置的 `short.continue`「继续创作」 |
| H04 | 「暂停 · 完结」折叠标题 `text-[16px] font-bold tracking-[0.1em]`（L298） | 13px kicker 样式 |
| H05 | 只有归档书时显示斜体「书架还空着」（L288，`dash.noBooks`） | 书架不空。改「没有在写的书」（B.1） |
| H06 | 模型未配提示三段拼接 + 「·」（L181–190） | 一句话：「还没有配置 AI 模型，去配置 →」 |
| H07 | 封面卡三行 12px + 10px 类型框（CoverMeta L534–546） | 为用户 R5 指定，**保留结构**，只按 C.5 调字号（书名 14、其余 12） |

### A4 资料设置（`pages/AuthorPage.tsx`）

| # | 现状 | 处置 |
|---|---|---|
| P01 | 面包屑「首页 / 资料设置」+ h1「资料设置」（L84–90） | 删面包屑（G04） |
| P02 | 头像底硬编码（L93） | token |
| P03 | 头像行「更换头像」「移除」两颗按钮并排（L98–107），与输入区、保存散排无节律 | 头像悬停出现 ✎ 菜单（更换 / 移除），页面只剩两个输入 + 保存（D.8） |

### A5 书房总览（`pages/BookStudy.tsx`）

| # | 现状 | 处置 |
|---|---|---|
| T01 | 页头「题材 · 始于 · 已写 0 / 260 章 · 0 字」（L241–250）与「四步一览」织卷行「细纲 38/260」、落笔行「0 章」（L445–456）重复 | 页头只留「题材 · 始于 · N 万字」；章数只在四步一览（B.1） |
| T02 | 四步一览用 ✓●○（L438–453）；问心行附「题材」（L439） | `StageDot`；问心行改附「一句话故事」（故事卡 `one_line`），研墨行附「N 位人物 · 待定 N」 |
| T03 | 待办三处：「等你过目」列表（L385–401，「正典变更」项无点击）→ 其下 `TruthProposalCard` 列表（L403–415）→ 再下红卡「第 N 章有须处理的问题」（L417–432） | 只留「等你过目」一个聚合区：正典变更项点击展开卡片；删红卡（与列表首项重复）（D.7） |
| T04 | 被闸原因整列 `text-destructive`（L306） | 「还没有细纲」是正常前置条件不是错误。改 muted 正文 + 朱砂项目符（C.4.3） |
| T05 | 错误态 `Error: {error}`（L190）英文原样（BookAskPage L39、OutlineWorkspace L329、BookDetail L336 同） | 统一中文错误块（复用 `LiteraryEmpty` 形态：一句话 + 「重试」） |
| T06 | 「今日一笔」卡 `bg-primary/[0.04] border-primary/20`（L270）淡绿底盒 | 改「朱丝栏」卡：纸底 + 左侧 2px 朱砂竖线，不填色（D.7） |
| T07 | nav 不传 `stage`（L237） | N03 |
| T08 | 写作中：横幅（L461–468）+ 按钮 spinner（L299–300）双重表示 | 只留按钮内「墨点呼吸」，横幅只在出错时出现 |

### A6 问心页（`pages/BookAskPage.tsx` + `pages/ChatPage.tsx` + `components/AskStoryRail.tsx`）

| # | 现状 | 处置 |
|---|---|---|
| **Q01** | 快捷芯片「落墨 · 写下一章 / 织卷 · 规划 / 审计 / 导出 / 市场雷达」在问心页出现（ChatPage L1024–1034 只判 `hasBook`；QuickActions.tsx L23–60） | 与 UI 方案 A01 / A02 直接冲突：问心页重新长出落墨与「织卷·规划」入口，「审计 / 市场雷达」与问心无关。**mode === "book" 时不渲染 `QuickActions`**，只留「重新推敲前提」芯片（B.2）；`QuickActions` 组件保留给互动影游等其他模式 |
| Q02 | 输入框占位「输入指令...」（L1201） | 「和它聊聊这本书……」；建书前「告诉我你想写什么——题材、世界、主角、冲突」 |
| Q03 | 右栏宽度：建书前 `w-[min(22rem,38%)]`（AskCreateRail L96），建书后 `w-80`（AskStoryRail L71） | 统一 `w-[min(22rem,38%)]` |
| Q04 | chrome 行自带满宽 `border-b`（BookAskPage L43） | 随 D.1 消失 |
| Q05 | 「编辑书名」按钮在卡底（AskStoryCard L80–88），输入框却弹在栏顶（AskStoryRail L74–90） | 就地编辑：点书名字段变输入框，回车保存 |

### A7 研墨（`pages/BookGround.tsx`）

| # | 现状 | 处置 |
|---|---|---|
| **Y01** | 定稿后无「已定稿」状态：`confirmed` 只用于保存提示（L119–121），主按钮仍是「研墨定稿」（L392–400） | 页头显示「已定稿 · 9 月 6 日」；主按钮变次级「重新定稿」（语义同 `POST /ground/confirm`，硬闸不变）（D.4） |
| Y02 | 目录 ✓ / !（L212），`!` 金色对比度 2.5 | `StageDot`：满足 = 实心，缺项 = 朱砂环 |
| Y03 | 「查看原始文件」（L215–221）与 chrome ⋯「真相文件」（BookWorkspaceNav L178–181）同目标 | 删目录里那条 |
| Y04 | 副句「把世界与人磨实。定稿后才能织卷；之后仍可改，但会提示影响。」（L195）后半句与确认框（L406）重复 | 「把世界与人磨实，定稿后开始织卷。」 |
| Y05 | 人物编辑器 `font-mono`（L254）；「保存人物 / 保存 / 添加」三种保存词（L262 / L350 / L301） | 全部衬线正文编辑器；按钮统一「保存」 |
| Y06 | 「结局与伏笔」把 `story_frame` 终局段与 `pending_hooks.md` 用 `\n---\n` 拼进一个 textarea（L321–329） | 拆成两个带标题的编辑区「终局」「伏笔清单」，各存各文件（文件与 API 不变） |

### A8 织卷（`pages/OutlineWorkspace.tsx`）

| # | 现状 | 处置 |
|---|---|---|
| W01 | h1 32px（L342）；主 CTA `text-xs font-bold`（L356）是全站最小的主按钮 | C.5 / C.7 |
| W02 | 树顶一整行只放一个 ⋯（L446–462）；同页 chrome 还有一个 ⋯ | 树的「新增一章 / 整理卷纲」改为树底两条文字链接；删该行 |
| W03 | 章行 ●/○（L716）；筛选胶囊 `text-xs font-bold`（L412） | `StageDot`（已写 = 实心）；胶囊 13px 中等 |
| W04 | 空态「还没有章级大纲。先用右上角织卷锁定卷纲，再每次只织 10 章（走确认闸）。」（L440），且不是 `LiteraryEmpty` | 「还没有卷纲」/「先定卷，再每次排十章」/ 按钮即主 CTA（B.1） |
| W05 | 「短题 ≤12」标签（L552） | 右下角计数「4 / 12」（与资料设置一致） |
| W06 | 页宽 1400 与他页 896 | 随 D.1 解决：chrome 不再在页内，织卷正文可保留宽版 |

### A9 落笔（`pages/BookDetail.tsx` + `components/SerialCockpitStrip.tsx`）

| # | 现状 | 处置 |
|---|---|---|
| X01 | 状态胶囊 Tailwind 调色板 + `uppercase`（L77–83、L536）；「待审核」（use-i18n L449）vs 书房「待审稿」（BookStudy L63）；「审计失败」（L454）vs「须处理」；「审计」（L241） | B.4 状态词统一；C.4 语义色 |
| X02 | 行内操作最多 7 个：通过 / 回滚 / 审校 / 重写 / 同步 / 修复 / 修订▾（L543–653），`<select>` 当按钮（L637–653） | 行内只留「通过」+「⋯」（B.2） |
| X03 | `window.prompt` ×5（L203 / L226 / L249 / L281 / L551） | `ConfirmDialog` 已支持 `children`（ConfirmDialog.tsx L12 / L72）：放一个输入框即可 |
| X04 | 页头元信息图标 + 胶囊（L367–377）与书房纯文本风格不一；`EN` 徽标（L364） | 「题材 · N 章 · N 万字」纯文本；删 EN |
| X05 | `SerialCockpitStrip`「下一章 13 · 可以落墨」（L61–66）与主按钮可用态重复；「去排纲」（L91）旧词；伏笔原样 `H003`（L81）；amber（L79） | 条改为「下一章 · 第 13 章 雪夜定誓」一行 + 被闸原因；「去织卷」；`stripEngineTokens`；`--mark` |
| X06 | 导出下拉里塞 `<select>`（L388–396） | 三个单选行 TXT / MD / EPUB + 勾选「仅已通过」+「下载」「保存到项目」 |
| X07 | 表格 `shadow-xl shadow-primary/5`（L508）、逐行 `fade-in stagger`（L522–524）、表头 11px 粗体（L513–517）、章号 `01` 等宽补零（L525） | 去阴影 / 去逐行动画；表头 13px；章号「1」 |
| X08 | 「等你过目」审稿队列 amber 盒（L463）；「全部通过」翠绿字（L467） | `--mark-soft` 底；「全部通过」次级按钮 |
| X09 | 空态在表格卡内（L663–684） | `LiteraryEmpty` |

### A10 章页（`pages/ChapterReader.tsx`，书内但不在五页）

| # | 现状 | 处置 |
|---|---|---|
| C01 | 面包屑「首页 / `zuici` / #3」显示 slug（L143–162） | 随 D.1：章页也挂书内 chrome（落笔为当前页），面包屑删 |
| C02 | 一行 8 颗按钮：返回列表 / 编辑 / Packet / 通过 / 回滚本章（编辑时 + 保存 / 预览）（L164–223） | 「编辑」「通过」+「⋯」（回滚本章 / 上下文包 / 删除本章）；「Packet」→「上下文包」 |
| C03 | 「带病通过原因（critical 覆盖，可选）」输入框常驻（L226–234） | 只在通过被闸时以对话框出现（同 X03） |
| C04 | h1 `italic`（L263）：中文伪斜体；「书稿页 · 03」全大写字距（L266）；`shadow-2xl`（L252） | 正体；kicker「第三章」；去阴影 |
| C05 | 通过 / 回滚按钮 emerald / destructive 填色（L210 / L217） | 「通过」= 主按钮（墨），「回滚」进 ⋯ |

### A11 实时动态 / 守护进程（`pages/LogViewer.tsx` / `pages/DaemonControl.tsx`）

| # | 现状 | 处置 |
|---|---|---|
| L01 | 两页面包屑 + h1 双写（G04） | 删面包屑 |
| L02 | 实时动态：状态句 `text-emerald-500`（L65）；「原始日志」常驻第二卡（L102–133）；页脚「当前展示最近动态与原始日志。」（L135–137）；`level` 全大写 | 状态句 muted；「原始日志」默认折叠为页底一行「排障：原始日志 ▸」（收敛方案 E.2 原意）；删页脚句 |
| L03 | 守护进程 h1「守护进程控制」（use-i18n L419）vs 侧栏「守护进程」 | 统一「守护进程」 |
| L04 | 「运行中 / 已停止」`uppercase tracking-wide`（L66）；事件原样 `daemon:xxx › {json}`（L96–106，`font-mono`） | 状态句普通字重；事件走 `formatActivityEvent` 中文句式（已有函数，`lib/activity-copy.ts`） |
| L05 | 语义：默认关、调度器不改（收敛方案 E 章产品决定） | **不改** |

### A12 项目设置 / 模型配置（`pages/ProjectSettings.tsx` / `pages/ServiceListPage.tsx`）

| # | 现状 | 处置 |
|---|---|---|
| M01 | 模型配置页 h1「服务商管理」（ServiceListPage L346）vs 侧栏「模型配置」（use-i18n L40） | 统一「模型配置」；「服务商」保留为页内分组词 |
| M02 | 模型配置容器 `max-w-2xl`（L334），其他系统页 `max-w-4xl` | 统一 |
| M03 | 项目设置 h1 带 28px 图标（L208–211）、检查更新同（CheckUpdate L120–123）——全站只有这两页 h1 带图标 | 删图标 |
| M04 | 项目设置副句「集中管理写作运行时的项目级开关，不替代模型服务商配置。」（use-i18n L369） | 「项目级选项。模型与密钥在「模型配置」。」 |
| M05 | 分组标题全大写字距（ServiceListPage L436 / L460）；已连接翠绿点与翠绿边（L35 / L42）；通知 emerald / amber（ProjectSettings L222 / L271） | kicker；`--ok` 只用于 6px 点，边框统一 `--border` |

### A13 空态与主 CTA

| # | 现状 | 处置 |
|---|---|---|
| E01 | `LiteraryEmpty`（title 28 衬线 + 一句 + 一键）只在首页 / 问心右栏 / 研墨人物 / 短篇使用；织卷空态是段落（OutlineWorkspace L438–442）、落笔空态嵌表格（BookDetail L663–684）、实时动态「暂无动态 / 引擎空闲」斜体（LogViewer L95 / L129）、真相文件「暂无文件」（use-i18n L406） | 全部走 `LiteraryEmpty`；文案表 B.1；禁「暂无」「斜体」 |
| E02 | 主 CTA 六种尺寸（G10） | C.7 |
| E03 | 书房被闸时「今日一笔」卡内既无按钮也无明确下一步，只有红字原因（T04） | 卡底固定一颗次级按钮「去织卷 / 去审稿」（取第一条原因的 `jumpTo`） |
| E04 | 首页空态卡带边框，其他页空态无边框 | 统一：无边框、左对齐、上下 48px 留白 |

### A14 对话框 / 抽屉残留

| # | 现状 | 处置 |
|---|---|---|
| D01 | `ConfirmDialog`：`shadow-2xl shadow-primary/10`（L50）、`chat-msg-assistant` 侧滑动画（L50）、右上 X + 底部「取消」双取消（L61–66 / L77–82）、危险键 `text-white`（L86） | 去阴影与侧滑（只 fade 150ms）；删 X；`text-destructive-foreground` |
| D02 | 重命名对话框自绘（Sidebar L590–641）：保存键 `bg-foreground text-background`、字号 `text-xs` | 复用 `ConfirmDialog` + `children` 输入框 |
| D03 | `BookSettingsDrawer` / `BookToolsDrawer` 各自 `fixed inset-0 z-[80] bg-black/30`（L86 / L44），无 ESC、无焦点管理、「关闭」文字按钮（`ConfirmDialog` 是 X 图标） | 抽出 `Drawer` 原语：ESC 关闭、遮罩 `bg-foreground/20`（随主题）、右上 X、宽 420、标题 18 衬线 |
| D04 | `BookBusyCard` `bg-black/45` 全屏遮罩（L31） | 遮罩 token 化 |
| D05 | 短篇页内红色「删除短篇」（ShortReader L186–196） | 违反「危险只在抽屉 / 设置」：移入 `ShortSettings` 危险区；`p2-ask-ground.test.ts` L93 断言随迁 |
| D06 | 下拉菜单项悬停金色底（G01） | `--accent` 回归 |

### A15 短篇创作书房（`pages/ShortReader.tsx`，五页方案 C.4 尚未落地）

K01 「‹ 返回列表」（L96–103）；K02 三步进程条只有文字、无 `StageDot`、不可点（L104–118）；K03 页内危险区（D05）。→ 按五页方案 C.4：左【书房】｜右 问心 · 织卷 · 落笔 ·⋯，`StageDot` 同规则；危险区进短篇设置。

---

## B. 信息架构与文案删减表

### B.1 文字重复 / 多余 / 工程语（位置 → 现文案 → 新文案）

| # | 位置（key / 文件） | 现 | 新 | 理由 |
|---|---|---|---|---|
| 1 | `nav.tools`（use-i18n L173） | 工具列表 | **工具** | 「列表」多余 |
| 2 | `nav.system`（L169） | 系统设置 | **设置** | 下属项已含「设置」二字 ×2 |
| 3 | `nav.createNovel` / `nav.createShort`（L27–28） | 长篇小说 / 短篇小说 | **长篇 / 短篇** | 分组标题「开始创作」已给语境（可选） |
| 4 | 侧栏 SectionHeader（Sidebar L701 / L713） | 16px 粗体全大写 | 13px 中等 kicker，无大写 | S01 |
| 5 | `dash.noBooks`（L47，Dashboard L288 用法） | 书架还空着 | **没有在写的书** | 归档书存在时不「空」；首页全空态仍用 `shelfEmptyCopy` |
| 6 | `home.noModel` + `home.noModelHint` + `home.goConfigure`（Dashboard L181–190） | 还没有配置 AI 模型 · 配好一个服务商才能开始创作 去配置 | **还没有配置 AI 模型，去配置 →** | 三段合一 |
| 7 | 首页卡菜单 `cockpit.title` | 连载书房 | **打开书房** | 菜单是动作 |
| 8 | 首页卡菜单 `book.export`（L242） | 导出原文 | **导出** | 「原文」多余（落笔页导出下拉里再分格式） |
| 9 | 首页卡菜单 `home.pause` | 移入暂停 | **暂停** | — |
| 10 | 首页卡菜单 `book.deleteBook`（菜单内） | 删除书籍 | **删除**（对话框标题仍「删除《书名》」） | 菜单已在书卡上 |
| 11 | 首页短篇卡首项（Dashboard L487） | 写下一章 | **继续创作**（`short.continue`，已存在未用） | 短篇无「下一章」概念 |
| 12 | 书房页头（BookStudy L241–250） | 题材 · 始于 · 已写 0 / 260 章 · 0 字 | **题材 · 始于 2026-09-01 · 4.8 万字** | 章数移到四步一览落笔行 |
| 13 | 书房四步一览问心行（L439） | 问心 ✓ 古风群像 | **问心 ● 「一句话故事」** | 题材不是问心的产物 |
| 14 | 书房四步一览研墨行（L442） | 研墨 ✓ | **研墨 ● 8 位人物 · 待定 0** / **已定稿** | 现为空 |
| 15 | 书房「等你过目」正典项（L215–217） | 正典变更 2 处（不可点） | **正典变更 2 处 → 查看**（展开卡片） | T03 |
| 16 | 书房红卡（L417–432） | 第 N 章有须处理的问题 / 去审稿 | **删除**（列表首项已是「第 N 章 须处理 → 去看」） | 重复 |
| 17 | 书房被闸原因（L306） | 红字 | muted 正文 + 朱砂项目符 + 卡底一颗「去织卷」 | T04 / E03 |
| 18 | 问心输入占位（ChatPage L1201） | 输入指令... | **和它聊聊这本书……** | 工程语 |
| 19 | 问心快捷芯片（QuickActions） | 落墨 · 写下一章 / 织卷 · 规划 / 审计 / 导出 / 市场雷达 | **删除**（mode="book" 不渲染） | Q01 |
| 20 | 研墨副句（BookGround L195） | 把世界与人磨实。定稿后才能织卷；之后仍可改，但会提示影响。 | **把世界与人磨实，定稿后开始织卷。** | 与确认框重复 |
| 21 | 研墨目录（L215–221） | 查看原始文件 | **删除**（⋯ 有「真相文件」） | Y03 |
| 22 | 研墨按钮（L262 / L301 / L350） | 保存人物 / 添加 / 保存 | **保存 / 添加 / 保存** → 统一「保存」，待定项回车即加 | Y05 |
| 23 | 研墨定稿后（L392–400） | 研墨定稿 | 页头「**已定稿 · 9 月 6 日**」，按钮降为次级「重新定稿」 | Y01 |
| 24 | 织卷空态（OutlineWorkspace L440） | 还没有章级大纲。先用右上角织卷锁定卷纲，再每次只织 10 章（走确认闸）。 | **还没有卷纲** / **先定卷，再每次排十章** / 主 CTA | 工程语「确认闸」 |
| 25 | 织卷短题标签（L552） | 短题 ≤12 | **短题** + 右下计数 `4 / 12` | — |
| 26 | 织卷详情空（L523） | 选中一章或一卷 | **点左侧任意一章** | — |
| 27 | 落笔页头（BookDetail L367–377） | [题材胶囊] 📄 12 章 🪶 48,000 字 | **古风群像 · 12 章 · 4.8 万字** | 与书房同款 |
| 28 | 落笔 `EN` 徽标（L364） | EN | **删除** | 语言在项目设置 |
| 29 | `SerialCockpitStrip`（L61–66） | 下一章 13 · 可以落墨 / 落墨未就绪 | **下一章 · 第 13 章 雪夜定誓**（可写时不加状态词；被闸时其下列原因） | 与主按钮态重复 |
| 30 | `SerialCockpitStrip`（L91） | 去排纲 | **去织卷** | 旧词 |
| 31 | 落笔表头 `book.manuscriptTitle` / `book.curate`（L514 / L518） | 章节标题 / 操作 | **章题** / （空） | — |
| 32 | 落笔状态 `chapter.readyForReview`（L449） | 待审核 | **待审稿** | 与书房一致 |
| 33 | `chapter.auditFailed`（L454） | 审计失败 | **须处理** | UI 方案 D.4 |
| 34 | `book.audit`（L241） | 审计 | **审校** | — |
| 35 | `book.statusCompleted`（L254） | 已完成 | **完结** | 与首页「完结」一致 |
| 36 | 章页（ChapterReader L206） | Packet | **上下文包** | 英文工程词 |
| 37 | 章页（L227） | 带病通过原因（critical 覆盖，可选） | 对话框标题「**仍要通过？**」+ 输入「写下原因」 | `critical` 泄漏 |
| 38 | 章页 kicker（L266–270） | 书稿页 · 03 | **第三章** | — |
| 39 | `daemon.title`（L419） | 守护进程控制 | **守护进程** | 与侧栏一致 |
| 40 | `logs.showingRecent`（L460，LogViewer L135） | 当前展示最近动态与原始日志。 | **删除** | 说明界面本身 |
| 41 | `logs.raw` 卡（LogViewer L102–133） | 常驻「原始日志」 | 页底折叠行「**排障：原始日志 ▸**」 | 收敛方案 E.2 |
| 42 | 模型配置 h1（ServiceListPage L346） | 服务商管理 | **模型配置** | 与侧栏一致 |
| 43 | `settings.subtitle`（L369） | 集中管理写作运行时的项目级开关，不替代模型服务商配置。 | **项目级选项。模型与密钥在「模型配置」。** | — |
| 44 | 所有系统页面包屑「首页 / 页名」 | — | **删除** | 顶栏已有「首页」 |
| 45 | `common.loading` 等「...」三点（use-i18n 内 30 余处） | 加载中... | **加载中…**（中文省略号） | 排版 |

### B.2 可合并的按钮

| 位置 | 现 | 合并为 | 备注 |
|---|---|---|---|
| 首页长篇卡菜单 | 连载书房 / 导出原文 / 书籍设置(→落笔) / 移入暂停 / 删除书籍 | **打开书房 / 落笔 / 导出 / 暂停(恢复) / — / 删除** | 「书籍设置」错标（H02）；书内 ⋯ 已有真正的设置抽屉 |
| 首页短篇卡菜单 | 写下一章 / 书籍设置 / 统计 / 导出原文 / 删除书籍 | **打开书房 / 继续创作 / 导出 / — / 删除** | 「统计」进创作书房 ⋯（已有）；与长篇同构 |
| 问心页输入区 | 5 颗快捷芯片 + 「重新推敲前提」 | **只留「重新推敲前提」** | Q01 |
| 研墨目录底 | 查看原始文件 | 并入 chrome ⋯「真相文件」 | Y03 |
| 织卷树顶 ⋯ | 新增一章 / 整理卷纲 | 树底两条 13px 文字链接 | 同页两个 ⋯ |
| 落笔行内 7 控件 | 通过 / 回滚 / 审校 / 重写 / 同步 / 修复 / 修订▾ | **通过** + **⋯**（回滚本章 / 审校 / 重写 / 同步正典 / 修复状态 / 修订：精修 · 打磨 · 重写 · 重作 · 反检测） | 功能一个不少 |
| 章页 8 按钮 | 返回列表 / 编辑 / Packet / 通过 / 回滚本章 (+保存/预览) | **编辑（→ 保存 · 取消）/ 通过 / ⋯**（回滚本章 / 上下文包 / 删除本章）；「返回」由 chrome【书房】承担 | C02 |
| 资料设置头像行 | 更换头像 / 移除 | 头像悬停 ✎ 菜单 | P03 |
| `ConfirmDialog` | 右上 X + 取消 | 只留「取消」 | D01 |
| 实时动态 | 刷新 按钮 | 删除（SSE 实时；原始日志折叠区内保留刷新） | — |

### B.3 可隐藏 / 降级的次要信息

| 信息 | 现位置 | 处置 |
|---|---|---|
| 系统页面包屑 | 7 个页面页头 | 删除 |
| 书房页头「已写 N/M 章」 | 页头 | 只在四步一览 |
| 书房「本卷要抵达」全文 | 展开态 | 保留一行截断 + 展开（现状），但展开后在卡内，不推动下文 |
| 落笔「下一章 · 可以落墨」状态词 | 条 | 隐藏，只在被闸时显示原因 |
| 落笔 `EN`、题材胶囊、图标 | 页头 | 删 |
| 章页「带病通过原因」输入 | 常驻 | 仅被闸时对话框 |
| 实时动态「原始日志」 | 第二卡 | 折叠行 |
| 守护进程原始事件 `daemon:* › {json}` | 事件卡 | 中文句式；无事件时一句「调度器未运行，AI 动态见「实时动态」」 |
| 模型配置「封面生成」卡 | 页顶第二卡 | 移到分组列表末尾（低频） |
| 织卷筛选四胶囊 | 树顶 | 折叠为一个「筛选 ▾」下拉，默认「全部」 |
| 侧栏会话相对时间 | 每行右侧 | 悬停显示 |

### B.4 状态词统一（一词一义）

| 数据值 | 现文案（出处） | 统一为 | 颜色 token |
|---|---|---|---|
| chapter `ready-for-review` | 待审核（use-i18n L449）/ 待审稿（BookStudy L63） | **待审稿** | `--mark`（黄签） |
| chapter `approved` | 已通过 | **已通过** | 墨（无彩） |
| chapter `drafted` | 草稿 | **草稿** | muted |
| chapter `needs-revision` | 需修订 | **需修订** | `--mark` |
| chapter `audit-failed` | 审计失败 / 须处理 | **须处理** | `--seal-text`（朱批） |
| chapter `imported` | 已导入 | **已导入** | muted |
| chapter `state-degraded` | 状态降级 | **状态待修** | `--mark` |
| book `completed` | 已完成 / 完结 | **完结** | — |
| book `active` | 进行中 | **在写** | — |
| step `done / current / todo`（tooltip） | — | **已完成 / 进行中 / 未开始**（落笔完结时「已完结」） | `StageDot` |
| 审稿严重度 | 须处理 / 建议（copy-map 已有） | 不变 | 朱批 / 黄签 |
| 「审计」动作 | 审计 | **审校** | — |

---

## C. 视觉系统

### C.1 原则：一墨、一纸、一印——为什么是「文学书房」而不是「仪表盘」

仪表盘的语法是**用颜色编码状态**：翠绿 = 好、琥珀 = 等、红 = 坏、蓝 = 信息，再加全大写小标签、图标胶囊、卡片阴影、逐行动画，让人一眼扫到「指标」。这套语法在 v2.1.3 里依然存在（G02 / G07），所以即使主色从深红换成松绿、再换成任何颜色，观感都还是「后台」。

书房的语法反过来：**一种墨、一种纸，颜色只出现在边角**。印章是唯一的红，黄签是唯一的黄，其余全靠字号、字重、衬线与留白分层。层级靠**尺寸与位置**而不是**颜色与边框**；状态靠**一枚小点**而不是**一颗胶囊**；强调靠**一条 24px 朱砂短线**而不是**一块填色**。这就是「高级感、简洁明了」的实现手段——少即是贵。

因此本文的色板不是「把绿换成别的颜色」，而是**把颜色从主体退到边角**：
- 主色（CTA、当前页、实心圆点）= **墨**（甲）或 **黛青**（乙），全站只此一种有分量的颜色；
- 强调（印）= **朱砂**，只允许 ≤ 3px 的点、≤ 2px 的线、章号 / 序数与「须处理」文字，**永不填面、永不做按钮**；
- 待办 = **藤黄**，只做「黄签」淡底与文字；
- 危险 = **绛红**（比朱砂更深更冷），只在「危险区」，且必带图标 + 文字；
- 「已通过 / 已连接」= **墨**，不再用翠绿——「落定为墨」本身就是通过的隐喻；
- 传统意象只借**色相与克制**，不借纹样：不做仿古边框、不做印章矢量、不做水墨飞白，避免土气。

### C.2 方案甲「墨 · 宣 · 朱」（推荐默认套）

浅色 = 朱文印（墨字在宣纸上）；深色 = 白文印（宣白字在墨夜上）。所有值 oklch，附 sRGB 近似与 WCAG 对比度（脚本计算，见 C.2.3）。

#### C.2.1 浅色「宣纸」

| 变量 | 值 | ≈ hex | 用途 | 对比度 |
|---|---|---|---|---|
| `--background` | `oklch(0.975 0.006 85)` | #f9f6f2 | 页面底（宣纸，与现状同） | — |
| `--background-radial` | `radial-gradient(circle at 50% 0%, oklch(0.99 0.004 85), oklch(0.975 0.006 85))` | — | 保留 | — |
| `--card` | `oklch(0.99 0.004 85)` | #fdfcf9 | 纸页 / 抽屉 / 弹层 | — |
| `--card-foreground` `--popover-foreground` | = `--foreground` | | | |
| `--popover` | = `--card` | | | |
| `--foreground` | `oklch(0.24 0.012 260)` | #1c1f25 | 正文（松烟墨，微偏靛） | 15.3 : 1 on bg |
| `--primary` | `oklch(0.27 0.014 260)` | #22272d | 主 CTA、当前页入口、实心圆点、链接下划线 | 前景 14.0 : 1 |
| `--primary-hover` | `oklch(0.33 0.014 260)` | #31363d | 主按钮悬停 | 11.4 : 1 |
| `--primary-foreground` | `oklch(0.975 0.006 85)` | #f9f6f2 | 墨底上的字 | |
| `--secondary` | `oklch(0.94 0.010 85)` | #eeebe4 | 次级按钮底、输入底 | |
| `--secondary-foreground` | = `--foreground` | | | |
| `--muted` | = `--secondary` | | 表头底 | |
| `--muted-foreground` | `oklch(0.50 0.015 260)` | #5e646c | 说明文字、非当前入口 | 5.6 : 1 on bg；5.0 : 1 on secondary |
| `--accent` | `oklch(0.955 0.006 260)` | #eef0f4 | **悬停底**（下拉项、侧栏项）——回归 shadcn 原义 | |
| `--accent-foreground` | = `--foreground` | | | |
| **`--seal`** | `oklch(0.58 0.17 32)` | #cb4832 | **朱砂**：3px 印芯、24px kicker 短线、「今日一笔」左侧 2px 朱丝栏、章号 | 4.3 : 1（非文字，≥ 3 即可） |
| **`--seal-text`** | `oklch(0.52 0.16 32)` | #b23a26 | 朱批文字：「须处理」、被闸原因项目符 | 5.5 : 1 |
| **`--seal-soft`** | `oklch(0.95 0.03 32)` | #ffe8e2 | 朱批淡底（须处理胶囊底） | |
| **`--mark`** | `oklch(0.78 0.13 85)` | #ddb049 | 藤黄：进度条填充、深色模式黄签点；**浅色纸面上不做点**（1.9 : 1 不够） | 非文字 |
| **`--mark-text`** | `oklch(0.55 0.11 78)` | #94680f | 黄签文字与浅色纸面上的 6px 点：「待审稿」「需修订」 | 4.6 : 1 |
| **`--mark-soft`** | `oklch(0.96 0.04 90)` | #fcf1d4 | 黄签淡底：审稿队列、`::selection` | |
| **`--ok`** | `oklch(0.50 0.06 160)` | #446e57 | 竹青：**只用于 toast 成功图标与「已连接」6px 点**；不做文字、不做面 | 5.4 : 1 |
| `--destructive` | `oklch(0.48 0.16 22)` | #a52932 | 绛红：危险区按钮、删除 | 6.6 : 1 on bg |
| `--destructive-foreground` | `oklch(0.98 0 0)` | #fafafa | 危险按钮上的字 | 6.7 : 1 on destructive |
| `--border` | `oklch(0.88 0.010 85)` | #dad7d0 | 发丝线 | |
| `--border-strong` | `oklch(0.80 0.012 85)` | #c1bdb5 | 输入框边、表格外框 | |
| `--input` | = `--secondary` | | | |
| `--ring` | = `--primary` | | 焦点环 | |
| `--radius` | `0.75rem`（12px） | | 卡片；按钮用 `--radius-md`（10px） | |

#### C.2.2 深色「夜读」（白文印）

| 变量 | 值 | ≈ hex | 对比度 |
|---|---|---|---|
| `--background` | `oklch(0.17 0.008 260)` | #0d1013 | — |
| `--background-radial` | `radial-gradient(circle at 50% 0%, oklch(0.21 0.009 260), oklch(0.17 0.008 260))` | | |
| `--card` `--popover` | `oklch(0.21 0.009 260)` | #16181d | |
| `--foreground` | `oklch(0.93 0.010 85)` | #ebe7e0 | 15.6 : 1 |
| `--primary` | `oklch(0.90 0.012 85)` | #e2ded5 | 宣白 CTA，14.2 : 1 on bg |
| `--primary-hover` | `oklch(0.95 0.010 85)` | | |
| `--primary-foreground` | `oklch(0.20 0.010 260)` | #13161b | 13.4 : 1 |
| `--secondary` `--muted` `--input` | `oklch(0.26 0.010 260)` | #212429 | |
| `--muted-foreground` | `oklch(0.70 0.012 85)` | #a29e96 | 7.2 : 1；5.8 : 1 on secondary |
| `--accent` | `oklch(0.24 0.010 260)` | | 悬停底 |
| `--seal` | `oklch(0.70 0.15 32)` | #ed7761 | 6.7 : 1 |
| `--seal-text` | = `--seal` | | |
| `--seal-soft` | `oklch(0.26 0.03 32)` | #311f1b | |
| `--mark` `--mark-text` | `oklch(0.80 0.12 85)` | #e1b75c | 10.2 : 1 |
| `--mark-soft` | `oklch(0.27 0.03 90)` | #2c2615 | |
| `--ok` | `oklch(0.68 0.08 160)` | #6ba887 | 6.9 : 1 |
| `--destructive` | `oklch(0.64 0.16 22)` | #dc5d5f | 5.3 : 1 on bg；4.9 : 1 on card |
| `--destructive-foreground` | `oklch(0.15 0.01 22)` | | 5.4 : 1 on destructive |
| `--border` | `oklch(0.30 0.010 260)` | #2b2e33 | |
| `--border-strong` | `oklch(0.38 0.010 260)` | | |
| `--ring` | = `--primary` | | |

#### C.2.3 现状对比度（说明圆点为何不可见）

| 组合（现松绿板） | 对比度 |
|---|---|
| todo 圆点 `bg-background` on 按钮 `bg-secondary/50` | **1.07** |
| todo 圆点边 `border-border` on `bg-secondary/50` | **1.29** |
| done 圆点 `bg-primary` on 当前页 `bg-primary` | **1.00** |
| 金色 `--accent` 文字（研墨「!」）on 纸 | **2.50** |
| 金色 kicker 线 on 纸 | 2.50（线可接受，字不行） |

计算方式：oklch → sRGB（Björn Ottosson 矩阵）→ WCAG 2.x 相对亮度。实现者可用任意在线工具复核，误差 ±0.1。

### C.3 方案乙「黛青 · 藤黄」（备选套）

给偏好**有彩 CTA** 的产品方。「远山如黛」的靛蓝黑做主色，克制到 chroma 0.06 以免变成 SaaS 蓝；藤黄做强调与深色 CTA；朱砂只做危险。其余 token 与甲同名同义，只列有差异的：

| 变量 | 浅色 | ≈ hex | 深色 | ≈ hex | 备注 |
|---|---|---|---|---|---|
| `--background` | `oklch(0.977 0.005 80)` | #f9f7f4 | `oklch(0.18 0.02 250)` | #0b121a | 纸略冷 |
| `--card` | `oklch(0.992 0.003 80)` | #fdfcfa | `oklch(0.22 0.02 250)` | #141b24 | |
| `--foreground` | `oklch(0.23 0.02 250)` | #161e26 | `oklch(0.93 0.01 85)` | #ebe7e0 | 15.8 : 1 |
| `--primary` | **黛青 `oklch(0.36 0.06 245)`** | #1f405b | **藤黄 `oklch(0.80 0.12 85)`** | #e1b75c | 浅 10.1 : 1；深 10.0 : 1 |
| `--primary-hover` | `oklch(0.32 0.06 245)` | #15364f | `oklch(0.84 0.12 85)` | | |
| `--primary-foreground` | `oklch(0.975 0.006 85)` | #f9f6f2 | `oklch(0.20 0.02 250)` | #0f171f | 10.1 / 9.6 : 1 |
| `--secondary` | `oklch(0.935 0.01 80)` | #ede9e2 | `oklch(0.27 0.02 250)` | #1f2730 | |
| `--muted-foreground` | `oklch(0.48 0.02 250)` | #555f69 | `oklch(0.70 0.015 90)` | #a29e94 | 6.1 / 7.0 : 1 |
| `--accent`（悬停底） | `oklch(0.95 0.012 250)` | | `oklch(0.25 0.02 250)` | | |
| `--seal`（强调点 / 线） | **藤黄 `oklch(0.78 0.13 85)`** | #ddb049 | 藤黄 `oklch(0.80 0.12 85)` | | 在黛青底上 5.4 : 1 |
| `--seal-text` | `oklch(0.53 0.11 78)` | #8e6201 | `oklch(0.80 0.12 85)` | | 5.0 : 1 |
| `--mark` / `--mark-text` / `--mark-soft` | 同甲（藤黄系与 seal 合流，待办用淡底区分） | | | | |
| `--destructive` | **朱砂 `oklch(0.52 0.17 30)`** | #b63325 | `oklch(0.64 0.16 28)` | #dc5f52 | 5.6 / 5.2 : 1 |
| `--border` | `oklch(0.875 0.01 80)` | #d9d5cf | `oklch(0.31 0.02 250)` | #29313a | |

乙的取舍：CTA 有彩、辨识快，但「黛青 + 藤黄」在深色模式下与现状「松绿 + 金」结构相同（彩底 + 暖黄 CTA），只是换了色相；且强调与待办同为藤黄系，靠淡底区分。**甲更彻底地离开仪表盘语法，故为推荐默认。**

### C.4 语义色规则与对既有文档的取代关系

#### C.4.1 五个语义 token 的唯一用法

| token | 允许 | 禁止 |
|---|---|---|
| `--primary` | 主按钮、当前页入口填底、实心圆点、`StageDot` done、选中态文字 | 大面积底色（卡片、页头带） |
| `--seal` / `--seal-text` / `--seal-soft` | 3px 印芯、24px kicker 线、2px 朱丝栏、章号 / 序数、「须处理」文字与胶囊、被闸原因项目符 | 按钮、> 2px 线、> 8px 面（`--seal-soft` 胶囊底除外） |
| `--mark` / `--mark-text` / `--mark-soft` | 「待审稿 / 需修订 / 状态待修」文字与淡底、审稿队列区底、`::selection`、进度条 | 按钮 |
| `--ok` | toast 成功图标、「已连接」6px 点 | 文字、面、按钮（「已通过」用墨） |
| `--destructive` | 危险区按钮与文字、删除确认主键、`data-variant=destructive` 菜单项 | 页头、非危险区任何位置、被闸原因 |

#### C.4.2 归零清单（验收用 `rg`）

- `rg "oklch\(" packages/studio/src --glob '*.tsx'` → 0（全部进 `index.css` 变量）。
- `rg -o "(text|bg|border|ring|hover:bg|hover:text)-(emerald|amber|blue|red|green|rose|yellow|orange|sky|teal|violet|indigo|purple|pink|slate|zinc|gray|stone)-[0-9]+" packages/studio/src` → 0。`use-colors.ts` 的 `btnSuccess / active / paused` 改为 token 类。
- `rg "text-white" packages/studio/src --glob '*.tsx'` → 0（用 `*-foreground`）。
- `rg "uppercase" packages/studio/src --glob '*.tsx'` 仅允许出现在 `ai-elements/`（第三方样式）——其余归零。

#### C.4.3 「被闸 ≠ 错误」着色规则

G1 预检不通过、研墨缺项、卷纲未锁，是**前置条件未满足**，用 `--muted-foreground` 正文 + `--seal` 项目符 + 一颗次级按钮「去 ×× 」。只有**引擎失败**（`activity.lastError`、HTTP 5xx）与**危险区**用 `--destructive`。「须处理」审稿项用 `--seal-text`（朱批），不是 destructive。

#### C.4.4 对 `docs/墨生万象-UI与四步流程重构方案.md` D 章的取代关系

| UI 方案原文 | 处置 | 本文对应 |
|---|---|---|
| D.1 色板整表（松绿 `--primary oklch(0.36 0.07 160)`、金 `--accent oklch(0.70 0.09 82)`、墨绿夜背景等） | **整表作废** | C.2（甲）/ C.3（乙） |
| D.1 「`--accent` 金线（LOGO 星）— 进程条完成点、强调细线、章号」 | **作废**：`--accent` 与 shadcn 悬停语义冲突（G01） | `--seal` 承担强调；`--accent` 回归悬停底 |
| D.1 「深红 Oxblood 主色退役；朱砂只用于危险区与须处理标记」 | 修正：朱砂 = 强调（印）；**危险区改用绛红** `--destructive`；「须处理」用 `--seal-text` | C.4.1 |
| D.1 「背景加极淡纸纹 2%」 | **沿用** | 不变 |
| D.2 字体（霞鹜文楷 + Instrument Serif 本地打包、系统无衬线正文、JetBrains Mono 仅数字） | **沿用**；补「`font-mono` 不用于任何编辑区」 | C.5 |
| D.2 层级「书名 40/48、页标题 28、卡片标题 18、正文 15/26、说明 13」 | 修正为 C.5 表（页标题 32，书房书名同 32） | C.5 |
| D.3 「进程条：完成态实心松绿、当前态描边 + 金点、未开始空心」 | **作废**，正是 N01 / N02 的来源 | C.8 `StageDot` |
| D.3 「主 CTA 用羽毛（Feather）而非闪电（Zap）」 | 沿用；QuickActions L25 违反，随 Q01 删除 | C.9 |
| D.4 禁用清单 8 条 | 沿用，补第 9 条「禁止 Tailwind 调色板类名与 oklch 字面量」、第 10 条「禁止 `window.prompt/confirm`」 | C.4.2 |
| H.8 「主色为松绿（`--primary` ≈ `oklch(0.36 0.07 160)`），强调为金；深红仅出现在危险区与须处理」 | **改为**：「主色为墨（甲 `oklch(0.27 0.014 260)`）或黛青（乙）；强调为朱砂 `--seal`；绛红仅危险区」 | E.5 |
| H.8 「深色模式下背景为墨绿夜色、主 CTA 为金」 | 改为「墨夜 / 宣白 CTA」（甲）或「黛夜 / 藤黄 CTA」（乙） | E.5 |
| `__tests__/p2-ask-ground.test.ts` L68–69 断言 css 含 `oklch(0.36 0.07 160)` 与 `oklch(0.70 0.09 82)` | **改为**断言新主色与 `--seal` 值，并断言 css **不含**旧松绿值 | E.4 |

收敛方案 C.1「AI 动态按钮左侧 8px 圆点松绿呼吸」已被抛光方案取消，不受影响。五页方案 B.1「圆点 = 阶段状态（done 实心 / current 描边金点 / todo 空心，沿用 `stepDotClass`）」由 C.8 取代，其余五页方案条文不变。

### C.5 字号与层级（写真实像素，不依赖 index.css 覆盖）

| 角色 | 字体 | 尺寸 / 行高 | 字重 | 使用处 |
|---|---|---|---|---|
| 页标题 h1 | 衬线 | **32 / 40** | 500 | 全站所有页（书房书名、问心无 h1、研墨 / 织卷 / 落笔步骤名、系统页名、章页章题） |
| eyebrow | 无衬线 | 13 / 20 | 500，`muted-foreground` | h1 上方书名《》/ 分组 kicker（带 24px `--seal` 短线，即 `.literary-kicker`） |
| 区块标题 h2 | 衬线 | 20 / 28 | 500 | 「今日一笔」「本卷要抵达」「等你过目」「四步一览」、抽屉标题、对话框标题 |
| 卡内标题 h3 | 衬线 | 18 / 26 | 500 | 章题（落笔表）、卷名、人物名 |
| 正文 | 无衬线 | **15 / 26** | 450 | 段落、编辑器、表格单元 |
| 界面文字 | 无衬线 | 14 / 20 | 450 | 按钮、菜单项、侧栏条目、chrome 入口（500） |
| 说明 | 无衬线 | 13 / 20 | 450 | 元信息、计数、被闸原因 |
| 微字 | 无衬线 | 12 / 16 | 450 | 封面卡三行、时间戳、类型框；**全站最小，不再有 10 / 11px** |
| 数字 | JetBrains Mono | 同上下文 | 400 | 仅字数、章号、进度；`tabular-nums` |
| 空态标题 | 衬线 | 24 / 32 | 500 | `LiteraryEmpty`（现 28 → 24，弱于 h1） |
| 章页正文 | 衬线 | 18 / 32 | 400 | 阅读器 |

规则：全站 `font-bold` 只保留在数字强调；标题一律 500；删除 index.css L162–173 的 `.text-*` 覆盖（P1，先在 P0 把新写的类改成真实尺寸，避免双重放大）。

### C.6 留白、栅格与容器

| 项 | 规范 |
|---|---|
| 顶栏 | 高 56（现 `h-14`）。书内路由时栏内容见 D.1 |
| 页面容器 | `max-w-[880px]`，`px-8 pt-10 pb-16`；织卷 / 章页 / 数据分析例外 `max-w-[1200px]`（chrome 已不在页内，宽窄不再互相牵扯） |
| 页头 | eyebrow → h1 → 一行说明；页头与正文间 40px；下不画线 |
| 区块间距 | 40px；区块标题与内容 12px |
| 卡片内距 | 20px（`p-5`）；抽屉 24px |
| 侧栏 | 宽 260 不变；分组间 28px；条目高 36 |
| 表格 | 行高 48；单元左右 16 |
| 章页 | 正文列 `max-w-[680px]` 居中 |

### C.7 卡片、按钮、输入

**卡片**：`--card` 底 + 1px `--border` + 12px 圆角，**无阴影**（删 `shadow-soft / shadow-3d / shadow-xl / shadow-2xl` 的使用；token 可留）；不用 `bg-primary/[0.04]` 类淡彩底盒。需要「重点卡」时用**朱丝栏**：左侧 2px `--seal` 竖线（`border-l-2`），仅「今日一笔」与研墨「已定稿」提示卡可用。

**按钮三级**（全站只此三种，放 `components/ui/button.tsx` 变体或 `.btn-*` 类）：

| 级 | 样式 | 用处 |
|---|---|---|
| 主 `btn-primary` | 高 40，`px-5`，14/500，圆角 10，`--primary` 底 `--primary-foreground` 字，悬停 `--primary-hover`；禁用 `opacity-40` | 每页至多一个：落墨 / 研墨定稿 / 织卷 CTA / 就此建书 / 保存（资料） |
| 次 `btn-secondary` | 同尺寸，`--secondary` 底 `--foreground` 字，1px `--border` | 去织卷 / 重新定稿 / 编辑 / 导出 ▾ |
| 文字 `btn-ghost` | 高 32，`px-2`，14/450，`muted-foreground`，悬停 `--accent` 底 | ⋯、筛选、树底链接、取消 |
| 危险 | = 主级形态但 `--destructive` 底，**只在危险区 / 删除确认框** | |

**链接**：正文色 + 1px 下划线 `decoration-[color-mix(in oklch,var(--foreground) 35%,transparent)]`，悬停下划线变 `--seal`。不再用 `text-primary` 表示链接（甲里 primary ≈ 正文色）。

**输入**：高 40，`--card` 底，1px `--border-strong`，圆角 10，聚焦 `--ring` 1px + 无光晕；计数器右下 12px muted（资料设置已有此形态，织卷短题沿用）。

**胶囊**（状态）：高 22，12/500，圆角 6，文字色 = 语义 `*-text`，底 = 语义 `*-soft`；「已通过」= 墨字无底 + 前置 `StageDot done`。

### C.8 四步入口统一交互态（用户点名问题 1 的方案）

#### C.8.1 两条轴，两种视觉

| 轴 | 语义 | 视觉 | 数据源 |
|---|---|---|---|
| 页面轴 | 我在哪一页 | 入口**填底**：`--primary` 底 + `--primary-foreground` 字（五入口恰一个） | `active` prop（五页方案 B.2 不变） |
| 阶段轴 | 书写到哪一步 | 入口左侧 **`StageDot`**（四步各一枚；【书房】无点） | `GET /books/:id/stage` |

两轴叠加时不再互相吞没，因为 `StageDot` 只用 **`currentColor`**——按钮字是墨，点就是墨；按钮字是宣白，点就是宣白。

#### C.8.2 `StageDot` 规格（新增 `components/StageDot.tsx` + `index.css` 三条规则）

```
<span class="stage-dot" data-state="done|current|todo|blocked" aria-hidden />

.stage-dot { width: 8px; height: 8px; border-radius: 9999px; display: inline-block; position: relative; }
.stage-dot[data-state="done"]    { background: currentColor; }
.stage-dot[data-state="current"] { box-shadow: inset 0 0 0 1.5px currentColor; }
.stage-dot[data-state="current"]::after {
  content: ""; position: absolute; inset: 2.5px; border-radius: 9999px;
  background: var(--dot-core, var(--seal));           /* 纸面上是朱砂芯 */
}
.stage-dot[data-state="todo"]    { box-shadow: inset 0 0 0 1.5px color-mix(in oklch, currentColor 50%, transparent); }
.stage-dot[data-state="blocked"] { box-shadow: inset 0 0 0 1.5px var(--seal-text); }   /* 预留：book-stage 目前不输出 */
.is-current-page .stage-dot { --dot-core: currentColor; }   /* 墨底 / 宣白底上朱砂对比不足，退为 currentColor */
```

| 阶段 | 读法 | 纸面（非当前页入口） | 墨底（当前页入口） |
|---|---|---|---|
| `done` | 已成（墨已落定） | 墨色实心 | 宣白实心 |
| `current` | 进行中（印在此处） | 墨环 + **朱砂芯** | 宣白环 + 宣白芯 |
| `todo` | 未及 | 50% 墨淡环 | 50% 宣白淡环 |
| `blocked` | 被闸 / 缺项（chrome 预留；研墨目录与落笔「须处理」现用） | 朱批环（`--seal-text`） | 朱批环 |

- 对比度：朱砂芯 on 纸 4.3 : 1（非文字 ≥ 3 ✓）；宣白点 on 墨 14 : 1；50% 淡环 on 纸 3.35 : 1、on 墨夜 3.7 : 1（非文字 ✓；45% 时浅色只有 2.9，故取 50%）。乙板同规则（纸面芯用 `--seal-text` 藤黄深 `oklch(0.53 0.11 78)` 5.0 : 1；黛青底上用藤黄 5.4 : 1）。
- `data-state` 属性**保留**（`book-step-*` 测试与 Playwright 探针继续可用）。
- 悬停 `title`：「问心 · 已完成」「研墨 · 进行中」「织卷 · 未开始」「落笔 · 已完结」。

#### C.8.3 入口（`BookWorkspaceNav`）形态

```
[ 书房 ]                     ●问心 ──── ◉研墨 ──── ○织卷 ──── ○落笔      ⋯
 ↑ 当前页填底                 ↑ 14/500；点在字左 6px；连接线 16px 1px --border
```

- 五个入口同款：高 32，`px-3`，14/500，圆角 8；非当前页 `muted-foreground` 无底，悬停 `--accent` 底；当前页 `--primary` 底。
- 连接线 `w-4`（16px）`bg-border`，把四步串成一条。
- 【书房】无点；⋯ 为 `btn-ghost`。
- 阶段数据由 D.1 的 App 层栏**只拉一次**（`useBookStage(bookId)`，模块级缓存 + 随 `bookDataVersion` 与 `write:* / weave:* / book:*` SSE 失效），页面内「四步一览」「研墨定稿态」「织卷 groundDone」全部改读同一 hook；未返回前**不渲染点**（避免先灰后亮）。

#### C.8.4 同一枚点，全站复用

| 位置 | 现符号 | 改用 |
|---|---|---|
| 书房「四步一览」 | ✓ ● ○ | `StageDot` + 步名 + 一句摘要 |
| 研墨目录五区 | ✓ / ! | 满足 = `done`；缺项 = `blocked`（此处语义正是「缺项挡定稿」） |
| 织卷章行 | ● / ○ | 已写 = `done`；未写 = `todo`；粗纲区间不画点 |
| 短篇三步条 | 仅文字 | `StageDot` + 可点【书房】（五页方案 C.4） |
| 侧栏 / 模型配置「已连接」 | 翠绿 6px | `--ok` 6px 实心（唯一允许的竹青） |

### C.9 图标与动效

- lucide 16px、1.5 线宽、颜色随文字；主 CTA 用 `Feather`；「模型配置」`Cpu`；「实时动态」`Activity`（已是）；删 `Zap`。
- 动效：只留 `fade-in` 150–200ms（`fadeIn` 位移 8px → 4px）；删逐行 `stagger-*`、`hover:scale-*`、`chat-msg-*` 用于对话框的侧滑、`iconGlow`；写作中用一颗 6px `--seal` 「墨点呼吸」（opacity 0.4→1，1.6s）替代旋转 spinner（聊天流式回复的 spinner 保留）。
- `::selection` = `--mark-soft`（黄签）。
- 滚动条拇指 `--border-strong`。

---

## D. 关键页线框要点

### D.1 书内 chrome：上提到 App 层一条固定栏（五页同宽同位）

```
顶栏（App.tsx，全站唯一一条，56px，随书内路由变形）
非书内： [⌂ 首页]                                                          [☾]
书内：   [⌂ 首页] │ [ 书房 ]            ●问心 ── ◉研墨 ── ○织卷 ── ○落笔   [⋯] [☾]
────────────────────────────────────────────────────────────────────────────
页容器（880 / 1200）：
  《醉词》                      ← eyebrow 13
  研墨                          ← h1 32 衬线
  把世界与人磨实，定稿后开始织卷。
```

- `BookWorkspaceNav` 组件**不改名**，从五个页面 + 问心页头移到 `App.tsx` 的 `<header>` 内，`route` 带 `bookId` 时渲染（`book / book-ask / book-ground / book-weave / book-write / chapter / truth / analytics`），`active` 由 `route.page` 推导（章页 / 真相 / 数据分析分别高亮 落笔 / 研墨 / 书房——五页方案 F.3 的 P1 项顺带完成）。
- 五个页面删各自的 `<BookWorkspaceNav …/>` 一行；问心页删 `shrink-0 border-b px-6 py-3` 包裹；`ask-page.test.ts` L45 `justify-between` 断言改到 App 层片段。
- 「⌂ 首页」与【书房】之间 1px 竖线分隔；左组是「回到哪」，右组是「去哪一页」。
- 栏固定不随页滚动（问心页现状即如此，其余四页由「随页滚」变「固定」）。
- 数据：栏内 `useBookStage(bookId)` 一次；页面复用（C.8.3）。

### D.2 首页封面卡与页头

```
( 头像 96 )  作者名（衬线 32）                          ✎（悬停）
             简介两行…
             在创 3 · 暂停 1 · 完结 8                    ← 13 muted
──── 24px 朱砂短线（.literary-kicker 的线，无文字）──────────────────
[封面][封面][封面][封面][封面]      每格：封面 3:4 · [连载]《醉词》· 始于 · 第 N 章/总 M 章
▸ 暂停 · 完结                                            ← 13 kicker，不加粗不字距
```

- 头像底 `--primary`，首字 `--primary-foreground`（甲：墨底宣白字，像一枚墨印）。
- 金线 → 朱砂 24px 短线（或 `--border` 全宽发丝线，二选一；推荐短线，呼应「印」）。
- 卡菜单按 B.2 同构；卡片无边框阴影，封面 3:4 1px `--border`。
- 「还没有配置 AI 模型，去配置 →」一行 13px 置于页头下、金线上。

### D.3 问心页

```
[⌂ 首页] │ [书房]      ◉问心 ── ○研墨 ── ○织卷 ── ○落笔   [⋯] [☾]
┌─ ChatPage mode="book"（flex-1）───────────────────┐ ┌ 故事卡栏 min(22rem,38%) ┐
│ 会话…                                             │ │ ─ 故事卡（kicker）      │
│                                                   │ │ 暂定书名  醉词   ✎就地   │
│ [重新推敲前提]                ← 唯一芯片          │ │ 一句话故事 …            │
│ [+][📎] 和它聊聊这本书……                    [↑]   │ │ 初步梗概   …            │
│ 模型名 ▾                                          │ │ 古风群像 · 冷冽          │
└───────────────────────────────────────────────────┘ └─────────────────────────┘
```

- 删 `QuickActions`（mode="book"）；删栏顶编辑输入框，书名就地编辑。
- 建书前 `#/book/new` 同布局（`AskCreateRail`），栏宽一致。

### D.4 研墨页（定稿态）

```
《醉词》
研墨                                     已定稿 · 9 月 6 日        ← 13 muted，右对齐
把世界与人磨实，定稿后开始织卷。
┌ 目录 220 ──────┐ ┌ 编辑区 ─────────────────────────────────────┐
│ ● 世界规则      │ │ 世界规则                       ← h3 18 衬线  │
│ ● 人物 (8)      │ │ ┌ 衬线正文编辑器 15/26（不用 mono）┐         │
│ ● 关系与主线    │ │ └──────────────────────────────┘           │
│ ◉ 结局与伏笔    │ │ [保存]  [让 AI 铺细节]                       │
│ ○ 待定项 (2)    │ └───────────────────────────────────────────┘
└────────────────┘
正典变更待确认（有则显示卡片；卡片见 D.6 备注）
                                              [ 重新定稿 ]（次级；未定稿时为主级「研墨定稿」）
```

- 目录点：满足 `done`、缺项 `blocked`；删「查看原始文件」。
- 「结局与伏笔」拆两块编辑区「终局」「伏笔清单」。

### D.5 织卷页头

```
《醉词》
织卷                                                 [ 织卷 · 下一批（第 4–13 章）]  ← 主级 40px
已排 38 / 目标 260 章 · 已锁 1 / 7 卷                  筛选 ▾  搜索…
┌ 卷章树 280 ─────────────┐ ┌ 详情 ─────────────────────────────┐
│ ▾ 第1卷 书院 (1–38)      │ │ 第 1 章                            │
│   ● 第1章 倒叙冷开        │ │ 短题 [倒叙冷开        ]      4 / 12 │
│   ○ 第2章 辩堂交锋        │ │ 提要 [……              ]            │
│   ▸ 第4–13章（粗纲）      │ │ [保存]                    去落笔 → │
│ 新增一章 · 整理卷纲       │ └───────────────────────────────────┘
└─────────────────────────┘
```

- 树顶 ⋯ 行删除；树底两条 13px 链接。空态走 `LiteraryEmpty`，按钮即上方主 CTA。

### D.6 落笔页头与章节表

```
《醉词》
落笔                                        [ 导出 ▾ ]  [ 落墨 · 写下一章 ▾ ]
古风群像 · 12 章 · 4.8 万字
下一章 · 第 13 章 雪夜定誓                  ← 一行；被闸时其下 muted 原因 + 朱砂项目符
（黄签底）等你过目：第 12 章 · 须处理 1 · 建议 2           [全部通过 (1)]（次级）
──── 朱砂短线 ────
  #   章题（衬线 18）            字数     状态              （悬停）
 12   雪前                      4,912   ● 待审稿            [通过] [⋯]
 11   佩剑交接                  5,100   ● 已通过
```

- 状态列 = `StageDot`（待审稿 `--mark-text` 芯 / 已通过墨实心 / 须处理 `--seal-text` 环）+ 文字，无胶囊。
- 表无阴影、无逐行动画；`⋯` 收全部次级动作；`window.prompt` 全部换 `ConfirmDialog + children`。
- 正典变更卡（`TruthProposalCard`）：kicker「正典变更 · 人物 / 苏绻」（文件名走 `copy-map` 映射，`story/outline/story_frame.md` → 「故事框架」，`roles/主要角色/苏绻.md` → 「人物 · 苏绻」）；diff 默认折叠为「+3 −1 行 ▸ 查看」，按钮「写入」主级、「拒绝」文字级；边框 `--border`，不用琥珀底。**人闸语义不变。**

### D.7 书房总览

```
《醉词》（h1 32）
古风群像 · 始于 2026-09-01 · 4.8 万字
┃ 今日一笔                                      ← 左 2px 朱丝栏，纸底，无填色
┃ 第 13 章 · 雪夜定誓（衬线 24）      第1卷 书院 · 13/38
┃ 提要一句……
┃ [ 落墨 · 写下一章 ▾ ]     （被闸：muted 原因 ×N + [去织卷]）
本卷要抵达 — 第1卷 书院                                1/38
一行截断……（点击展开）
等你过目
· 第 12 章 待审稿 → 去看
· 正典变更 2 处 → 查看（展开为卡片）
· 伏笔「身份暗流」目标第 5 章，已逾期 → 去织卷
──── 朱砂短线 ────
四步一览
● 问心  「一句话故事……」        ● 研墨  已定稿 · 8 位人物
◉ 织卷  已锁 1 卷 · 细纲 38/260   ○ 落笔  已写 12 / 260 章
```

- 删红色「须处理」卡；写作中横幅只保留出错态。

### D.8 系统页统一页头（资料 / 实时动态 / 守护进程 / 项目设置 / 模型配置 / 检查更新 / 题材 / 文风 / 真相文件）

```
（无面包屑）
页名（h1 32 衬线，无图标）
一行说明（可无）
40px
正文
```

- 资料设置：头像 96 悬停 ✎ 菜单（更换 / 移除）；两输入 + 保存主级；「已保存」用 toast。
- 实时动态：右上状态句 13 muted；「最近动态」列表直接开始，无卡边；页底「排障：原始日志 ▸」。
- 守护进程：h1「守护进程」；右上开关 + 状态句；事件中文句式。
- 模型配置：h1「模型配置」；分组 kicker；卡边一律 `--border`，已连接 = `--ok` 6px 点 + 「已连接」muted。

---

## E. 实现分期与验收

### E.1 分期（三个 PR，均不 bump、不改 appId / 安装包 / 许可证头）

| PR | 内容 | 主要文件 | 依赖 |
|---|---|---|---|
| **P0-6 文艺配色 + 圆点统一 + 文案删减** | ① `index.css`：按 C.2（甲）重写 `:root` / `.dark`，新增 `--seal* / --mark* / --ok / --primary-hover / --border-strong`，`--accent` 回归悬停底，`::selection`；② 新增 `components/StageDot.tsx` + css；`BookWorkspaceNav` 圆点改 `StageDot`（`stepDotClass` 删除），入口尺寸按 C.8.3；书房四步一览 / 研墨目录 / 织卷章行 / 短篇条改用 `StageDot`；③ 硬编码色归零（C.4.2 三条 `rg`）：5 处 oklch 字面量、`STATUS_CONFIG`、`TruthProposalCard`、`SerialCockpitStrip`、`LogViewer`、`DaemonControl`、`ServiceListPage`、`ProjectSettings`、`ChapterReader`、`use-colors.ts`、`ConfirmDialog`；④ B.1 文案表 45 条、B.4 状态词、Q01 删问心快捷芯片、H02 / H03 首页菜单修正；⑤ `inkborne-mark.svg` title 修正；⑥ 测试同步（E.4） | `index.css`、`StageDot.tsx`（新）、`BookWorkspaceNav.tsx`、`BookStudy.tsx`、`BookGround.tsx`、`OutlineWorkspace.tsx`、`ShortReader.tsx`、`Dashboard.tsx`、`Sidebar.tsx`、`AuthorPage.tsx`、`BookDetail.tsx`、`ChatPage.tsx`、`use-i18n.ts`、上列硬编码文件 | 无 |
| **P0-7 chrome 上提 + 页头 / 对话框收口** | ① D.1：`BookWorkspaceNav` 移入 `App.tsx` 顶栏，五页删各自 nav，新增 `hooks/use-book-stage.ts`（单次拉取 + SSE 失效），页面改读；② G03 / G04 / D.8：全站 h1 32、系统页删面包屑与 h1 图标、容器统一 C.6；③ C.7 按钮三级落到 `ui/button.tsx` 变体并替换六种主 CTA；④ D01–D05：`ConfirmDialog` 去阴影 / 去 X / 去侧滑，新增 `components/ui/drawer.tsx` 原语替换两抽屉，重命名对话框复用 `ConfirmDialog`，短篇危险区迁入 `ShortSettings`；⑤ `LiteraryEmpty` 统一空态（E01）；⑥ 章页 / 真相 / 数据分析挂 chrome（随①自动） | `App.tsx`、`use-book-stage.ts`（新）、`ui/button.tsx`、`ui/drawer.tsx`（新）、`ConfirmDialog.tsx`、`BookSettingsDrawer.tsx`、`BookToolsDrawer.tsx`、`Sidebar.tsx`、`ShortReader.tsx`、`ShortSettings.tsx`、9 个系统页、`LiteraryEmpty.tsx` | P0-6 |
| **P1-5 深页排版** | 落笔章节表（X02 行内 ⋯、X03 prompt → 对话框、X06 导出、X07 表格）；研墨（Y01 定稿态、Y05 编辑器、Y06 拆终局 / 伏笔）；织卷（W02 树底链接、W05 计数器、筛选折叠）；章页（C02–C05）；`TruthProposalCard` 文件名映射与 diff 折叠（D.6 备注）；`SerialCockpitStrip` 改一行；实时动态 / 守护进程事件句式与折叠；短篇精简版（五页方案 C.4）；删 index.css `.text-*` 覆盖（G08）；`isZh` hack（G11）；侧栏字号层级（S01） | 上列页面 | P0-7 |

若产品方选乙板：P0-6 ① 换 C.3 值，其余不变。若要求两套可切换：`.dark` 之外再加 `[data-palette="indigo"]` 选择器覆盖，UI 不加切换入口（项目设置里一项单选即可，非本文范围）。

### E.2 不做的事（边界）

- 不改四步状态机、`GET /books/:id/stage`、`POST /ground/confirm`、`write-preflight`、织卷每批 10 章、正典 diff 人闸、章审稿 / 带病通过覆盖的任何后端语义；`packages/core`、`server.ts` 路由零 diff。
- 不新增页面、不新增路由（章页 / 真相 / 数据分析挂 chrome 只是渲染条件）。
- 不改安装包图标（`build/`）；UI 圆标（`public/inkborne-mark.png`，源 `inkborne-mark.svg`）深绿描边是否随甲板改为墨色（`#16382a` → `#22272d`，金星保留）**需产品确认**（F 章）。
- 守护进程默认关、调度器语义不改（收敛方案 E 章产品覆盖）。

### E.3 风险与回退

| 风险 | 处置 |
|---|---|
| 甲板 `--primary` ≈ `--foreground`，旧代码里 `text-primary` 用作「链接 / 高亮」的地方会失去区分（`rg "text-primary" packages/studio/src --glob '*.tsx'` 约 150 处） | P0-6 逐处判定：链接 → 下划线规则（C.7）；「选中态」→ `bg-accent` 或 `font-medium`；图标着色 → 保留（墨色图标合理） |
| 下拉菜单悬停从金底变淡墨底，用户可能觉得「变淡了」 | 这是修正 G01；说明即可 |
| chrome 上提后，页面 `fade-in` 时栏不随动 | 预期行为（固定栏） |
| `StageDot` 50% 淡环在低分屏可能偏淡 | 保底 1.5px 线宽；浅色 3.35 : 1、深色 3.7 : 1，均过非文字 3 : 1 线 |
| 删问心快捷芯片后，有用户习惯在问心里点「落墨」 | 书房与落笔页有主 CTA；问心页 chrome 右侧「落笔」一步可达 |

### E.4 需同步的测试

| 文件 | 改法 |
|---|---|
| `__tests__/p2-ask-ground.test.ts` L68–69 | 断言 css 含 `oklch(0.27 0.014 260)`（甲主色）与 `--seal: oklch(0.58 0.17 32)`；新增 `not.toMatch(/oklch\(0\.36 0\.07 160\)/)`、`not.toMatch(/oklch\(0\.70 0\.09 82\)/)` |
| 同文件 L74–83 视觉源码合集 | 扩到 `BookWorkspaceNav / BookGround / OutlineWorkspace / Sidebar / ChapterReader / LogViewer / DaemonControl / ServiceListPage / ProjectSettings / ConfirmDialog / SerialCockpitStrip / use-colors`；新增断言 `not.toMatch(/(emerald|amber|blue|rose)-[0-9]{3}/)`、`not.toMatch(/oklch\(/)`（tsx 内）、`not.toMatch(/window\.prompt/)`、`not.toMatch(/\buppercase\b/)` |
| 同文件 L93 `short-danger-zone` | 改读 `ShortSettings.tsx`（P0-7） |
| `__tests__/ask-page.test.ts` L45 `justify-between` | 改到 `App.tsx` 顶栏片段；新增 `BookAskPage.tsx not.toMatch(/BookWorkspaceNav/)`（P0-7） |
| 新增 `__tests__/stage-dot.test.ts` | `BookWorkspaceNav.tsx` 不含 `stepDotClass` / `bg-primary` 圆点 / `oklch(`；含 `StageDot`；`index.css` 含 `.stage-dot[data-state="done"] { background: currentColor` ；`BookStudy / BookGround / OutlineWorkspace / ShortReader` 含 `StageDot` 且不含 `"✓"` / `"●"` / `"○"` 字面 |
| 新增 `__tests__/copy-dedupe.test.ts` | `use-i18n.ts`：`chapter.readyForReview` 为「待审稿」、`chapter.auditFailed` 为「须处理」、`book.statusCompleted` 为「完结」、`daemon.title` 为「守护进程」、无 `logs.showingRecent` 键；`ChatPage.tsx` 中 `QuickActions` 渲染条件含 `mode !== "book"`；`Dashboard.tsx` 卡菜单不含 `toBookSettings` 或其文案为「落笔」 |
| `hooks/use-hash-route.test.ts` | 不变 |
| Playwright（可选，`INKOS_AGENT_LLM_STUB=1`） | 进已定稿的书 `#/book/<id>/ask`：`[data-testid="book-step-ask"] .stage-dot` 的 `getComputedStyle(...).backgroundColor` 非透明且与按钮背景色不同；`#/book/<id>` 下四枚点 `data-state` 与 `/stage` 返回一致；切五页时 `book-workspace-nav` 的 `boundingBox().x` 恒等 |

### E.5 中文验收 checklist

**配色（P0-6）**

- [ ] 浅色：页面底为宣纸色，主按钮为墨色（甲）/ 黛青（乙），全站找不到深绿（`#124830` 系）——头像底、圆点、金线、进程点、侧栏均无。
- [ ] 深色：底为墨夜，主按钮为宣白（甲）/ 藤黄（乙），正文对比 ≥ 15 : 1，说明文字 ≥ 5 : 1。
- [ ] 任意下拉菜单项悬停为**淡墨底**，不再是金色块。
- [ ] 「已连接 / 已通过 / 全部通过」不出现翠绿；「待审稿 / 需修订」为藤黄字；「须处理」为朱砂字；红色只出现在「危险区」与删除确认框。
- [ ] 书房 G1 原因为灰字 + 朱砂项目符，不是红字。
- [ ] `rg "oklch\(" packages/studio/src --glob '*.tsx'` 为 0；`rg -o "(emerald|amber|blue|rose|green|yellow|orange|sky|teal|indigo|violet|purple|pink|slate|zinc|gray|stone)-[0-9]{3}" packages/studio/src` 为 0；`rg "text-white" … --glob '*.tsx'` 为 0。

**圆点与入口（P0-6）**

- [ ] 进任意已建书的**问心页**：问心入口为墨底宣白字，左侧有**宣白实心点**（已完成）；研墨 / 织卷 / 落笔在纸面上分别显示实心 / 环 + 朱砂芯 / 淡环，**四枚点全部可见**。
- [ ] 切到研墨 / 织卷 / 落笔页，被高亮的入口点仍可见（宣白）；其余三枚点状态不变。
- [ ] 书房页：【书房】高亮无点；四步点与「四步一览」四枚点**同状态同形**。
- [ ] 悬停任一入口显示「研墨 · 进行中」类提示。
- [ ] 进页瞬间不出现「先全灰再变亮」；Network 里 `/books/<id>/stage` 每次进页只请求一次。
- [ ] 研墨目录五区、织卷章行、短篇三步条使用同一形状的点，无 ✓ ● ○ ! 字符。

**文案（P0-6）**

- [ ] 侧栏分组为「开始创作 / 问心记录 / 工具 / 设置」，分组标题小于条目字号且不加粗、不全大写。
- [ ] 首页长篇卡菜单为「打开书房 / 落笔 / 导出 / 暂停 / 删除」，短篇卡「打开书房 / 继续创作 / 导出 / 删除」；点「落笔」进落笔页，不再有标「书籍设置」却进落笔的项。
- [ ] 首页有归档书而无在写书时显示「没有在写的书」，不显示「书架还空着」。
- [ ] 问心页输入区只有「重新推敲前提」一枚芯片，无「落墨 / 织卷·规划 / 审计 / 导出 / 市场雷达」；占位为「和它聊聊这本书……」。
- [ ] 书房页头无「已写 N / M 章」；四步一览问心行显示一句话故事，研墨行显示「已定稿」或人物数。
- [ ] 书房无红色「第 N 章有须处理的问题」卡；「等你过目」里「正典变更 N 处」可点击展开卡片。
- [ ] 落笔章状态词为「待审稿 / 已通过 / 草稿 / 需修订 / 须处理 / 已导入」；无「待审核 / 审计失败 / 审计」；「下一章 · 第 N 章 短题」一行，无「可以落墨」。
- [ ] 全站搜索「工具列表 / 服务商管理 / 守护进程控制 / 输入指令 / 去排纲 / 走确认闸 / 当前展示最近动态 / Packet / critical」在用户可见文案中为 0。

**chrome 与页头（P0-7）**

- [ ] 书房 / 问心 / 研墨 / 织卷 / 落笔 / 章页 / 真相文件 / 数据分析八个书内页，顶栏同一位置显示「⌂ 首页 │ 书房 … 问心 · 研墨 · 织卷 · 落笔 · ⋯ · ☾」，切页时该行**不位移**、不重绘。
- [ ] 章页高亮「落笔」，真相文件高亮「研墨」，数据分析高亮「书房」；章页无「首页 / slug / #3」面包屑。
- [ ] 资料设置 / 实时动态 / 守护进程 / 项目设置 / 模型配置 / 检查更新 / 题材模板 / 文风学习 / 真相文件页头**无面包屑**、h1 无图标、字号一致（32px 衬线）。
- [ ] 全站主按钮同高（40px）同字号；织卷 CTA 不再是最小的按钮。
- [ ] 所有对话框：无右上 X（仅「取消」）、无阴影、150ms 淡入；重命名会话对话框与删除对话框同款。
- [ ] 书籍设置 / 更多工具抽屉 ESC 可关、右上 X、遮罩随主题；短篇「删除」只在短篇设置危险区，创作书房页内无红色按钮。
- [ ] 空态（首页 / 织卷 / 落笔 / 实时动态 / 真相文件 / 问心右栏）均为「一句衬线标题 + 一句说明 + 一颗按钮」，无「暂无」、无斜体。

**通用**

- [ ] `pnpm test`、`pnpm typecheck`、`pnpm build` 通过；`pnpm start` Electron 启动无控制台报错。
- [ ] 版本号仍为 2.1.3；`appId / productName / artifactName` 无 diff；`packages/core`、`server.ts` 无 diff。
- [ ] `docs/Changelog.md` Unreleased 各加一行；UI 方案 D 章顶部加「修正说明（见本文）」。

---

## F. 最终消息（供复述）

1. **圆点根因**：完成态圆点 `bg-primary` 与当前页高亮底 `bg-primary` 同色（BookWorkspaceNav L65 / L70），未开始圆点在 `bg-secondary/50` 上对比度 1.07（L66 / L72）；`deriveBookStage` 让落笔永不 done（book-stage L147 / L154），所以只有落笔选中时圆点可见。修法：单一 `StageDot`（`currentColor` 驱动：实心 = 已成、环 + 朱砂芯 = 进行中、50% 淡环 = 未及），页面轴（填底）与阶段轴（点）分离，`/stage` 只拉一次。
2. **配色告别深绿**：推荐默认套 **甲「墨 · 宣 · 朱」**——墨 `oklch(0.27 0.014 260)` 主色 / 宣纸底 / 朱砂 `oklch(0.58 0.17 32)` 只做点线章号 / 藤黄黄签待办 / 绛红只在危险区；深色为「白文印」反相（宣白 CTA 在墨夜）。备选 **乙「黛青 · 藤黄」** 保留有彩 CTA。两套均给出全 token 表、hex 与对比度。
3. **UI 方案 D.1 松绿色板与 D.3 进程条三态整表作废**，H.8 与 `p2-ask-ground.test.ts` L68–69 随改；D.2 字体、纸纹、D.4 禁用清单沿用并补两条。
4. `--accent` 曾被误当金色强调，而 shadcn 原语把它当悬停底 → 全站下拉项悬停是金色块（G01）。`--accent` 回归悬停底，强调另立 `--seal`。
5. **硬编码色归零**：5 处 `oklch()` 字面量（三处头像、金线、圆点金环）与 33 个文件的 emerald / amber / blue 类名，是「换主色仍像仪表盘」的根源；用 `--seal / --mark / --ok / --destructive / --primary` 五个语义 token 替换，`rg` 三条归零作验收。
6. **书内 chrome 上提到 App 顶栏**一条固定栏（左 ⌂ 首页 │ 书房，右 四入口 · ⋯ · ☾），解决五页容器宽度不同导致的入口位移与问心页多一条线；章页 / 真相 / 数据分析顺带挂上（五页方案 F.3 P1 项）。
7. **系统页面包屑全删**（顶栏已有首页）；七种 h1 字号归一 32px 衬线，h1 不带图标；六种主 CTA 归一（40px / 14 / 500），按钮三级。
8. **问心页删「落墨 · 写下一章 / 织卷·规划 / 审计 / 导出 / 市场雷达」芯片**（与 UI 方案 A01 / A02 冲突），只留「重新推敲前提」；占位「和它聊聊这本书……」。
9. **首页卡菜单错标**：「书籍设置」实际进落笔页 → 改「落笔」；长短篇菜单同构；只有归档书时不再显示「书架还空着」。
10. **文案删减 45 条**（B.1）：工具列表→工具、服务商管理→模型配置、守护进程控制→守护进程、待审核→待审稿、审计失败→须处理、审计→审校、已完成→完结、去排纲→去织卷、删「走确认闸」「Packet」「critical」「当前展示最近动态与原始日志」等；状态词一词一义（B.4）。
11. **书房**：页头去「已写 N/M 章」，四步一览用 `StageDot` 并给问心 / 研墨行正确摘要，待办三处合一、删红卡，被闸原因灰字 + 朱砂项目符 + 一颗「去织卷」；「今日一笔」改朱丝栏卡。
12. **研墨**：新增「已定稿 · 日期」态，主按钮降为「重新定稿」；目录点同 `StageDot`；删重复的「查看原始文件」；「结局与伏笔」拆两块。**落笔**：行内 7 控件收成「通过 + ⋯」，`window.prompt` ×5 换 `ConfirmDialog`，状态胶囊去大写去调色板。**章页**：8 按钮收成 3，删 slug 面包屑与常驻「带病通过」输入。
13. **对话框 / 抽屉**：`ConfirmDialog` 去阴影 / 去 X / 去侧滑，重命名对话框复用之；两抽屉抽 `Drawer` 原语（ESC、遮罩随主题）；短篇页内红色删除键迁入短篇设置危险区。
14. **分期**：P0-6 配色 + 圆点 + 文案（一个 PR）→ P0-7 chrome 上提 + 页头 / 对话框收口 → P1-5 深页排版；三者均不 bump、不改 appId / 安装包、不动 core / server 与任何硬闸语义。测试同步清单见 E.4。
15. 本文路径：`docs/墨生万象-全站UI审查与文艺配色迭代方案.md`；本 PR 仅含此文件。

**需产品方确认的选项**

| # | 选项 | 建议 |
|---|---|---|
| 1 | 色板：甲「墨 · 宣 · 朱」 vs 乙「黛青 · 藤黄」 | **甲**（更彻底离开仪表盘语法；乙保留有彩 CTA） |
| 2 | LOGO 深绿描边 `#16382a` 是否随甲板改为墨 `#22272d`（金星保留）。UI 里 `BrandMark.tsx` 用的是 `public/inkborne-mark.png`，SVG 是源文件；改色需从 SVG 重导出 PNG；安装包 `build/` 图标不动 | 建议改（只影响侧栏 12px 圆标与启动页）；不改则深绿只残留在这枚小标上，与甲板中性底可共存 |
| 3 | 首页金线：24px 朱砂短线 vs 全宽 `--border` 发丝线 | 短线 |
| 4 | 侧栏「长篇小说 / 短篇小说」是否缩为「长篇 / 短篇」 | 可选，默认不改 |
| 5 | 是否同时保留两套色板可切（项目设置一项单选） | 默认不做，先定一套 |
