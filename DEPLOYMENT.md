# Deploy the full MCCIA HR Studio app

## Prepared configuration

`render.yaml` runs the website and its Express API together, with SQLite on a persistent disk. Open the Render service URL for the full app; the existing Vercel deployment publishes only the frontend.

| Setting         | Value                                             |
| --------------- | ------------------------------------------------- |
| Repository      | `mcciaexplore-netizen/HR-Studio`                  |
| Branch          | `feat/mccia-msme-hr-studio`                       |
| Service         | `mccia-hr-studio`, native Node.js 24.16.0         |
| Region          | Singapore                                         |
| Compute         | One instance, 0.5 CPU / 512 MB, plan `0.5c-512mb` |
| Persistent disk | 1 GB mounted at `/var/data`                       |
| Database        | `/var/data/hrstudio.sqlite`                       |
| Build           | `npm ci --include=dev && npm run build`           |
| Start           | `npm run start:hosted`                            |
| Health check    | `/api/health`                                     |
| Releases        | Manual; automatic deploys are disabled            |

**Estimated hosting: US$7.25/month** ($7 compute + $0.25 for 1 GB disk), before tax, additional usage and any workspace subscription. This is the small demo/pilot configuration, not a load-tested capacity recommendation. Confirm the provider's displayed charges before creating it. Rates checked on 16 September 2026 against [Render pricing](https://render.com/pricing).

The files in this repository prepare deployment; they do not create a Render account, paid service or public URL. Singapore is the selected storage location. Choose a different host before uploading real records if India-only storage is required.

## Create the service

1. Sign in to the intended [Render account](https://dashboard.render.com/) and connect a GitHub account with access to the repository.
2. Select **New → Blueprint**, choose the repository, and select `feat/mccia-msme-hr-studio`. Use the root `render.yaml` file.
3. Review the service, region, disk and recurring price before applying. If a service already has the name `mccia-hr-studio`, review the proposed changes carefully or use a new unique name.
4. Apply the Blueprint after approval. The build installs dependencies and compiles the UI, server, Excel worker and demo provisioner. Database initialization happens at runtime, when the persistent disk is mounted.
5. Wait for a healthy deployment and open the service's HTTPS `onrender.com` URL. Hosted startup obtains this address from Render's `RENDER_EXTERNAL_URL`; no guessed hostname is needed.
6. Check `/api/health` returns `{"status":"ok"}`. Try the **Admin**, **HR** and **Employee** demo buttons. Add a fictional record, restart the service, and confirm it remains.

Do not choose a Static Site or a free web instance for this configuration. A paid web service is needed for an attached disk. See [Render disk behaviour](https://render.com/docs/disks) and the [Blueprint reference](https://render.com/docs/blueprint-spec).

## Demo initialization and private companies

The Blueprint enables `DEMO_BOOTSTRAP=true` and `DEMO_LOGIN_ENABLED=true`:

- On an empty database, startup creates the fictional `mccia-demo` workspace and the three demo roles. No password is printed to hosting logs.
- On later starts, provisioned samples are left unchanged, including user edits and disabled accounts. Interrupted initial provisioning can resume after verifying the fictional workspace's creation audit.
- An existing ordinary company database is skipped. An ordinary company using the reserved demo slug is rejected rather than made public.
- `REGISTRATION_OPEN=false` closes new-company registration. Demo access cannot send email, invoke AI, change account security or create integration keys.

Demo visitors share fictional records and can change them. Do not enter real employee information into the demo workspace.

For a private company, use a separate service/database with `DEMO_BOOTSTRAP=false` and `DEMO_LOGIN_ENABLED=false`. Arrange controlled initial company registration, then return `REGISTRATION_OPEN` to `false`. Merely hiding demo buttons does not turn demo accounts into private accounts. The current setup creates new synthetic samples; it does not upload the local database or `.env.local`.

## Environment and custom domains

Configure environment values in Render, not in tracked files. The Blueprint supplies the database path, secure cookies, closed registration, and demo switches. The host supplies `PORT`; the server binds `HOST=0.0.0.0`.

For a custom domain, configure its DNS and certificate in Render, then set `APP_URL` to its exact HTTPS origin, for example `https://hr.example.com`. Sign in through that address. Browser writes from another origin are rejected, including the default Render address after `APP_URL` is overridden. Hosted startup rejects HTTP origins, URL credentials, public database paths and disabled secure cookies.

Optional SMTP/Gemini secrets remain unset unless explicitly configured. The app currently applies a conservative login attempt limit using the connection IP; behind a shared proxy, visitors can share that limit. Validate the host's trusted proxy chain before enabling client-IP forwarding for a wider rollout. Do not blindly trust arbitrary forwarded headers.

## Updates, persistence and recovery

After pushing a tested commit to the configured branch, use **Manual Deploy → Deploy latest commit**. Keep the disk attached and the database path unchanged. A persistent-disk service uses a single instance and can have a brief interruption during deployment. A code rollback does not roll back database changes.

The disk holds records, uploaded files and sessions. It is not a substitute for a recoverable backup. Before real use, configure protected off-host backups and test restoration. For an offline backup on a server you control, stop the app cleanly and copy the entire database directory, including any remaining WAL/SHM files. On a managed host, use a SQLite-consistent backup process with access to the mounted disk and export it securely; do not copy a live `.sqlite` file alone or use a disk snapshot as an untested database recovery plan. Do not delete the disk or database to troubleshoot startup.

For another Linux server, install Node.js 24.x, build the repository, mount durable storage, and run `npm run start:hosted` under a service supervisor. Supply an absolute `DATABASE_PATH`, HTTPS `APP_URL`, `COOKIE_SECURE=true` and `HOST=0.0.0.0`. Terminate TLS at a reverse proxy and restrict direct access to the application port. The startup validator checks configuration, not whether your filesystem is physically persistent.

## Verification before release

```sh
npm run lint
npm test
npm run build
npm run test:production
npm run test:hosted
```

The hosted smoke test uses its own temporary database and child processes. It checks demo access, secure cookie attributes, HTTPS origin validation, private-file protection, and saved records plus sessions across a process restart. It does not access a Render account or prove the remote disk mount; complete step 6 after the actual deployment.

The wider functional and rollout limitations remain in [README.md](README.md).
