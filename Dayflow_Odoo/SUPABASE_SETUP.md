# Supabase Setup — Dayflow HRMS

## A. Create the project

Create a project in the Supabase Dashboard.

## B. Run the schema

Open **SQL Editor -> New query**, paste the contents of `schema.sql`, and click **Run**.

## C. Get the connection string

Open **Connect** in the Supabase Dashboard.

For a local Node.js/Express server, copy the **Session pooler** connection string when you need an IPv4-compatible persistent connection.

Paste it into `.env` as `DATABASE_URL`.

Example shape:

```text
postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-REGION.pooler.supabase.com:5432/postgres
```

Use the exact value supplied by your Supabase project; do not use the example literally.

## D. Run the app

```bash
npm install
npm run seed
npm start
```

Then visit `http://localhost:3000`.
