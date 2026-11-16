# 数据对象与字段表（课题第 1 问）

> 本文件是**字段定义的唯一存放位置**：`docs/schema.md`。
> 校验实现：`src/record-store.js`；接口约定：`docs/api.md`；实测输出：`docs/实测报告.md`。
> 本项目是**纯静态浏览器游戏，无后端、无数据库**。主路径 =
> 打开网页 → 开局 → 打 10 波 → 结算自动生成 1 条战绩 → 提交到本机记录表 → 重开网页在「战绩簿」查看。

---

## 一、主路径用到的对象（只列主路径）

| # | 对象 | 形态 | 用途 | 落库位置 |
|---|---|---|---|---|
| 1 | `RunRecord` | 1 条 JSON 记录 | 一局游戏的结算战绩，是主路径上唯一被写入的数据 | 见下表 |
| 2 | `RecordStore` | JSON **数组**（表） | 存放全部 `RunRecord`，提供提交/查询/导出 | 网页：`localStorage['pixel_survivors_records_v1']`；命令行产物：`data/records.json` |
| 3 | `UpgradeCatalog` | 静态字典（9 条） | 强化 id 白名单，校验 `upgrades` 字段，未命中即「未收录」 | 定义：本文件第三节；运行时：`src/record-store.js` 常量 |
| 4 | `WaveCatalog` | 静态字典（10 条） | 波次配置条目，`wave(n)` 查询依据 | 定义：本文件第三节；运行时：`src/record-store.js` 常量 |
| 5 | `GameState` | **内存对象，不落库** | 玩家坐标/血量/波次/敌弹等逐帧状态，刷新即重建 | 仅 `index.html` 运行时内存 |

> `RecordStore` 里**不存放**逐帧战斗数据；每局只在结算时写入一条 `RunRecord`，避免刷写。

---

## 二、`RunRecord` 字段表（字段定义存放于本文件）

| 字段 | 类型 | 必填 | 唯一 | 取值 / 规则 | 生成方 |
|---|---|---|---|---|---|
| `runId` | string | 是 | **是** | `^R\d{14}-[0-9a-f]{4}$`，如 `R20261116123456-3f9a`；提交方可自带，重复即拒绝 | 系统（缺省时） |
| `schemaVersion` | integer | 是 | 否 | 固定 `1`；用于以后升级结构 | 系统 |
| `createdAt` | string | 是 | 否 | ISO 8601 UTC，如 `2026-11-16T04:12:33.120Z`；**提交方传了也会被系统覆写** | 系统 |
| `playerName` | string | 是 | 否 | 1–12 位，正则 `^[\u4e00-\u9fa5A-Za-z0-9_]{1,12}$` | 提交方 |
| `waveReached` | integer | 是 | 否 | **1–10**（第 10 波为 Boss） | 提交方 |
| `result` | enum string | 是 | 否 | `victory` / `defeat` | 提交方 |
| `kills` | integer | 是 | 否 | 0–9999 | 提交方 |
| `level` | integer | 是 | 否 | 1–99 | 提交方 |
| `hpLeft` | integer | 是 | 否 | 0–30，且 `hpLeft ≤ maxhp` | 提交方 |
| `maxhp` | integer | 是 | 否 | 1–30 | 提交方 |
| `upgrades` | array\<string\> | 是 | 否 | 最多 20 项；每项必须命中 `UpgradeCatalog` 的 9 个 id；允许重复（同一强化可多次选） | 提交方 |
| `durationSec` | number | 是 | 否 | 0–7200，写入时四舍五入保留 1 位小数 | 提交方 |
| `source` | enum string | 是 | 否 | `web` / `debug`（`?god=1` 无敌局标为 `debug`，用于区分验收数据） | 提交方 |

**约束汇总**：`runId` 唯一；10 个字段必填；越界、类型错、枚举外取值、字典外 id 一律拒绝；`runId`/`createdAt`/`schemaVersion` 由系统最终确定。

**存放位置（明确回答"字段表存放在仓库哪个文件"）**
- 字段定义（表）→ `docs/schema.md`（本文件）
- 校验规则的可执行版本 → `src/record-store.js` 的 `validate()`
- 实际写入的数据 → 网页端 `localStorage['pixel_survivors_records_v1']`；命令行端 `data/records.json`（`tests/cli.js` 的产物路径）
- 浏览器内查看入口 → 页面按 `R` 或点「🏆 战绩簿」

---

## 三、静态字典条目与「未收录」标记怎样存放

本课题**不含检索问答助手**（没有"问题 / 回答 / 依据"三元组），对应到游戏里的等价物是**字典条目 + 依据**：

- `UpgradeCatalog` 条目结构：`{ id, name }`，9 条；`id` 是 `RunRecord.upgrades` 的**依据**。
- `WaveCatalog` 条目结构：`{ wave, chasers, shooters, boss }`，10 条；是 `wave(n)` 查询的**依据**。
- **「未收录」标记不落库**：查不到时只在**返回对象**里放 `mark: "未收录"`，并带 `code: "NOT_INDEXED"` / `"NOT_FOUND"` 与中文 `hint`。例：
  ```json
  { "ok": false, "code": "NOT_INDEXED", "mark": "未收录",
    "hint": "查询失败：第 11 波未收录，本游戏只定义 1–10 波。" }
  ```
  这样"未收录"是**可判定的返回值**，而不是写进表里的脏数据。

---

## 四、AIGC 课题条款：每一步的产物及其输入怎样存放

本课题**不含服务端 AIGC 推理链**（没有 prompt→模型→后处理的多步在线生成），故模板里的"每一步产物及输入"按**本项目实际的三步产出链**登记，见 `docs/provenance.md`：

| 步 | 输入 | 产物 | 存放位置 |
|---|---|---|---|
| 1 生成 | 需求描述（10 波 / 两种敌人 / 自动射击 / Boss 留躲避空间） | 游戏源码 | `index.html` |
| 2 验证 | 源码 + 自动化浏览器验证脚本 | 三端实测结论与关键输出 | `docs/实测报告.md` |
| 3 部署 | 6+ 个静态文件 | 公网网址 `https://yamataryuu.github.io/114514/` | GitHub Pages（`settings/pages`） |

本表只登记**产物与输入的对应关系**，不存放任何中间推理内容；需要复现时以仓库文件为准。

---

## 五、适用边界（如实说明）

- 战绩数据**只存本机浏览器**：换浏览器、清缓存、换设备后看不到，不同访客之间不共享。
- `data/records.json` 是**命令行实测产物样本**：本地静态服务访问返回 200；是否随 Pages 发布取决于有没有把 `data/` 目录一起上传。**网页运行时不读写该文件**，网页数据一律在浏览器 `localStorage`。
- 纯静态站点没有账号体系，因此**没有"无权限"类失败**；实际会发生的失败是重复编号、缺字段、越界、字典未收录、查不到。
