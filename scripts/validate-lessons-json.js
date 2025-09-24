const fs = require('fs');
const path = require('path');
const files = [
  'public/lessons/math/Multiply_1_Digit_Numbers_Beginner.json',
  'public/lessons/math/Multiply_2_Digit_Numbers_Intermediate.json',
  'public/lessons/math/Multiply_3_Digit_Numbers_Advanced.json',
  'public/lessons/science/Water_Cycle_Beginner.json',
  'public/lessons/science/Water_Cycle_Intermediate.json',
  'public/lessons/science/Water_Cycle_Advanced.json',
  'public/lessons/social studies/Money_&_Currency_Beginner.json',
  'public/lessons/social studies/Money_&_Currency_Intermediate.json',
  'public/lessons/social studies/Money_&_Currency_Advanced.json'
];
let ok = true;
files.forEach(f => {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    JSON.parse(txt);
    console.log(f + ': OK');
  } catch (e) {
    console.error(f + ': ERROR -', e.message);
    ok = false;
  }
});
process.exit(ok ? 0 : 1);
