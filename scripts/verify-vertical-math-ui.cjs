/* Compile the shared arithmetic UI without traversing unrelated game routes. */
const fs = require('node:fs')
const path = require('node:path')
const swc = require('next/dist/build/swc')
const postcss = require('postcss')
const root = path.resolve(__dirname, '..')

for (const file of [
  'src/components/math/VerticalMathWorkspace.jsx',
  'src/components/math/VerticalAdditionWorkspace.jsx',
  'src/app/tools/vertical-addition/page.jsx',
  'src/app/tools/vertical-subtraction/page.jsx',
  'src/app/tools/vertical-multiplication/page.jsx',
  'src/app/tools/vertical-division/page.jsx',
]) {
  const filename = path.join(root, file)
  const output = swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: {
      parser: { syntax: 'ecmascript', jsx: true },
      transform: { react: { runtime: 'automatic' } },
    },
    module: { type: 'commonjs' },
  })
  if (!output.code || output.code.length < 100) throw new Error('Transpilation failed: ' + file)
  console.log('SWC compiled:', file)
}
for (const file of [
  'src/components/math/VerticalMathWorkspace.module.css',
  'src/app/tools/vertical-addition/page.module.css',
]) {
  const filename = path.join(root, file)
  postcss.parse(fs.readFileSync(filename, 'utf8'), { from: filename })
  console.log('CSS parsed:', file)
}
