# PSZ 2026 Elections

Public election portal for the Pharmaceutical Society of Zambia 2026 Elections.

## What It Does

- Welcoming public home page
- Member login screen
- Demo ballot screen for voter workflow testing
- Administrator dashboard
- Register upload from a private CSV
- Vote records matched against the voter register
- Turnout counter, voted list, pending list, outside-register alerts
- Audit CSV export
- EmailJS-ready contact form with mailto fallback
- GitHub Pages deployment workflow

## Privacy

Do not commit the full voter register to this public repository. The PDF register contains names and email addresses. Keep extracted register files under `private/`, which is ignored by Git.

The local extracted file is:

```text
private/final-voters-register.csv
```

Administrators upload that CSV inside the dashboard after logging in.

## Demo Login

Default admin access:

```text
Admin code: PSZ2026
```

Change this in `config.js` before production.

## Live Backend

GitHub Pages is static and cannot securely store shared votes by itself. For real multi-user voting, connect a backend such as Supabase, Firebase, or a custom API.

`config.js` includes placeholders for Supabase:

```js
backend: {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
}
```

Expected `votes` table columns:

```sql
email text not null unique,
name text,
candidate text,
timestamp timestamptz not null
```

Enable row-level security before production and use server-side rules so voters can only create one vote and administrators can read reports.

## Email Setup

The website can send email through EmailJS without adding private server credentials to the repository.

1. Create an EmailJS account.
2. Add an email service for the elections inbox.
3. Create a contact request template.
4. Update `config.js`:

```js
email: {
  publicKey: "YOUR_EMAILJS_PUBLIC_KEY",
  serviceId: "YOUR_EMAILJS_SERVICE_ID",
  contactTemplateId: "YOUR_CONTACT_TEMPLATE_ID",
  resetTemplateId: ""
}
```

If those fields are blank, forms still open the user's email app with the request already prepared.

## Go Live With GitHub Pages

1. Push this repository to GitHub.
2. Open repository settings.
3. Go to **Pages**.
4. Set source to **GitHub Actions**.
5. The included workflow publishes the site automatically on every push to `main`.

## Security Note

This app is ready as a public portal and workflow prototype. Binding online elections require server-side authentication, audited ballot storage, administrator access controls, immutable logs, and a documented election procedure.
