# Vyom Planner: individual family logins and shared progress

## One-time upgrade

### Admin-managed accounts and private feedback (new)

1. Run the entire latest `supabase-setup.sql`. It preserves old comments but
   restricts reading comments to Admin; members can insert their own OK/NOT OK
   messages, not read anyone's inbox. Member roster reads are now self-or-admin.
2. Keep Email authentication enabled and public sign-ups disabled. New members
   enter name+mobile ID/password, not an email. Internally, the server creates a
   confirmed non-deliverable `member.<country-code-and-mobile>@members.vyom.invalid`
   Auth identity. No SMS provider, OTP or actual member email is needed. The
   Admin verifies the recipient before creating the account.
3. Deploy `supabase/functions/create-planner-member/index.ts` to the same
   Supabase project with the Supabase CLI:
   `supabase functions deploy create-planner-member --project-ref YOUR_PROJECT_REF --no-verify-jwt`.
   The function performs its own `auth.getUser(token)` verification and checks
   the caller's database Admin role before creating an account. The flag skips
   only the gateway's legacy JWT check, not the function's authentication.
   Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only to
   the function runtime. Never add that secret to public app configuration.
4. Publish the updated app. Sign in as the existing Admin, then open
   **Users & Feedback**. Enter a verified name/mobile and a private initial
   password (10–72 characters). The function creates a confirmed phone Auth
   account and member/private-phone rows; it never grants Admin from the form.
   The internal identity is confirmed by the trusted Admin function, not email
   delivery. Members' mobile numbers remain in the Admin-only private table.
5. Copy the one-time share message and send it privately. Passwords are not
   stored in readable database tables, URLs, local storage or logs, and the
   message clears on leaving the tab/reloading. The normal browser Auth session
   remains Admin's; server-side user creation does not sign Admin out.
   **Send link to WhatsApp** opens the newly created member's verified mobile
   chat with the app link and login ID prefilled. Admin must press Send in
   WhatsApp. Passwords are excluded from WhatsApp URLs; send them separately.
   Clearing the invite or leaving the tab removes the WhatsApp link too.
6. Each approved signed-in person sees an OK/NOT OK + required comment box on
   Dashboard. The server assigns timestamps, RLS binds the sender to the signed-in
   user, and only Admin reads the inbox. Users & Feedback shows private mobile
   details, account IDs, latest 100 login events and latest 100 comments, refreshing
   on opening, every 30 seconds while visible, and on realtime events.
   Login events are successful explicit app logins, not live presence.
   Approved accounts appear in a table with name, private mobile, login ID, role,
   unique account ID and recent login from those latest 100 events. Accounts
   without a recorded login still appear; passwords are never listed.
   Non-Admin members (including previously disabled members) have selection
   checkboxes. **Delete selected members** asks for permanent-deletion
   confirmation and calls the trusted function with `action: "delete"`.
   Admin/self accounts are protected server-side. Auth account deletion cascades
   to membership, private phone, login history and comments. Shared planner
   progress and previously downloaded/offline copies are not deleted. Partial
   batch failures report the confirmed deleted IDs and an explicit error; refresh
   before retrying. Every recorded valid Indian mobile has a WhatsApp link button.
   The older `revoke_planner_members` SQL RPC remains available for access-only
   administration, but the table's Delete button now permanently deletes.

The SQL and function must be deployed before this feature can work on the real
server. Missing setup and network errors are reported, not treated as success.
Existing members can remain unchanged; the manual setup below is an alternative.
The app first tries internal member authentication; only an invalid-credentials
response falls back to legacy phone/password authentication for old accounts.
Legacy phone accounts still require Phone authentication enabled. Admin email
authentication is unchanged. Existing private mobile rows block duplicate
account creation; the internal Auth identity is unique even for concurrent
requests.

The app stores shared progress and sign-in history in Supabase. Each person needs a separate Auth account. A member's login ID is their name followed by their 10-digit mobile number (for example, `DHRUVA9826022333`). New Admin-created accounts use an internal Auth identity derived from the mobile; no real email or SMS/OTP is needed. Legacy phone accounts remain supported when Phone authentication is enabled. Set a separate private password: using the ID as password lets anyone who knows the mobile-based ID impersonate that person. Send each person's details privately, not in a public post. The existing parent admin can continue using its email login and existing password. Supabase keeps each browser's sign-in session, so people normally sign in once per browser/device. Clearing browser data, signing out, or session expiry may require another sign-in.

