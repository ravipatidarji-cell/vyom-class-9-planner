# Vyom Planner: individual family logins, shared progress, and comments

## One-time upgrade

The app stores progress and comments in Supabase. Each person must have their own Supabase Auth account, registered with their own mobile number and password. The app accepts 10-digit Indian mobile numbers and sends them to Supabase as `+91...`. The existing parent admin can continue using its email login. Supabase keeps each browser's sign-in session, so people normally sign in once per browser/device. Clearing browser data, signing out, or session expiry may require another sign-in.

1. Open the project's **SQL Editor**.
2. Open `supabase-setup.sql` in this folder, copy the entire file, paste it into a new SQL query, and run it. It is safe to run again: it adds the family profile/comment tables and updates the access rules. The existing progress table and progress rows are preserved.
3. The existing `ravipatidarji@gmail.com` family entry is promoted to `admin` by the SQL. Its displayed name defaults to `Parent / Admin`; update that name in the SQL Editor if desired.
4. In **Authentication → Providers**, enable **Phone**. Keep public sign-ups disabled. Create a separate Auth user for each member, using that person's mobile number in international format (for example, `+91` followed by the 10-digit number) and a unique password. Set the phone as confirmed only after verifying that the number belongs to that person. Never put a Supabase `service_role` key in the app; if the Dashboard does not allow creating phone/password users, account creation must be done through a trusted server-side admin tool.
5. Add each existing phone Auth user to the approved family roster in SQL Editor, changing the phone and display name:

   ```sql
   insert into public.planner_family_members (user_id, display_name, role)
   select id, 'Shashi', 'member'
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

7. Publish the latest app files to GitHub Pages. On every device, open the online `https://` app URL, choose **Cloud Sync**, and sign in with that person's mobile number and password. The app retains each browser's session.

## Family & Comments tab

- Approved signed-in members can see the approved roster (display name and role), read comments, and post comments.
- Phone numbers are stored separately and protected with row-level security; only users whose roster role is `admin` can read them. Ordinary members cannot query the phone table.
- Comments are attributed to the account's approved display name, are visible to family members, and cannot be edited/deleted in the app. The roster shows approved members, not a live online-presence list.
- Never put a Supabase `service_role` or secret key in the app or repository. The browser uses only the publishable/anon key.

## Offline behaviour

Progress remains cached locally and can be edited offline. Cloud writes occur when signed in and online. Offline changes are not a durable sync queue; reconnect and re-edit changes that must sync. Avoid editing the same item on multiple offline devices.
