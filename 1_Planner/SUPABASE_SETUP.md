# Vyom Planner shared progress setup

This planner is a static GitHub Pages app. Shared progress needs a Supabase project; the database stores student tasks, marks, notes, chapter status, and mistakes. Keep the database restricted to authenticated family users.

## One-time setup

1. Create a Supabase project at https://supabase.com/dashboard and save its database password securely.
2. In **Project Settings → API**, copy the Project URL and the **publishable key** (or legacy `anon` key). Never use or publish the `service_role` key.
3. In **SQL Editor**, run the contents of `supabase-setup.sql`.
4. In **Authentication → Providers → Email**, keep email/password enabled. In **Authentication → Users**, create the family account. Disable public sign-ups in **Authentication → Settings** so outsiders cannot create accounts.
5. In **SQL Editor**, add the family account to the allowlist, replacing its email:

   ```sql
   insert into public.planner_family_members (user_id)
   select id from auth.users where email = 'FAMILY-EMAIL-HERE'
   on conflict (user_id) do nothing;
   ```

   Use the same account on Vyom's and the parents' devices. For additional accounts, create them from the Supabase dashboard and add each account to this allowlist.
6. Put the Project URL and publishable/anon key in `cloud-config.js`:

   ```js
   window.VYOM_SUPABASE_CONFIG = {
     url: 'https://YOUR-PROJECT-REF.supabase.co',
     anonKey: 'YOUR-PUBLISHABLE-OR-ANON-KEY'
   };
   ```

7. Publish the changed files to GitHub Pages. Open the planner on each device, choose **Cloud Sync: Sign in**, and use the family account.

The publishable/anon key is intended for a browser app; row-level security policies and the `planner_family_members` allowlist ensure that only explicitly added family accounts can read or change planner data. Never put a `service_role` or secret key in this app or repository.

## Data and offline behaviour

Progress is saved locally on every device and synced to Supabase when signed in and online. Live updates are broadcast to signed-in devices. When offline, the app continues to work locally; queued changes are not guaranteed to sync until the device reconnects and the relevant item is edited again. Avoid editing the exact same task on multiple devices while offline.
