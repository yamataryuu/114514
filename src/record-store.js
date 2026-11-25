/* ============================================================
   RecordStore · 战绩数据对象与字段校验
   纯前端静态站点模块：浏览器用 localStorage，命令行用 JSON 文件。
   字段定义见 docs/schema.md，接口约定见 docs/api.md。
   ============================================================ */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.RecordStore = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;
  var LS_KEY = 'pixel_survivors_records_v1';

  /* ---------- 静态字典（"材料条目"等价物，定义见 docs/schema.md） ---------- */
  var UPGRADE_CATALOG = [
    { id: 'dmg',          name: '锐化弹头' },
    { id: 'rate',         name: '急速扳机' },
    { id: 'multi',        name: '多重射击' },
    { id: 'speed',        name: '疾风靴' },
    { id: 'armor',        name: '强化护甲' },
    { id: 'pierce',       name: '穿甲弹' },
    { id: 'magnet',       name: '磁力立场' },
    { id: 'heal',         name: '急救包' },
    { id: 'bullet_speed', name: '高速弹' }
  ];
  var UPGRADE_IDS = UPGRADE_CATALOG.map(function (u) { return u.id; });

  var WAVE_CATALOG = {};
  for (var w = 1; w <= 10; w++) {
    WAVE_CATALOG[w] = {
      wave: w,
      chasers: 4 + Math.round(w * 1.8) + Math.floor(w * w * 0.12),
      shooters: w >= 3 ? 1 + Math.floor((w - 3) * 0.9) : 0,
      boss: w === 10
    };
  }

  var RESULTS = ['victory', 'defeat'];
  var SOURCES = ['web', 'debug'];
  var NAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]{1,12}$/;
  var RUNID_RE = /^R\d{14}-[0-9a-f]{4}$/;

  /* ---------- 错误码 → 给使用者看的提示文字 ---------- */
  var HINTS = {
    MISSING_FIELD:    '提交失败：缺少必填字段「%s」，请补齐后再提交。',
    TYPE_MISMATCH:    '提交失败：字段「%s」类型不正确，应为 %s。',
    OUT_OF_RANGE:     '提交失败：字段「%s」超出允许范围（%s）。',
    INVALID_RUN_ID:   '提交失败：战绩编号格式不正确，应为 R + 14 位时间 + 4 位十六进制。',
    UNKNOWN_VALUE:    '提交失败：字段「%s」取值未被接受，只能是 %s。',
    NOT_INDEXED:      '提交失败：强化「%s」未收录，请从升级字典中选择。',
    DUPLICATE_RUN_ID: '提交失败：战绩编号 %s 已存在，不能重复提交同一条战绩。',
    NOT_FOUND:        '查询失败：未收录该战绩编号 %s，没有找到对应记录。',
    STORAGE_FAILED:   '提交失败：本机存储不可用，战绩未写入，请检查浏览器隐私模式或磁盘权限。'
  };
  function fail(code, arg1, arg2) {
    var tpl = HINTS[code] || '提交失败：%s';
    var hint = tpl.replace('%s', arg1 == null ? '' : String(arg1));
    if (arg2 != null) hint = hint.replace('%s', String(arg2));
    return { ok: false, code: code, hint: hint.replace(/%s/g, ''), mark: code === 'NOT_INDEXED' || code === 'NOT_FOUND' ? '未收录' : '' };
  }
  function ok(data, hint) { return { ok: true, code: 'OK', data: data, hint: hint || '战绩已保存。' }; }

  /* ---------- 字段校验（规则与 docs/schema.md 一一对应） ---------- */
  var RANGES = {
    waveReached:  [1, 10],
    kills:        [0, 9999],
    level:        [1, 99],
    hpLeft:       [0, 30],
    maxhp:        [1, 30],
    durationSec:  [0, 7200]
  };
  var INT_FIELDS = ['waveReached', 'kills', 'level', 'hpLeft', 'maxhp'];
  var REQUIRED = ['playerName', 'waveReached', 'result', 'kills', 'level',
                  'hpLeft', 'maxhp', 'upgrades', 'durationSec', 'source'];

  function validate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('MISSING_FIELD', '整条战绩');
    for (var i = 0; i < REQUIRED.length; i++) {
      var f = REQUIRED[i];
      if (input[f] === undefined || input[f] === null || input[f] === '') return fail('MISSING_FIELD', f);
    }
    if (typeof input.playerName !== 'string') return fail('TYPE_MISMATCH', 'playerName', 'string');
    if (!NAME_RE.test(input.playerName)) return fail('OUT_OF_RANGE', 'playerName', '1–12 位中文/字母/数字/下划线');
    for (var j = 0; j < INT_FIELDS.length; j++) {
      var k = INT_FIELDS[j];
      if (typeof input[k] !== 'number' || !Number.isInteger(input[k])) return fail('TYPE_MISMATCH', k, 'integer');
      var r = RANGES[k];
      if (input[k] < r[0] || input[k] > r[1]) return fail('OUT_OF_RANGE', k, r[0] + '–' + r[1]);
    }
    if (input.hpLeft > input.maxhp) return fail('OUT_OF_RANGE', 'hpLeft', '不得大于 maxhp=' + input.maxhp);
    if (typeof input.durationSec !== 'number' || !isFinite(input.durationSec)) return fail('TYPE_MISMATCH', 'durationSec', 'number');
    if (input.durationSec < 0 || input.durationSec > 7200) return fail('OUT_OF_RANGE', 'durationSec', '0–7200，保留 1 位小数');
    if (RESULTS.indexOf(input.result) === -1) return fail('UNKNOWN_VALUE', 'result', RESULTS.join(' / '));
    if (SOURCES.indexOf(input.source) === -1) return fail('UNKNOWN_VALUE', 'source', SOURCES.join(' / '));
    if (!Array.isArray(input.upgrades)) return fail('TYPE_MISMATCH', 'upgrades', 'array<string>');
    if (input.upgrades.length > 20) return fail('OUT_OF_RANGE', 'upgrades', '最多 20 项');
    for (var m = 0; m < input.upgrades.length; m++) {
      if (typeof input.upgrades[m] !== 'string') return fail('TYPE_MISMATCH', 'upgrades[' + m + ']', 'string');
      if (UPGRADE_IDS.indexOf(input.upgrades[m]) === -1) return fail('NOT_INDEXED', input.upgrades[m]);
    }
    if (input.runId !== undefined && !RUNID_RE.test(input.runId)) return fail('INVALID_RUN_ID', input.runId);
    return null;
  }

  /* ---------- 存储适配器 ---------- */
  function memoryAdapter() {
    var a = [];
    return { label: 'memory', read: function () { return a.slice(); }, write: function (x) { a = x.slice(); } };
  }
  function browserAdapter() {
    try {
      var ls = (typeof window !== 'undefined' ? window : globalThis).localStorage;
      var probe = '__rs_probe__';
      ls.setItem(probe, '1'); ls.removeItem(probe);
      return {
        label: 'localStorage',
        read: function () {
          try { return JSON.parse(ls.getItem(LS_KEY) || '[]'); } catch (e) { return []; }
        },
        write: function (x) { ls.setItem(LS_KEY, JSON.stringify(x)); }
      };
    } catch (e) { return memoryAdapter(); }
  }
  function fileAdapter(file) {
    var fs = require('fs'), path = require('path');
    return {
      label: 'file:' + file,
      read: function () {
        try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return []; }
      },
      write: function (x) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(x, null, 2) + '\n', 'utf8');
      }
    };
  }

  /* ---------- 主接口 ---------- */
  function createStore(opts) {
    opts = opts || {};
    var ad;
    if (opts.type === 'file') ad = fileAdapter(opts.file || 'data/records.json');
    else if (opts.type === 'memory') ad = memoryAdapter();
    else if (opts.type === 'browser') ad = browserAdapter();
    else ad = (typeof window !== 'undefined' && window.localStorage) ? browserAdapter() : memoryAdapter();

    function newRunId(d) {
      var p = function (n) { return String(n).padStart(2, '0'); };
      return 'R' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
        p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + '-' +
        Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
    }

    return {
      label: ad.label,
      /* docs/api.md 约定的核心接口 */
      submit: function (input) {
        var err = validate(input);
        if (err) return err;
        var rows;
        try { rows = ad.read(); } catch (e) { return fail('STORAGE_FAILED'); }
        if (!Array.isArray(rows)) rows = [];
        var now = new Date();
        var runId = input.runId || newRunId(now);
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].runId === runId) return fail('DUPLICATE_RUN_ID', runId);
        }
        var record = {
          runId: runId,                          // 系统生成，唯一
          schemaVersion: SCHEMA_VERSION,        // 系统生成，固定 1
          createdAt: now.toISOString(),         // 系统生成，提交方不可覆盖
          playerName: input.playerName,
          waveReached: input.waveReached,
          result: input.result,
          kills: input.kills,
          level: input.level,
          hpLeft: input.hpLeft,
          maxhp: input.maxhp,
          upgrades: input.upgrades.slice(),
          durationSec: Math.round(input.durationSec * 10) / 10,
          source: input.source
        };
        rows.push(record);
        try { ad.write(rows); } catch (e) { return fail('STORAGE_FAILED'); }
        return ok(record, '战绩已保存：' + runId + '，重开网页仍可在「战绩簿」查看。');
      },
      list: function () { try { return ad.read(); } catch (e) { return []; } },
      get: function (runId) {
        var rows = this.list();
        for (var i = 0; i < rows.length; i++) if (rows[i].runId === runId) return ok(rows[i], '已找到战绩 ' + runId);
        return fail('NOT_FOUND', runId);
      },
      /* 波次字典查询：未定义波次返回「未收录」标记，不落库 */
      wave: function (n) {
        var c = WAVE_CATALOG[n];
        if (!c) return { ok: false, code: 'NOT_INDEXED', mark: '未收录',
          hint: '查询失败：第 ' + n + ' 波未收录，本游戏只定义 1–10 波。' };
        return ok(c, '已找到第 ' + n + ' 波配置。');
      },
      catalog: function () { return { upgrades: UPGRADE_CATALOG.slice(), waves: WAVE_CATALOG }; },
      exportJSON: function () { return JSON.stringify(this.list(), null, 2) + '\n'; },
      clear: function () { try { ad.write([]); } catch (e) {} }
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    LS_KEY: LS_KEY,
    UPGRADE_IDS: UPGRADE_IDS.slice(),
    createStore: createStore,
    validate: validate
  };
});
