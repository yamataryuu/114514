# 产物与输入追溯（课题第 1 问 · AIGC 条款）

本课题是**纯静态浏览器游戏**，不含服务端 AIGC 推理链（没有在线的「prompt → 模型 → 后处理」多步生成）。
按模板"写明每一步的产物及其输入怎样存放"的要求，登记本项目**实际存在的三步产出链**：

| 步 | 输入（存放位置） | 产物（存放位置） | 可复现方式 |
|---|---|---|---|
| ① 生成 | 需求描述：10 波、两种敌人、WASD 移动、自动射击、Boss 大量弹幕但留躲避空间（对话需求，不入库） | 单页游戏源码 `index.html`（仓库根目录） | 浏览器直接打开 |
| ② 验证 | `index.html` + `src/record-store.js` + 自动化浏览器验证脚本 | 三端实测结论、成功/失败关键输出 `docs/实测报告.md` | `node tests/cli.js …`、浏览器按 `R` / `T` |
| ③ 部署 | `index.html`、`src/record-store.js`、`sw.js`、`manifest.webmanifest`、两个图标、`docs/`、`tests/`、`data/` | 公网站点 `https://yamataryuu.github.io/114514/` | 仓库 Settings → Pages（`main` / `/(root)`） |

**存放约定**
- 输入侧只保留**可复现的产物文件**，不保存任何中间推理内容；
- 验证步的输出（关键终端输出、页面提示截图文字）落在 `docs/实测报告.md`，不落在运行时数据表 `data/records.json` 里；
- 三步的**字段定义**统一引用 `docs/schema.md`，**接口**统一引用 `docs/api.md`，避免多处定义漂移。

**模板条款适用性小结**
- 「含助手的课题」：本课题无检索问答助手，无"问题/回答/依据"三元组；等价物是 `UpgradeCatalog` / `WaveCatalog` 字典条目与 `mark:"未收录"` 返回标记，存放方式见 `docs/schema.md` 第三节。
- 「AIGC 课题」：无在线多步推理链；以上三步为实际产出链，按上表存放。
