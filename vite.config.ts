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
	server: {
		allowedHosts: ['issue-desk.charqol.com', 'localhost', '127.0.0.1']
	},
	test: {
		include: ['tests/**/*.test.ts'],
		// Aborts the run if DATA_DIR still points inside the repo (see .env.test).
		setupFiles: ['tests/setup.ts'],
		env: {
			// $env/dynamic/private snapshots at first import, so tests share one
			// DATA_DIR and reseed it per test instead of using per-test tmp dirs.
			// .env.test sets this too — $env reads that, not process.env.
			DATA_DIR: '/tmp/issuedesk-vitest-data'
		}
	}
});
