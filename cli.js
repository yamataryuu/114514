/* 命令行入口：node tests/cli.js <command> [payload]
   submit '<json>'  提交一条战绩（产物写入 data/records.json）
   list             列出全部战绩
   get <runId>      查一条
   wave <n>         查波次字典
   export           导出 JSON（产物路径 data/records.json）
   reset            清空（验收前复位用）
*/
'use strict';
const path = require('path');
const RS = require('../src/record-store.js');
const FILE = path.join(__dirname, '..', 'data', 'records.json');
const store = RS.createStore({ type: 'file', file: FILE });

const cmd = process.argv[2] || 'list';
let out;
try {
  switch (cmd) {
    case 'submit': {
      if (!process.argv[3]) { out = { ok: false, code: 'MISSING_FIELD', hint: '提交失败：缺少必填参数 <json>，请补齐后再提交。' }; break; }
      let input;
      try { input = JSON.parse(process.argv[3]); }
      catch (e) { out = { ok: false, code: 'TYPE_MISMATCH', hint: '提交失败：参数不是合法 JSON。' }; break; }
      out = store.submit(input);
      break;
    }
    case 'list':   out = { ok: true, code: 'OK', count: store.list().length, data: store.list() }; break;
    case 'get':    out = store.get(process.argv[3]); break;
    case 'wave':   out = store.wave(Number(process.argv[3])); break;
    case 'export': out = { ok: true, code: 'OK', path: 'data/records.json', data: JSON.parse(store.exportJSON()) }; break;
    case 'reset':  store.clear(); out = { ok: true, code: 'OK', hint: '已清空 data/records.json' }; break;
    default:       out = { ok: false, code: 'UNKNOWN_VALUE', hint: '未知命令：' + cmd };
  }
} catch (e) {
  out = { ok: false, code: 'STORAGE_FAILED', hint: '提交失败：本机存储不可用，战绩未写入。' };
}
console.log(JSON.stringify(out, null, 2));
process.exitCode = out && out.ok === false ? 1 : 0;
