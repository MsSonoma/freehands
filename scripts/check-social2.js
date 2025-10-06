const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public', 'lessons', 'social studies');
const files = fs.readdirSync(dir).filter(f => f.startsWith('2nd_') && f.endsWith('.json'));
let totalIssues = 0;
files.forEach(f => {
  const p = path.join(dir, f);
  try {
    const txt = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(txt);
    const vocab = (j.vocab || []).map(v => (v.term || '').toLowerCase());
    const issues = [];
    const checkList = [
      ...(j.fillintheblank || []).map(item => ({type:'FITB', question: item.question, count: (item.expectedAny||[]).length, values: item.expectedAny||[]})),
      ...(j.shortanswer || []).map(item => ({type:'SA', question: item.question, count: (item.expectedAny||[]).length, values: item.expectedAny||[]}))
    ];
    checkList.forEach(c => {
      if (c.type === 'FITB' && c.count < 2) {
        issues.push(`FITB too few answers (${c.count}) for question: ${c.question}`);
      }
      if (c.type === 'SA' && c.count < 3) {
        issues.push(`SA too few answers (${c.count}) for question: ${c.question}`);
      }
      // check vocab coverage for each expectedAny value
      c.values.forEach(val => {
        const vLower = (val||'').toLowerCase();
        const matchesVocab = vocab.some(t => vLower.includes(t) || t.includes(vLower));
        if (!matchesVocab) {
          issues.push(`Missing vocab reference for answer "${val}" in question: ${c.question}`);
        }
      });
    });
    if (issues.length) {
      console.log(f + ': ISSUES');
      issues.forEach(i => console.log('  - ' + i));
      totalIssues += issues.length;
    } else {
      console.log(f + ': OK');
    }
  } catch (e) {
    console.error(f + ': ERROR - ' + e.message);
    totalIssues += 1;
  }
});
console.log('\nTotal issues:', totalIssues);
process.exit(totalIssues>0?1:0);
