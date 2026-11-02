# Self-hosting on a free server ($0/month)

Everything runs on one server you control: PostgreSQL, the app, automatic HTTPS (Caddy + Let's Encrypt) and nightly database backups. No Supabase, no paid database, no paid hosting.

**Recommended free server: Oracle Cloud "Always Free"**
- Ampere A1: up to 4 CPUs / 24 GB RAM, plus 200 GB of disk and 20 GB of object storage, free indefinitely.
- Commercial use is allowed.
- Oracle asks for a card for identity verification. Always Free resources are not charged.

> Vercel's free Hobby plan is for non-commercial personal use only, so it isn't used for production.

---

## 1. Create the server (≈15 min)
1. Sign up at **cloud.oracle.com**. Pick a nearby home region, e.g. *US Midwest (Chicago)*. This can't be changed later.
2. Go to **Compute → Instances → Create instance**:
   - Image: **Canonical Ubuntu 24.04**
   - Shape: **Ampere → VM.Standard.A1.Flex**, 2 OCPU / 12 GB (inside the free limit)
   - Networking: keep "Assign a public IPv4 address" on
   - SSH keys: upload your public key, or download the generated private key
3. Open web ports: **Networking → Virtual cloud networks → your VCN → Security Lists → Default → Add Ingress Rules**, Source CIDR `0.0.0.0/0`, TCP, destination ports **80** and **443**.
4. Note the instance's **public IP**.

If A1 capacity is "out of host capacity", retry later or choose another availability domain.

## 2. Point a domain at it (free)
At your domain registrar, add an **A record**, e.g. `acq.homebuyersict.com` → the public IP.

## 3. Install the app (≈10 min)
```bash
ssh ubuntu@<public-ip>
git clone https://github.com/franklinhomesict/dealvelocity.git acquisition-os
cd acquisition-os
sudo ./deploy/setup.sh acq.homebuyersict.com you@yourdomain.com
```
For the private repo, `git clone` asks for a GitHub username and a **fine-grained personal access token** with read-only *Contents* access to this repo.

`setup.sh` installs Docker, opens ports 80/443 in Ubuntu's firewall, generates the database password and session secret into `.env.production` (readable only by root), then builds and starts the stack.

## 4. Create your login
```bash
sudo docker compose --env-file .env.production exec -e NEW_USER_PASSWORD='a-long-password' \
  app npx tsx scripts/create-user.ts you@yourdomain.com "Your Name" owner
```
Open `https://acq.homebuyersict.com`. The certificate is issued automatically on first visit.

## 5. Load your leads
From your computer, copy the private lead file up. Then import it from the server:
```bash
scp data/private/lookalike-leads-2026-10-31.json ubuntu@<public-ip>:~/acquisition-os/
sudo docker compose --env-file .env.production cp lookalike-leads-2026-10-31.json app:/tmp/leads.json
sudo docker compose --env-file .env.production exec app npx tsx scripts/import-leads.ts /tmp/leads.json
```
Re-running is safe: nothing is duplicated.

## 6. Connect DealMachine
Edit `.env.production`: set `DEALMACHINE_API_KEY`, and `DEALMACHINE_WEBHOOK_SECRET` once the webhook is registered for `https://<domain>/api/webhooks/dealmachine`. Then:
```bash
sudo docker compose --env-file .env.production up -d
```

---

## Day-to-day

| Task | Command (in `~/acquisition-os`) |
|---|---|
| Update to latest code | `git pull && sudo docker compose --env-file .env.production up -d --build` |
| Status | `sudo docker compose --env-file .env.production ps` |
| App logs | `sudo docker compose --env-file .env.production logs -f app` |
| Backup log | `sudo docker compose --env-file .env.production logs backup` |
| Restore a backup | `sudo ./deploy/restore.sh backups/acq_os-YYYYmmdd-HHMMSS.dump` |

Database migrations run automatically every time the app starts.

## Backups
- A full `pg_dump` runs at startup and **nightly at 2:30 am Central**, kept 14 days in `~/acquisition-os/backups/`.
- `restore.sh` keeps the previous database as `acq_os_before_restore_*` until you drop it.
- **Off-server copy (recommended, still free):** download backups to your computer weekly:
  `scp -r ubuntu@<public-ip>:~/acquisition-os/backups ./acq-backups`.
  Or copy them to Oracle Object Storage (20 GB free) with the OCI CLI.

## Things to know
- **Idle reclamation:** Oracle may reclaim Always Free instances that sit nearly idle for 7 days. Upgrading the account to *Pay As You Go* stops this, and you are still not charged while you stay within the Always Free limits. Set a **$1 budget alert** in Oracle's Billing settings so any charge is caught immediately.
- **Security:** only ports 22/80/443 are open; PostgreSQL is never exposed to the internet. Keep Ubuntu updated with `sudo apt update && sudo apt upgrade` monthly.
- **Moving later:** the same `compose.yaml` runs on any Ubuntu server. Restore a backup there and point DNS to it.
