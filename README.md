# 像素割草 · 十波幸存者（静态网站版）

一个纯前端的像素风割草游戏：**没有后端、没有数据库、没有构建步骤、没有第三方依赖**。
把整个目录按原结构放进任意静态网站根目录，用浏览器访问网址就能玩；手机、平板、电脑都支持。

```
site/
├── index.html                  ← 游戏本体（HTML + CSS + JS）
├── src/
│   └── record-store.js         ← 战绩数据对象、字段校验、存储适配器
├── docs/
│   ├── schema.md               ← 数据对象与字段表（课题第 1 问）
│   ├── api.md                  ← 核心接口约定（课题第 2 问）
│   ├── provenance.md           ← 产物与输入追溯
│   └── 实测报告.md             ← 实测结果（课题第 3 问）
├── tests/
│   └── cli.js                  ← 命令行实测入口
├── data/
│   └── records.json            ← 命令行实测产物样本（网页运行时不读写它）
├── manifest.webmanifest        ← PWA 清单：可「添加到主屏幕」全屏打开
├── sw.js                       ← Service Worker：首次访问后断网也能玩
├── icon-192.png / icon-512.png ← 桌面/主屏幕图标
└── README.md
```

> 顶层另附 `课题作业_数据与接口说明.md`（三问汇总答案）。

---

## 一、本地先跑起来（30 秒）

```bash
cd site
python3 -m http.server 8080
```

浏览器打开 <http://localhost:8080>。
> 不要直接双击 `index.html` 玩「网站版」：本地 `file://` 下 Service Worker 会被禁用，且部分浏览器会禁用 localStorage（战绩只在当前会话有效）。想直接双击玩，用顶层附带的**单文件网页版 HTML**。

---

## 二、拿到公网网址（任选一种，都免费）

### 方案 A：Netlify Drop（最快）
打开 <https://app.netlify.com/drop>，把**整个 site 文件夹**拖进虚线框，立刻得到 `https://xxxx.netlify.app`。

### 方案 B：GitHub Pages
1. 新建 Public 仓库，把上面目录里的**文件按原结构**上传（`index.html` 必须在仓库根目录）
2. 仓库 → `Settings` → `Pages` → `Deploy from a branch` → `main` / `/(root)` → Save
3. 等 1–2 分钟，访问 `https://用户名.github.io/仓库名/`

**⚠️ 更新已部署的站点（本项目从 v1 升到 v2）**
- 用新包里的 `index.html` **覆盖**旧文件
- 新增 `src/record-store.js`、`docs/`、`tests/`、`data/` 四个目录（GitHub 上传框可以直接拖文件夹，会保留目录层级）
- `sw.js` 也覆盖（缓存名已改为 `pixel-survivors-v2`，否则老访客一直看旧版）
- 提交后强刷 `Ctrl+Shift+R`

### 方案 C：Vercel / Cloudflare Pages / 自己的 Nginx / 对象存储
把整个目录放到站点根目录即可。若服务器不认识 `.webmanifest`，Nginx 加一行：
```nginx
types { application/manifest+json webmanifest; }
```
Service Worker 只在 **HTTPS 或 localhost** 下生效。

---

## 三、怎么玩

| 平台 | 移动 | 开火 | 其他 |
|---|---|---|---|
| 电脑 | `W A S D` / 方向键 | 自动瞄准最近敌人 | `P` 暂停、`M` 静音、`R` 战绩簿、`T` 重复提交验收、`空格` 开始/重开、`1 2 3` 选强化 |
| 手机 | 左下角虚拟摇杆 | 自动 | 下方按钮：暂停 / 音效 / 全屏 / 战绩簿；升级时点卡片 |

- 红色追击怪贴身扣血；紫色弹幕怪远程扇形开火，**碰到弹幕也扣血**，命中后 0.85 秒无敌帧。
- 捡青色经验宝石升级，9 种强化三选一。
- 共 10 波，1–2 波纯追击，第 3 波起加入弹幕怪，波间回 1 血。
- 第 10 波 Boss「弹幕领主」：环形弹幕每轮**留约 65° 安全缺口**且缺口旋转，穿插螺旋弹，阶段间 1.5 秒完全停火窗口；敌弹 5.5 秒消失、上限 300 发——密集但永远有路可走。
- **结算会自动保存一条战绩**到本机 `localStorage`，按 `R` 查看；重开网页数据仍在。

调试参数（网址后加）：`?wave=10` 直达 Boss｜`?fast=1` 加速刷怪｜`?god=1` 无敌练习走位。

---

## 四、课题文档：数据对象 / 接口 / 实测

| 问题 | 答案在 |
|---|---|
| 1 数据对象与字段（类型、必填、唯一、范围、存放位置） | `docs/schema.md` |
| 2 核心接口约定（请求 / 成功 / 失败示例） | `docs/api.md` |
| 3 实测结果（成功失败各一次、页面失败提示、重启持久化、违规拒绝） | `docs/实测报告.md` |
| 助手 / AIGC 条款适用性与三步产物追溯 | `docs/schema.md` 第三四节、`docs/provenance.md` |

**核心接口**：`RecordStore.submit(input)`，实现在 `src/record-store.js`。
命令行复现：

```bash
cd site
node tests/cli.js reset
node tests/cli.js submit '{"playerName":"元宝","waveReached":10,"result":"victory","kills":86,"level":7,"hpLeft":5,"maxhp":10,"upgrades":["dmg","multi","rate"],"durationSec":142.6,"source":"web"}'
node tests/cli.js list                       # 重启程序后数据仍在
node tests/cli.js wave 11                    # 返回「未收录」
```

页面复现：开局打完一局 → 按 `R` 打开战绩簿 → 按 `T` 重复提交最后一条，会看到红色提示「提交失败：战绩编号 … 已存在，不能重复提交同一条战绩。」

> 数据边界：无后端，战绩只存**本机浏览器**，换设备 / 清缓存后看不到，不同访客之间不共享。

---

## 五、更新版本

改完 `index.html` 或 `src/record-store.js` 后，把 `sw.js` 第一行缓存名换新的（如 `pixel-survivors-v3`），用户下次打开才会拉到新版本。

---

## 六、技术说明

- 渲染：480×300 低分辨率离屏 Canvas 放大 2 倍 → 像素颗粒感；HUD 用 960×600 清晰层。
- 自适应：`min(96vw, 960px, (100dvh - 118px) * 1.6)`，横竖屏与安全区都适配。
- 输入：Pointer Events 统一鼠标/触摸，`touch-action: none` 防误滚动。
- 存储：浏览器 `localStorage`（不可用则降级内存，并在战绩簿显示）；命令行走 `data/records.json` 文件适配器。
- 音效：WebAudio 实时合成，无音频文件。
- 兼容性：Chrome / Edge / Safari / Firefox 现代版本，无需 polyfill。
