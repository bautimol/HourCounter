# Email templates

The templates Supabase Auth sends. They live in the dashboard
(**Authentication → Emails**), which means they are invisible to code review,
have no history, and are lost if the project is ever recreated — so the source
of truth is kept here and pasted in.

## Applying one

1. Supabase → Authentication → Emails → pick the template.
2. Paste the file contents into **Body** (Source view, not Preview).
3. Set the **Subject** listed below.
4. Save, then send yourself a real one — the built-in preview does not
   substitute template variables or render like a mail client.

| File | Template | Subject |
|------|----------|---------|
| `confirm-signup.html` | Confirm signup | `Confirmá tu cuenta en Clockity` |
| `reset-password.html` | Reset password | `Cambiá tu contraseña de Clockity` |

`reset-password.html` also needs `<origin>/auth/reset` in **Authentication →
URL Configuration → Redirect URLs**. `{{ .ConfirmationURL }}` sends the user
through Supabase's verify endpoint, which then bounces to the `redirectTo` the
app asked for — and Supabase silently substitutes the Site URL when that value
is not on the allowlist. The symptom is not an error: the link works, and drops
the person on the home page instead of the form.

## Notes for editing these

**`{{ .SiteURL }}` has to be right.** The logo is `<img src="{{ .SiteURL }}/icon0">`,
so it resolves against whatever is set in Authentication → URL Configuration →
Site URL. Point that at localhost and every sent email has a broken image.
Using the variable rather than a hardcoded host is what lets the templates
survive the move to a custom domain.

Those icon routes are only reachable because the proxy matcher excludes them
(`src/proxy.ts`). They used to 307 to `/login`, which in an email renders as a
broken image — if the logo ever disappears, check that first.

**Email is not the web.** Layout is tables, styles are inline, and there is no
`<style>` block worth relying on. Flexbox, grid, and external CSS are out.
Button padding goes on the `<td>`, never on the `<a>`: Outlook drops padding on
inline elements and the button collapses to bare underlined text.

**No SVG.** The mark is referenced as the generated PNG. Gmail and Outlook do
not render inline SVG.

**Dark, and declared as such.** `color-scheme: dark` tells Apple Mail and
Outlook the design is already dark so they stop trying to "fix" it. Belt and
braces on top of that: every structural cell carries its colour on both the
`bgcolor` attribute and the inline style, because a client that drops one and
keeps the other is how a dark email ends up white-on-white in one block.

Gmail on Android still adjusts colours on its own in some configurations. That
is the known cost of a dark email and there is no reliable way around it —
check there first if someone reports it looking odd.

**Always keep the raw URL.** Some corporate clients strip buttons. Without the
pasted-link fallback below the divider, those users cannot confirm at all.
