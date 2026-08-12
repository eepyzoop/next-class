# NextClass Push Worker

Cloudflare Worker that backs the optional "Notify Me While Closed" toggle in
Settings. Stores one KV record per device (subscription + that device's
classes/todos/settings), and a Cron Trigger checks every subscriber once a
minute for reminders due, sending them via Web Push.

## One-time setup

```sh
cd worker
npm install
npx wrangler login                       # opens a browser to authorize your Cloudflare account
npx wrangler kv namespace create SUBSCRIPTIONS
# copy the returned "id" into wrangler.toml's [[kv_namespaces]] entry
npx wrangler secret put VAPID_PRIVATE_KEY # paste the private key generated alongside the public key in src/lib/push.ts
npm run deploy
```

After the first deploy, `wrangler deploy` prints the Worker's URL
(`https://nextclass-push.<your-subdomain>.workers.dev`). Paste that into
`PUSH_API_URL` in `../src/lib/push.ts`, then rebuild and redeploy the frontend.

## Redeploying

```sh
cd worker
npm run deploy
```

## Local dev

```sh
cd worker
npm run dev
```
