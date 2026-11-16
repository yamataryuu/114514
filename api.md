# 核心接口约定（课题第 2 问）

> **约定文件的位置：`docs/api.md`**（本文件）
> 实现：`src/record-store.js`｜字段定义：`docs/schema.md`｜实测：`docs/实测报告.md`

## 一、挑定的主路径关键一步

主路径 = 打开网页 → 开局 → 打 10 波 → **结算提交战绩** → 重开网页查看。
最关键的一步是 **「提交一条战绩」**：它同时承载全部字段规则、唯一性约束、持久化写入和失败反馈。

接口名：**`RecordStore.submit(input)`**
约定形式：**函数调用 + 命令行参数与产物路径 + 页面提交**（本项目为纯静态站点，无服务端 HTTP 接口）。

---

## 二、请求

### 调用方式（三种等价入口）

| 入口 | 写法 |
|---|---|
| 网页自动提交 | 玩家死亡 / 击破 Boss 时由 `index.html` 自动调用 `saveCurrentRun()`，无需手工传参 |
| 浏览器控制台 / 页面 | `RecordStore.createStore().submit({ ... })`；页面按 `R` 打开战绩簿、按 `T` 重复提交最后一条 |
| 命令行 | `node tests/cli.js submit '<json字符串>'`，产物写入 **`data/records.json`** |

### 参数 `input`（对象）

| 参数 | 类型 | 必填 | 规则 |
|---|---|---|---|
| `playerName` | string | 是 | 1–12 位中文/字母/数字/下划线 |
| `waveReached` | integer | 是 | 1–10 |
| `result` | string | 是 | `victory` / `defeat` |
| `kills` | integer | 是 | 0–9999 |
| `level` | integer | 是 | 1–99 |
| `hpLeft` | integer | 是 | 0–30，且 ≤ `maxhp` |
| `maxhp` | integer | 是 | 1–30 |
| `upgrades` | array\<string\> | 是 | ≤20 项，每项须在 9 个已收录 id 内 |
| `durationSec` | number | 是 | 0–7200（写入保留 1 位小数） |
| `source` | string | 是 | `web` / `debug` |
| `runId` | string | 否 | 若自带须匹配 `^R\d{14}-[0-9a-f]{4}$`；**重复即失败** |

> `createdAt` / `schemaVersion` **不接受请求方赋值**，一律由系统生成并覆写。

**请求示例（命令行）**
```bash
node tests/cli.js submit '{"playerName":"元宝","waveReached":10,"result":"victory","kills":86,"level":7,"hpLeft":5,"maxhp":10,"upgrades":["dmg","multi","rate"],"durationSec":142.6,"source":"web"}'
```

---

## 三、成功

**返回字段**

| 字段 | 说明 |
|---|---|
| `ok` | `true` |
| `code` | `"OK"` |
| `hint` | 给使用者看的中文提示 |
| `data.runId` | 系统生成/确认的唯一编号 |
| `data.schemaVersion` | `1` |
| `data.createdAt` | ISO 8601 UTC 写入时间 |
| `data.playerName` … `data.source` | 落库后的完整记录（字段见 `docs/schema.md`） |

CLI 退出码 `0`；产物追加一行到 `data/records.json`。

**成功示例（真实返回结构）**
```json
{
  "ok": true,
  "code": "OK",
  "data": {
    "runId": "R20261116131022-4a1f",
    "schemaVersion": 1,
    "createdAt": "2026-11-16T13:10:22.418Z",
    "playerName": "元宝",
    "waveReached": 10,
    "result": "victory",
    "kills": 86,
    "level": 7,
    "hpLeft": 5,
    "maxhp": 10,
    "upgrades": ["dmg", "multi", "rate"],
    "durationSec": 142.6,
    "source": "web"
  },
  "hint": "战绩已保存：R20261116131022-4a1f，重开网页仍可在「战绩簿」查看。"
}
```

---

## 四、失败（均为本项目实际会发生的情况）

统一返回 `{ ok:false, code, hint, mark? }`；CLI 退出码 `1`；**不写入任何数据**。
`hint` 即页面上直接显示给使用者看的提示文字（红色提示条）。

| code | 触发条件 | 给使用者看的提示文字 |
|---|---|---|
| `DUPLICATE_RUN_ID` | 重复提交同一 `runId`（页面按 `T` 必现） | `提交失败：战绩编号 R… 已存在，不能重复提交同一条战绩。` |
| `MISSING_FIELD` | 缺任一必填字段，或命令行没带 JSON 参数 | `提交失败：缺少必填字段「kills」，请补齐后再提交。` |
| `OUT_OF_RANGE` | `waveReached:11`、`kills:-1`、`hpLeft>maxhp` 等 | `提交失败：字段「waveReached」超出允许范围（1–10）。` |
| `NOT_INDEXED` | `upgrades` 出现字典外 id，或查询第 11 波；返回带 `mark:"未收录"` | `提交失败：强化「laser」未收录，请从升级字典中选择。` |
| `UNKNOWN_VALUE` | `result` / `source` 不在枚举内 | `提交失败：字段「result」取值未被接受，只能是 victory / defeat。` |
| `TYPE_MISMATCH` | 参数不是合法 JSON、字段类型不符 | `提交失败：参数不是合法 JSON。` |
| `NOT_FOUND` | `get(runId)` 查不到 | `查询失败：未收录该战绩编号 …，没有找到对应记录。` |
| `STORAGE_FAILED` | 隐私模式 / 磁盘不可写 | `提交失败：本机存储不可用，战绩未写入，请检查浏览器隐私模式或磁盘权限。` |

**失败示例 1：重复提交（页面按 `T`）**
```json
{
  "ok": false,
  "code": "DUPLICATE_RUN_ID",
  "hint": "提交失败：战绩编号 R20261116131022-4a1f 已存在，不能重复提交同一条战绩。",
  "mark": ""
}
```

**失败示例 2：缺必填字段**
```json
{
  "ok": false,
  "code": "MISSING_FIELD",
  "hint": "提交失败：缺少必填字段「playerName」，请补齐后再提交。",
  "mark": ""
}
```

**失败示例 3：未收录**
```json
{
  "ok": false,
  "code": "NOT_INDEXED",
  "hint": "查询失败：第 11 波未收录，本游戏只定义 1–10 波。",
  "mark": "未收录"
}
```

---

## 五、静态资源层约定（补充）

站点本身是 HTTP GET 静态文件，约定：

| 情况 | 状态 | 使用者看到的 |
|---|---|---|
| `GET /114514/`（含 `index.html`、`src/record-store.js`） | `200` | 正常游戏页面 |
| `GET` 不存在的路径 | `404` | GitHub Pages 的 "404 File not found" |
| `GET /data/records.json` | 本地静态服务实测 `200`（仓库内的样本产物文件）；线上若未上传 `data/` 目录则 `404` | 该文件只是命令行实测产物样本，**网页运行时不读写它**，网页数据一律在浏览器 `localStorage` |

---

## 六、其他配套接口（非核心，列出便于复现实测）

```
store.list()                 → { ok:true, code:'OK', count, data:[...] }
store.get(runId)             → ok(record) 或 NOT_FOUND
store.wave(n)                → ok(配置) 或 NOT_INDEXED + mark:'未收录'
store.exportJSON()           → 完整 JSON 字符串（产物 data/records.json）
tests/cli.js reset           → 清空记录表（验收前复位）
```
