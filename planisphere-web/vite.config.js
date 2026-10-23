import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

function bundledLicenses() {
	const notices = ['react', 'react-dom', 'scheduler', 'lucide-react'].map((name) =>
		`${name}\n${readFileSync(new URL(`./node_modules/${name}/LICENSE`, import.meta.url), 'utf8')}`,
	)
	const astronomySource = readFileSync(new URL('./node_modules/astronomy-engine/astronomy.browser.js', import.meta.url), 'utf8')
	notices.push(astronomySource.slice(astronomySource.indexOf('/**'), astronomySource.indexOf('*/') + 2))
	notices.push(`d3-celestial catalogue\n${readFileSync(new URL('./public/data/LICENSE-d3-celestial.txt', import.meta.url), 'utf8')}`)
	return {
		name: 'bundled-licenses',
		transformIndexHtml: {
			order: 'post',
			handler: () => [{
				tag: 'script',
				attrs: { type: 'text/plain', id: 'third-party-licenses' },
				children: notices.join('\n\n').replaceAll('</script', '<\\/script'),
				injectTo: 'head',
			}],
		},
	}
}

export default defineConfig(({ mode }) => ({
	base: './',
	plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : []), bundledLicenses()],
	build: { outDir: mode === 'singlefile' ? 'dist-singlefile' : 'dist' },
	...(mode === 'singlefile' ? { publicDir: false } : {}),
}))