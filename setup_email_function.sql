-- ═══════════════════════════════════════════════════════════════
-- SUPABASE EDGE FUNCTION: send-email
-- ═══════════════════════════════════════════════════════════════
-- 
-- This is the Supabase Edge Function that sends emails.
-- 
-- DEPLOYMENT STEPS:
-- 1. Install Supabase CLI: npm install -g supabase
-- 2. Login: supabase login
-- 3. Create the function:
--    supabase functions new send-email
-- 4. Replace the generated index.ts with the code below
-- 5. Set your Resend API key:
--    supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
-- 6. Deploy:
--    supabase functions deploy send-email --project-ref YOUR_PROJECT_REF
--
-- GET A FREE RESEND API KEY:
-- 1. Go to https://resend.com
-- 2. Sign up (free tier = 100 emails/day)
-- 3. Create an API key
-- 4. Verify your domain (or use their test domain)
-- ═══════════════════════════════════════════════════════════════

-- FILE: supabase/functions/send-email/index.ts
-- ─────────────────────────────────────────────

/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "DDS University <admissions@yourdomain.com>"; 
// Change this to your verified domain email

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not set — skipping email send");
      return new Response(
        JSON.stringify({ message: "Email skipped — no API key configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      return new Response(
        JSON.stringify({ error: "Email send failed", details: data }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Email sent", id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
*/
