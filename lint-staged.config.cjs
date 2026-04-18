const path = require('path')

const root = process.cwd()
const frontendRoot = path.join(root, 'frontend')

module.exports = {
  'frontend/**/*.{ts,tsx}': (filenames) => {
    if (filenames.length === 0) return []
    const rel = filenames.map((f) =>
      path.relative(frontendRoot, path.resolve(root, f)).replace(/\\/g, '/'),
    )
    return [`npm run lint:staged --prefix frontend -- ${rel.map((f) => `"${f}"`).join(' ')}`]
  },
  'shared/**/*.ts': ['npm run build --prefix shared'],
}