1. Open the project's **SQL Editor**.
2. Open `supabase-setup.sql` in this folder, copy the entire file, paste it into a new SQL query, and run it. It is safe to run again: it adds the family profile and sign-in history tables, retains legacy comment rows while restricting inbox reads to Admin, and updates the access rules. The existing progress table and progress rows are preserved.
3. The existing `ravipatidarji@gmail.com` family entry is promoted to `admin` by the SQL. Its displayed name defaults to `Parent / Admin`; update that name in the SQL Editor if desired.
4. In **Authentication → Providers**, enable **Phone**. Keep public sign-ups disabled. Create a separate Auth user for each member, using that person's mobile number in international format (`+91` followed by the 10 digits). Set the password to the exact member login ID (name plus mobile digits) only as requested, and only if you accept the risk in step 1. Confirm a phone only after verifying that it belongs to that person. Never put a Supabase `service_role` key in the app; if the Dashboard does not allow creating phone/password users, account creation must be done through a trusted server-side admin tool.
5. Add each existing phone Auth user to the approved family roster in SQL Editor, changing the phone and display name:

   ```sql
   insert into public.planner_family_members (user_id, display_name, role)
   select id, 'Dhruva', 'member'
   from auth.users
   where phone = '+91-10-DIGIT-MOBILE'
   on conflict (user_id) do update
   set display_name = excluded.display_name;
   ```

   Repeat for each person, replacing the display name and phone. Use role `'admin'` only for a parent who should see phone numbers. The existing parent/admin entry is already promoted if the old family allowlist step was completed.
6. Optional: add each person's phone number to the private table. Only admins can read this table:

   ```sql
   insert into public.planner_family_private (user_id, phone)
   select id, '+91-REPLACE-WITH-PHONE'
   from auth.users
   where phone = '+91-REPLACE-WITH-PHONE'
   on conflict (user_id) do update
   set phone = excluded.phone, updated_at = now();
   ```

7. Publish the latest app files to GitHub Pages. On every device, open the online `https://` app URL, choose **Cloud Sync**, and sign in with that person's name+mobile login ID and the password set in step 4. The app retains each browser's session.

## Parent page and sign-in history

- The **Parent** tab stays locked until the existing approved `admin` account signs in through **Cloud Sync**. Family-member accounts may continue syncing progress but cannot open the Parent page. No password is hard-coded into the public app.
- The **Recent sign-ins** list in the Parent page records successful logins made after this SQL upgrade, with the account name and server date/time. Existing sessions should sign out and sign in once to create their first entry. This is login history, not a live-online or device list.
- Admin history shows the latest 100 sign-ins, each with display name, role,
  full unique account ID and India time including seconds. Separate accounts
  distinguish people even when display names match; sharing one account cannot
  identify the actual person. Realtime inserts update the list; while Parent is
  visible it also refreshes every 30 seconds, on returning to the page or going
  online, with a manual refresh button and explicit error status. Refresh also
  reloads member names/roles. This does not log automatic session restoration as
  a new password login, nor establish whether someone is currently online.
- The old Family & Comments tab is replaced by the Admin-only Users & Feedback tab and a Dashboard feedback box. Existing comment rows remain, with Admin-only read policies after the SQL upgrade.
- Parent reports are shown only after Admin sign-in, but they are calculated in the browser from shared progress data. This is a role-based page gate, not encryption of data already available to a signed-in family account. Parent answer-key PDFs additionally require a PDF-open password; student PDFs remain unencrypted. Previously downloaded unprotected copies cannot be revoked.
- Never put a Supabase `service_role` or secret key in the app or repository. The browser uses only the publishable/anon key.

## Sign-in troubleshooting

### Building password-protected parent PDFs

Install `python -m pip install -r _system/weekly/requirements.txt`. Set
`VYOM_PARENT_PDF_PASSWORD` privately in the build process environment before
running PDF generators or the weekly verifier. Never commit the password or put
it in browser code. Parent keys use AES-256 PDF encryption; verification rejects
missing/wrong passwords and checks the correct password and page count.

If sign-in fails, the Cloud Sync dialog shows the authentication error message,
code (when provided), and HTTP status. Share only that error, never the password.
`invalid_credentials` means the server rejected the login combination; verify
the account exists in this app's Supabase project and use its password.
`email_not_confirmed` or `phone_not_confirmed` requires account verification.
Rate-limit errors require waiting before retrying. Network errors require
checking connectivity; they do not establish that the password is wrong.

## Offline behaviour

The Chapters tab provides checkboxes for each chapter's scheduled topic/study or
revision block. These update the same daily task record as the Aaj tab, using
existing local/cloud progress storage; repeated revision sessions stay separate.
A block containing several topics is completed as a unit. Chapter mastery stages
remain separate and are not automatically awarded by topic ticks.
Use the selected-subject print button for the current subject/course filter, or
the full-course button for all chapters. Print includes saved progress and blank
checkboxes for unfinished blocks; the browser also offers Save as PDF.

Run `npm --prefix _system/weekly run master` after rebuilding weekly packs to
produce `5_Weekly_Packs/Vyom_Complete_Student_Project.pdf`. This student-only master
combines a blank chapter/topic checklist, daily progress and marks/retest
registers with all student packs in date order. Parent answer keys and textbook
scans are excluded. Printed entries do not automatically update app progress.

Progress remains cached locally and can be edited offline. Cloud writes occur when signed in and online. Offline changes are not a durable sync queue; reconnect and re-edit changes that must sync. Avoid editing the same item on multiple offline devices.
