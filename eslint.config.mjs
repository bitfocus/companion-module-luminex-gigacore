import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default generateEslintConfig({
	enableTypescript: true,
	ignores: ['dist/**', 'node_modules/**', '.yarn/**', '.pnp.cjs', '.pnp.loader.mjs'],
})
