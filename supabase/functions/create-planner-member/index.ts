import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

Deno.serve(async (request: Request) => {
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
    status, headers: { ...headers, "Content-Type": "application/json" },
  });
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return reply(405, { error: "POST required" });
  const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply(401, { error: "Sign in as Admin first" });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply(503, { error: "Account creation server is not configured" });
  const server = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: identity, error: identityError } = await server.auth.getUser(token);
    if (identityError || !identity.user) return reply(401, { error: "Session expired; sign in again" });
    const { data: admin, error: adminError } = await server.from("planner_family_members")
      .select("role").eq("user_id", identity.user.id).maybeSingle();
    if (adminError) throw adminError;
    if (admin?.role !== "admin") return reply(403, { error: "Only Admin can create accounts" });
    let input;
    try { input = await request.json(); }
    catch { return reply(400, { error: "Invalid JSON request" }); }
    if (!input || typeof input !== "object") return reply(400, { error: "Account details required" });
    const { name, phone, password } = input;
    if (typeof name !== "string" || !name.trim() || name.trim().length > 80 ||
        typeof phone !== "string" || !/^\+91[6-9]\d{9}$/.test(phone) ||
        typeof password !== "string" || password.length < 10 || password.length > 72) {
      return reply(400, { error: "Name (1-80 characters), valid Indian mobile and password (10-72 characters) required" });
    }
    const prefix = name.normalize("NFKD").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 24) || "USER";
    const loginId = prefix + phone.slice(3);
    const { data: existing, error: existingError } = await server.from("planner_family_private")
      .select("user_id").eq("phone", phone).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return reply(409, { error: "This mobile already has a member account. Use its existing login." });
    const { data: created, error: createError } = await server.auth.admin.createUser({
      email: `member.${phone.slice(1)}@members.vyom.invalid`, password, email_confirm: true,
    });
    if (createError || !created.user) return reply(400, { error: createError?.message || "Auth account was not created" });
    const userId = created.user.id;
    try {
      const { error: memberError } = await server.from("planner_family_members").insert({
        user_id: userId, display_name: name.trim(), role: "member",
      });
      if (memberError) throw memberError;
      const { error: privateError } = await server.from("planner_family_private").insert({ user_id: userId, phone });
      if (privateError) throw privateError;
    } catch (error) {
      const { error: cleanupError } = await server.auth.admin.deleteUser(userId);
      if (cleanupError) {
        console.error("Incomplete member setup; manual cleanup required", userId, cleanupError.message);
        return reply(500, { error: `Account setup incomplete. Admin must inspect/remove Auth user ${userId} before retrying.` });
      }
      console.error("Member setup rolled back", error instanceof Error ? error.message : "Database failure");
      return reply(500, { error: "Member setup failed and new account was removed. Run latest setup SQL before retrying." });
    }
    return reply(201, { userId, loginId, displayName: name.trim() });
  } catch (error) {
    console.error("Member creation failed", error instanceof Error ? error.message : "Server failure");
    return reply(500, { error: "Account creation failed. Admin should check function logs and database setup." });
  }
});
