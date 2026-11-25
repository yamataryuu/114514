/* 统一测试入口：node tests/run-all.js
   逐条跑 CLI 用例并断言错误码；任一不符即 exit 1。
   不删除用例、不放宽断言、不吞异常。 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const CLI = path.join(__dirname, 'cli.js');

function call(args) {
  const r = spawnSync(process.execPath, [CLI].concat(args), { encoding: 'utf8' });
  let j = null;
  try { j = JSON.parse(r.stdout); } catch (e) { j = { parseError: e.message, raw: r.stdout }; }
  return { exit: r.status, out: j };
}
const GOOD = JSON.stringify({
  playerName: '元宝', waveReached: 10, result: 'victory', kills: 86, level: 7,
  hpLeft: 5, maxhp: 10, upgrades: ['dmg', 'multi', 'rate'], durationSec: 142.6, source: 'web'
});
const cases = [];
function check(name, args, wantCode, wantExit, extra) {
  const r = call(args);
  const got = r.out && r.out.code;
  const pass = got === wantCode && r.exit === wantExit && (!extra || extra(r));
  cases.push({ name, wantCode, got, exit: r.exit, pass });
  return r;
}
check('复位（带确认）', ['reset', '--yes'], 'OK', 0);
const ok = check('提交合法战绩', ['submit', GOOD], 'OK', 0);
const rid = ok.out && ok.out.data && ok.out.data.runId;
check('重复编号被拒', ['submit', JSON.stringify(Object.assign(JSON.parse(GOOD), { runId: rid }))], 'DUPLICATE_RUN_ID', 1);
check('缺必填字段被拒', ['submit', JSON.stringify(Object.assign(JSON.parse(GOOD), { playerName: undefined }))], 'MISSING_FIELD', 1);
check('越界被拒', ['submit', JSON.stringify(Object.assign(JSON.parse(GOOD), { waveReached: 11 }))], 'OUT_OF_RANGE', 1);
check('字典未收录被拒', ['submit', JSON.stringify(Object.assign(JSON.parse(GOOD), { upgrades: ['laser'] }))], 'NOT_INDEXED', 1,
  r => r.out.mark === '未收录');
check('波次未收录', ['wave', '11'], 'NOT_INDEXED', 1, r => r.out.mark === '未收录');
check('查不到', ['get', 'R19990101000000-0000'], 'NOT_FOUND', 1);
check('清空未确认被拒', ['reset'], 'CONFIRM_REQUIRED', 1);
check('重启后仍在且未被误清', ['list'], 'OK', 0, r => r.out.count === 1);

cases.forEach(c => console.log((c.pass ? 'PASS ' : 'FAIL ') + c.name +
  '  code=' + c.got + ' exit=' + c.exit));
const failed = cases.filter(c => !c.pass);
console.log('\n' + (cases.length - failed.length) + '/' + cases.length + ' 通过');
if (failed.length) process.exit(1);
