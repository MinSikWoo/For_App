// Stop hook (project copy for cloud sessions): when context usage reaches the threshold,
// make Claude run this repo's /wrapup instructions once per session.
// On a PC that already has the personal hook (~/.claude/hooks/wrapup-at-60.js), this copy
// does nothing, so wrapup never runs twice.
// Settings via env: WRAPUP_THRESHOLD (default 0.6), WRAPUP_CONTEXT_WINDOW (default 1000000 tokens).
const fs = require('fs');
const os = require('os');
const path = require('path');

const THRESHOLD = parseFloat(process.env.WRAPUP_THRESHOLD || '0.6');
const WINDOW = parseInt(process.env.WRAPUP_CONTEXT_WINDOW || '1000000', 10);
const home = os.homedir();
const personalHook = path.join(home, '.claude', 'hooks', 'wrapup-at-60.js');
const projectDir = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..');
const commandFile = path.join(projectDir, '.claude', 'commands', 'wrapup.md');
const flagDir = path.join(os.tmpdir(), 'wrapup-done');

const CLEAR_NOTICE_INSTRUCTION = [
  '정리와 저장을 모두 마친 뒤, 답변 맨 끝에 아래 안내 블록을 글자 그대로 붙이세요. 말투 규칙과 상관없이 생략하거나 줄이지 마세요.',
  '',
  '---',
  '',
  '> ## 🚨 정리 완료: 새 대화로 이어 가세요 🚨',
  '> 정리 내용은 claude.md에 저장하고 깃허브에 올렸습니다. 새 대화에서도 이어집니다.',
  '> ⚠️ 이 대화에서는 자동 정리가 **다시 실행되지 않습니다.**',
].join('\n');

// Only the tail of the transcript is read, so the check stays fast even for long sessions.
function readTail(filePath, bytes) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function lastUsageTokens(transcriptPath) {
  const lines = readTail(transcriptPath, 2 * 1024 * 1024).split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i]) continue;
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }
    if (entry.isSidechain) continue;
    const u = entry.message && entry.message.usage;
    if (u) return (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  }
  return 0;
}

function wrapupPrompt() {
  const text = fs.readFileSync(commandFile, 'utf8');
  return text.replace(/^---[\s\S]*?---\s*/, '').replace('$ARGUMENTS', '').trim();
}

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  try {
    if (fs.existsSync(personalHook)) return;
    const input = JSON.parse(raw || '{}');
    if (input.stop_hook_active || !input.session_id || !input.transcript_path) return;
    const flag = path.join(flagDir, input.session_id);
    if (fs.existsSync(flag)) return;

    const used = lastUsageTokens(input.transcript_path) / WINDOW;
    if (used < THRESHOLD) return;

    fs.mkdirSync(flagDir, { recursive: true });
    fs.writeFileSync(flag, new Date().toISOString());
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `[자동 /wrapup] context 사용량이 약 ${Math.round(used * 100)}%에 도달했습니다. 아래 지시를 지금 실행하세요.\n\n${wrapupPrompt()}\n\n${CLEAR_NOTICE_INSTRUCTION}`,
      systemMessage: `context ${Math.round(used * 100)}% 도달 — /wrapup 자동 실행 중.`,
    }));
  } catch (e) {
    process.stderr.write(`wrapup-at-60 hook error: ${e.message}\n`);
  }
});
