# CareerPilot — final release checklist

1. Copy `src/app/page.tsx` and `src/components/data-backup-panel.tsx` from this ZIP into the matching project paths. Replace page.tsx; the panel is new.
2. Put `README.md` in the project root.
3. Restart dev server if necessary, run `npm run lint` and `npm run build`.
4. Open Preferences. Click **Export All Data**. Verify the downloaded JSON exists. Import it into a separate browser profile if you can, or test after first exporting a second safe backup.
5. Confirm your current saved applications and Gemini drafts remain available. Test German CV and letter PDF export.
6. Check `.gitignore` covers `.env.local`, run `git ls-files .env.local` (must return empty), and do not commit passwords/API keys.
7. Important security limitation: the current signed owner password protects your server Gemini key but DOES NOT rate-limit brute-force login attempts. Enable supported Vercel/edge WAF or bot protection before making it widely public; avoid in-memory serverless rate limiting as a false security assurance.
8. Vercel: configure 3 server-only env vars `GEMINI_API_KEY`, `CAREERPILOT_OWNER_PASSWORD`, `CAREERPILOT_SESSION_SECRET`. Never prefix these with `NEXT_PUBLIC_`.
9. Localhost and Vercel have separate browser storage: use Preferences full export/import to migrate your local data.
10. Test owner sign-in, owner Gemini, sign-out, visitor BYOK, agent, archive/restore, PDF printing and mobile view on deployment.

**Source safety:** The backup/export functions cannot verify the downloaded file was permanently retained. Keep a copy somewhere safe. Import replaces all existing `careerpilot:` localStorage keys after confirmation. If localStorage quota fails, it attempts rollback; always export before restoring.

**Scope of this ZIP:** Full backup, usage UI, documentation. No changes to authentication/rate limiting. Don't describe the public deployment as brute-force protected until you enable managed protection.
