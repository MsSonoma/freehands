/* Standalone syntax and CSS verification when the full build is blocked by unrelated changes. */
const fs = require('node:fs')
const path = require('node:path')
const swc = require('next/dist/build/swc')
const postcss = require('postcss')

const root = path.resolve(__dirname, '..')
const jsx = [
  'src/components/math/VerticalAdditionWorkspace.jsx',
  'src/app/tools/vertical-addition/page.jsx',
]
const css = [
  'src/components/math/VerticalAdditionWorkspace.module.css',
  'src/app/tools/vertical-addition/page.module.css',
]

for (const file of jsx) {
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
for (const file of css) {
  const filename = path.join(root, file)
  postcss.parse(fs.readFileSync(filename, 'utf8'), { from: filename })
  console.log('CSS parsed:', file)
}
