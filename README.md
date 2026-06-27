# PSZ 2026 Elections

Public election portal for the Pharmaceutical Society of Zambia 2026 Elections.

## Features

- Responsive PSZ-branded public website
- Voter turnout counter
- Election resources section
- Login/password-reset request form
- Contact form for voter support
- EmailJS-ready email sending with mailto fallback
- GitHub Pages deployment workflow

## Email Setup

The website can send email through EmailJS without adding private server credentials to the repository.

1. Create an EmailJS account.
2. Add an email service for the elections inbox.
3. Create two templates:
   - Contact request template
   - Password reset request template
4. Update `config.js`:

```js
window.PSZ_ELECTIONS_CONFIG = {
  electionEmail: "elections@pszelections.org",
  votesCast: 2,
  totalVoters: 476,
  email: {
    publicKey: "YOUR_EMAILJS_PUBLIC_KEY",
    serviceId: "YOUR_EMAILJS_SERVICE_ID",
    contactTemplateId: "YOUR_CONTACT_TEMPLATE_ID",
    resetTemplateId: "YOUR_RESET_TEMPLATE_ID"
  }
};
```

If those fields are blank, forms still open the user's email app with the request already prepared.

## Go Live With GitHub Pages

After pushing this repository to GitHub:

1. Open repository settings.
2. Go to **Pages**.
3. Set source to **GitHub Actions**.
4. The included workflow publishes the site automatically on every push to `main`.

## Security Note

This is a public portal and support desk front end. Do not use this static site alone for binding electronic voting. Secure online voting requires authenticated voter records, server-side ballot storage, audit logs, and election administrator controls.
