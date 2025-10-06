const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public', 'lessons', 'social studies');
const files = fs.readdirSync(dir).filter(f => f.startsWith('3rd_') && f.endsWith('.json'));
let totalIssues = 0;
files.forEach(f => {
  const p = path.join(dir, f);
  try {
    const txt = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(txt);
    const issues = [];
    (j.fillintheblank || []).forEach(item => {
      const count = (item.expectedAny || []).length;
      if (count < 2) issues.push(`FITB too few answers (${count}) for question: ${item.question}`);
    });
    (j.shortanswer || []).forEach(item => {
      const count = (item.expectedAny || []).length;
      if (count < 3) issues.push(`SA too few answers (${count}) for question: ${item.question}`);
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
