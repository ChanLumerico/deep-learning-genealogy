# Turning on accounts

The site works without any of this — the reading list lives in the browser and
there is no sign-in button. These steps add an optional account that carries
the list between browsers. Everything else stays exactly as it is: same host,
same build, no server.

## 1. Create the project

<https://supabase.com> → new project (free tier). Note the region; anything
near your readers is fine.

## 2. Create the table

Dashboard → SQL Editor → paste `supabase/schema.sql` → Run. It is safe to
re-run.

That file is the security model, not a formality: the key that ships in the
browser can do nothing except read and write rows whose `user_id` matches the
signed-in user, and that is enforced by the row-level policies rather than by
the client.

## 3. Turn on the providers

Dashboard → Authentication → Providers.

**Google** — create an OAuth client at
<https://console.cloud.google.com/apis/credentials> (type: Web application).
Authorised redirect URI: the callback shown on the Supabase provider page,
which looks like `https://<project>.supabase.co/auth/v1/callback`. Paste the
client ID and secret back into Supabase.

**GitHub** — <https://github.com/settings/developers> → New OAuth App.
Authorisation callback URL: the same Supabase callback. Paste the client ID
and secret back.

## 4. Tell Supabase where the site lives

Dashboard → Authentication → URL Configuration.

- Site URL: `https://chanlumerico.github.io/deep-learning-genealogy/`
- Redirect URLs: add the same, and `http://localhost:5173/**` for development.

Without this the provider will refuse to send anyone back.

## 5. Give the keys to the build

Dashboard → Project Settings → API. Copy the project URL and the **anon /
publishable** key — not the service role key, which must never leave a server.

Locally, `cp .env.example .env` and fill it in.

For the deployed site, add them as repository secrets
(Settings → Secrets and variables → Actions):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The workflow passes them to `npm run build`. With the secrets absent the build
still succeeds and simply produces the local-only site, so a fork of this
repository keeps working with nothing configured.

## What is stored

One row per model marked read: the user id, the node id, and when. Nothing
else — no reading history, no analytics, no essay you looked at. Course
progress is computed from that list rather than stored, and panel width stays
in the browser because it describes a screen, not a person.

Signing out leaves the browser's copy alone. `Clear all` while signed in
empties the stored list too.
