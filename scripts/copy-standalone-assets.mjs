import fs from 'node:fs'

fs.cpSync('.next/static', '.next/standalone/.next/static', { recursive: true })
fs.cpSync('public', '.next/standalone/public', { recursive: true })
