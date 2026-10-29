# Deployment

Target: a single Linux VPS with Docker and Nginx, the store on its own subdomain
(for example `nexora.siavashizadi.com`). Nginx terminates TLS and proxies to the app on `127.0.0.1:3002`.

## 1. DNS

Create an `A` (and `AAAA` if the server has IPv6) record for `nexora` pointing to the server.

## 2. Code and environment on the server

```bash
git clone https://github.com/TySia-fr/Nexora.git ~/apps/nexora
cd ~/apps/nexora
cp .env.example .env
chmod 600 .env
```

Edit `.env`:

| Variable                                      | Value                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`                           | long random string (`openssl rand -base64 32`) — add this line, it's only used by compose |
| `DATABASE_URL`                                | ignored by compose (it builds the URL from `POSTGRES_PASSWORD`); leave the placeholder    |
| `TEST_DATABASE_URL`                           | not needed in production; delete the line                                                 |
| `APP_URL`                                     | `https://nexora.siavashizadi.com`                                                         |
| `BETTER_AUTH_SECRET`                          | `openssl rand -base64 48`                                                                 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe **test** keys, or leave empty to keep payments disabled                            |

Never set `RATE_LIMIT_MULTIPLIER` here.

## 3. Start

```bash
sudo docker compose up -d --build        # db → migrate (runs and exits) → app
sudo docker compose ps                   # app should be "healthy"
curl -s http://127.0.0.1:3002/api/health    # {"status":"ok"}
```

First time only — demo data and the first admin:

```bash
sudo docker compose run --rm -e ALLOW_PRODUCTION_SEED=yes migrate pnpm db:seed
sudo docker compose run --rm migrate pnpm admin:create      # prompts for email and a hidden password
```

## 4. Nginx

`/etc/nginx/sites-available/nexora`:

```nginx
limit_req_zone $binary_remote_addr zone=nexora_post:10m rate=10r/s;

server {
    listen 80;
    listen [::]:80;
    server_name nexora.siavashizadi.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name nexora.siavashizadi.com;
    # ssl_certificate lines are added by certbot

    client_max_body_size 1m;

    location / {
        # POSTs (server actions, auth, webhooks) get a per-IP burst limit.
        limit_req zone=nexora_post burst=20 nodelay;
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

`X-Forwarded-For` is overwritten with the real client address on purpose: the app's rate limiter trusts it.

```bash
sudo ln -s /etc/nginx/sites-available/nexora /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d nexora.siavashizadi.com
```

## 5. Stripe webhook (only if payments are enabled)

In the Stripe dashboard (test mode) → Developers → Webhooks → add endpoint
`https://nexora.siavashizadi.com/api/webhooks/stripe` with events:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`.
Put the signing secret in `STRIPE_WEBHOOK_SECRET` and `sudo docker compose up -d` again.

## 6. Updating

Manually:

```bash
git pull
sudo docker compose up -d --build        # migrations run before the new app starts
```

Automatically (recommended): a systemd timer checks `origin/main` every two minutes and redeploys when it
moved. The server only pulls from the public repository, so there are no deploy keys or GitHub secrets.

```bash
cd ~/apps/nexora && git pull && sudo bash scripts/deploy/install-autodeploy.sh
journalctl -u nexora-autodeploy -f       # follow deploys
sudo systemctl stop nexora-autodeploy.timer    # pause
```

It fast-forwards only (local edits on the server stop it with a clear log line), never runs two builds at
once, and checks `/api/health` after each deploy. Anyone who can push to `main` can deploy, so protect the
branch on GitHub once more people have write access.

## 7. Backups

```bash
sudo docker compose exec -T db pg_dump -U nexora -Fc nexora > ~/backups/nexora-$(date +%F).dump
# restore into an empty database:
sudo docker compose exec -T db pg_restore -U nexora -d nexora --clean < ~/backups/nexora-YYYY-MM-DD.dump
```

Schedule the dump with cron and copy it off the server. A backup you have never restored is not a backup:
test the restore once.
