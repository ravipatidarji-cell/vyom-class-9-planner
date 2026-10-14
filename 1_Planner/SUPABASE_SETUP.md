# Vyom Planner: individual family logins, shared progress, and comments

## One-time upgrade

The app stores progress and comments in Supabase. Each person must have their own Supabase Auth account; do not share one email/password between people. Supabase keeps each browser's sign-in session, so people normally sign in once per browser/device. Clearing browser data, signing out, or session expiry may require another sign-in.

1. Open the project's **SQL Editor**.
2. Open `supabase-setup.sql` in this folder, copy the entire file, paste it into a new SQL query, and run it. It is safe to run again: it adds the family profile/comment tables and updates the access rules. The existing progress table and progress rows are preserved.
3. The existing `ravipatidarji@gmail.com` family entry is promoted to `admin` by the SQL. Its displayed name defaults to `Parent / Admin`; update that name in the SQL Editor if desired.
4. In **Authentication → Settings**, turn off public sign-ups. In **Authentication → Users**, add one user for each family member with that person's own email and password. Do not share passwords.
5. Add each Auth user to the approved family roster in SQL Editor, changing the email and display name:

   ```sql
   insert into public.planner_family_members (user_id, display_name, role)
   select id, 'Vyom', 'member'
   from auth.users
   where lower(email) = lower('VYOM-LOGIN-EMAIL')
   on conflict (user_id) do update
   set display_name = excluded.display_name;
   ```

   Use role `'admin'` only for a parent who should see phone numbers. The existing parent/admin entry is already promoted if the old family allowlist step was completed.
6. Optional: add each person's phone number to the private table. Only admins can read this table:

   ```sql
   insert into public.planner_family_private (user_id, phone)
   select id, '+91-REPLACE-WITH-PHONE'
   from auth.users
   where lower(email) = lower('MEMBER-LOGIN-EMAIL')
   on conflict (user_id) do update
   set phone = excluded.phone, updated_at = now();
   ```

7. Publish the latest app files to GitHub Pages. On every device, open the online `https://` app URL, choose **Cloud Sync**, and sign in with that device user's own email/password. The app retains each browser's session.

## Family & Comments tab

- Approved signed-in members can see the approved roster (display name and role), read comments, and post comments.
- Phone numbers are stored separately and protected with row-level security; only users whose roster role is `admin` can read them. Ordinary members cannot query the phone table.
- Comments are attributed to the account's approved display name, are visible to family members, and cannot be edited/deleted in the app.
- This is a member roster, not a live online-presence indicator.
- Never put a Supabase `service_role` or secret key in the app or repository. The browser uses only the publishable/anon key.

## Offline behaviour

Progress remains cached locally and can be edited offline. Cloud writes occur when signed in and online. Offline changes are not a durable sync queue; reconnect and re-edit changes that must sync. Avoid editing the same item on multiple offline devices.
