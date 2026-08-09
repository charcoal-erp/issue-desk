# Deployment & Operations Guide

How to run IssueDesk in development, expose it under a real domain, run it in production, and
keep it running across machine reboots. See [README.md](README.md) for the app overview and
[docs/IssueDesk-Design-Document.md](docs/IssueDesk-Design-Document.md) for the full design.

## Development

```bash
npm install
npm run dev        # dev server on http://localhost:5173
```

Populate test issues on demand with the Python simulators (see [README.md](README.md#run) for
what gets seeded automatically vs. what these create):

```bash
python simulators/charcoal_simulator.py
python simulators/drishti_simulator.py
```

## Production (manual)

```bash
npm run build
node build          # adapter-node server on PORT (default 3000)
```

`node build` only sees real process environment variables — it does **not** read a `.env` file
on its own. If you keep your config in `.env` (see [Environment variables](#environment-variables)
below), load it into the shell before starting:

```bash
export $(grep -v '^#' .env | xargs) && node build
```

or, without touching the current shell's environment:

```bash
env $(grep -v '^#' .env | xargs) node build
```

Rebuild and restart after every code change — `node build` runs whatever was last built by
`npm run build`, it does not pick up source changes on its own.

## Exposing a custom domain

Two independent things need to agree on the domain you're serving from:

1. **Vite's dev-server host check.** Vite refuses requests whose `Host` header isn't recognised
   (protects against DNS-rebinding). If you access the *dev* server through a domain other than
   `localhost`, add it to `server.allowedHosts` in [vite.config.ts](vite.config.ts):

   ```ts
   server: {
     allowedHosts: ['issue-desk.codecoords.com', 'localhost', '127.0.0.1']
   }
   ```

   This only matters for `npm run dev` / `vite preview`. The built production server
   (`node build`) has no host allowlist.

2. **`PUBLIC_BASE_URL`.** Issue exports (Markdown/JSON) embed *absolute* attachment URLs, built
   by prefixing each attachment's relative path with this value (see
   [src/lib/export/context.ts](src/lib/export/context.ts) and
   [src/routes/api/export/+server.ts](src/routes/api/export/+server.ts)). Set it to whatever
   hostname the app is actually reachable at, e.g.:

   ```
   PUBLIC_BASE_URL=https://issue-desk.codecoords.com
   ```

   Left unset, it defaults to `http://localhost:5173` and exported attachment links will be
   unreachable to anyone off the machine.

### A SvelteKit gotcha worth knowing

`PUBLIC_BASE_URL` is read in [src/lib/server/fs/paths.ts](src/lib/server/fs/paths.ts). SvelteKit
splits runtime env into `$env/dynamic/private` and `$env/dynamic/public`, and — by convention —
**excludes any `PUBLIC_`-prefixed variable from the private module**, even though the private
module is the one server code reaches for by default. `publicBaseUrl()` therefore reads
`$env/dynamic/public` explicitly (falling back to raw `process.env`, which is unfiltered) rather
than only the private module. If you ever add another `PUBLIC_*` variable read from server code,
remember it won't show up via `$env/dynamic/private` no matter what your `.env` says.

Separately, **a bare `.env` file is not enough** to get a variable into `process.env` for either
`vite dev` or `node build` — see the loading options above and in
[Running as a systemd service](#running-as-a-systemd-service).

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `./data` | Root of all config / issues / uploads |
| `PUBLIC_BASE_URL` | `http://localhost:5173` | Host used to absolutise attachment URLs in exports |
| `ORIGIN` | _(unset)_ | The URL the app is served from. Required in production for the login form to be accepted — see [Authentication](#authentication) |
| `MAX_UPLOAD_MB` | `15` | Per-file size cap |
| `MAX_ATTACHMENTS` | `10` | Per-issue attachment cap |
| `WATCH_FILES` | `false` | Re-sync the store when config / issue files are edited by hand |
| `AUTH_JWT_SECRET` | _(generated)_ | Signing secret for session cookies and API tokens — see [Authentication](#authentication) |
| `AUTH_TOKEN_TTL_HOURS` | `12` | How long an issued token stays valid |
| `ISSUEDESK_ADMIN_PASSWORD` | _(generated)_ | First-boot admin password; unset = generated and printed to the log once |
| `CHECKPOINT_URL` | _(unset)_ | Optional Checkpoint base URL for the "view test case" back-link |
| `ISSUEDESK_INGEST_TOKEN` | _(unset)_ | Optional bearer token accepted on `POST /api/issues` in place of a login |
| `PORT` | `3000` | adapter-node port |
| `BODY_SIZE_LIMIT` | `512K` | adapter-node request-body cap. Raise it (e.g. `512M`, or `Infinity`) or `POST /api/data/import` and attachment uploads larger than 512 KB will be rejected before the app sees them |

`DATA_DIR` is resolved relative to the process's working directory, so whatever starts the
server (shell, systemd, Docker, ...) needs its working directory set to the project root — see
`WorkingDirectory` in the systemd unit below.

## Authentication

Every route — pages and API alike — requires a signed-in account. The browser holds the token in
an httpOnly cookie; API clients send it as `Authorization: Bearer …`. See
[docs/AGENT-API.md](docs/AGENT-API.md) for the API side.

Three deployment concerns:

1. **`AUTH_JWT_SECRET`.** Left unset, the server generates a secret on first boot and persists it
   to `data/auth/jwt-secret.json` (0600), so tokens survive restarts with no setup. **Set it
   explicitly if you ever run more than one instance** against separate data dirs — otherwise each
   generates its own secret and rejects tokens minted by the other. Deleting the file rotates the
   secret and signs everyone out.

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```

2. **The first admin.** A fresh `DATA_DIR` has no passwords, so nobody could sign in. On a boot
   with no credentials at all, the server promotes the first account to admin and gives it a
   password — `ISSUEDESK_ADMIN_PASSWORD` when set, otherwise a generated one printed to the log
   **once**:

   ```bash
   journalctl -u issue-desk | grep -A2 "First run"
   ```

   Under systemd, prefer setting `ISSUEDESK_ADMIN_PASSWORD` in the `EnvironmentFile` for the
   first boot so the password is never only in the journal. The bootstrap is skipped as soon as
   any account has a password, so it cannot reset a running deployment.

3. **`ORIGIN` (or `PROTOCOL_HEADER`/`HOST_HEADER` behind a proxy).** adapter-node rejects form
   submissions whose `Origin` does not match what it believes it is serving — which, once there is
   a login *form*, means an unset `ORIGIN` shows up as "Cross-site POST form submissions are
   forbidden" at sign-in. Set it to the same URL as `PUBLIC_BASE_URL`:

   ```
   ORIGIN=https://issue-desk.codecoords.com
   ```

   Behind a reverse proxy that terminates TLS, either set `ORIGIN` or forward the original host
   and protocol and tell adapter-node to trust them (`PROTOCOL_HEADER=x-forwarded-proto`,
   `HOST_HEADER=x-forwarded-host`).

**Credentials on disk.** scrypt digests live in `data/auth/credentials.json` at mode 0600,
alongside the signing secret. `data/auth/` sits outside the roots that `/api/data/export`
collects, so credentials are never part of a data export or an import — moving data between
instances moves issues and config, not passwords.

## Running as a systemd service

To have IssueDesk start automatically on boot and restart if it crashes, run it under systemd.

**1. Build once** (and again after every future code change):

```bash
cd /home/kiran/projects/issue-desk
npm run build
```

**2. Create the unit file** — `EnvironmentFile` loads `.env` straight into the process's real
environment, sidestepping the `.env`-loading gotcha above entirely:

```bash
sudo tee /etc/systemd/system/issue-desk.service > /dev/null <<'EOF'
[Unit]
Description=IssueDesk
After=network.target

[Service]
Type=simple
User=kiran
WorkingDirectory=/home/kiran/projects/issue-desk
EnvironmentFile=/home/kiran/projects/issue-desk/.env
ExecStart=/home/kiran/.nvm/versions/node/v26.4.0/bin/node build
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

**3. Enable and start it:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now issue-desk
```

**4. Check it's running:**

```bash
systemctl status issue-desk
journalctl -u issue-desk -f      # tail logs
```

**Redeploying after a code change:**

```bash
git pull
npm run build
sudo systemctl restart issue-desk
```

### Notes / gotchas

- **Node path is version-pinned.** `ExecStart` points at a specific `nvm`-managed Node binary
  (`~/.nvm/versions/node/v26.4.0/bin/node`), because non-interactive systemd services don't run
  through nvm's shell init and won't find `node` on `PATH` otherwise. If you `nvm install` a
  newer version and switch to it, update `ExecStart` (or point it at a stable symlink such as
  `nvm alias default` produces) or the service will fail to start after the next reboot.
- **`WorkingDirectory` matters.** `DATA_DIR=./data` and the build output are resolved relative to
  the process's cwd — systemd's `WorkingDirectory` is what makes that resolve correctly.
- **Runs as your user, not root.** `User=kiran` keeps file ownership under `data/` and `build/`
  consistent with what you get from running `npm run build` / `node build` by hand.
