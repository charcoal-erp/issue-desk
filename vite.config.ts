/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter()
		})
	],
	test: {
		include: ['tests/**/*.test.ts'],
		env: {
			// $env/dynamic/private snapshots at first import, so tests share one
			// DATA_DIR and reseed it per test instead of using per-test tmp dirs.
			DATA_DIR: '/tmp/issuedesk-vitest-data'
		}
	}
});
