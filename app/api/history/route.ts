export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // ✅ Clean env vars (handles hidden newline / bad paste issues)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      ?.replace(/[\r\n]/g, "")
      .trim();

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ?.replace(/[\r\n]/g, "")
        .trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ?.replace(/[\r\n]/g, "")
        .trim();

    // ✅ Validate env vars
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      );
    }

    if (!serviceKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    // ✅ Debug hostname (proves URL is valid at runtime)
    let hostname = "unknown";
    try {
      hostname = new URL(supabaseUrl).hostname;
    } catch {
      hostname = `INVALID_URL: ${supabaseUrl}`;
    }

    // ✅ Create Supabase client
    const supabase = createClient(supabaseUrl, serviceKey);

    // ✅ Query your table
    const { data, error } = await supabase
      .from("checkins")
      .select("*")
      .order("created_at", { ascending: false });

    // ❌ Supabase query error
    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          debug: {
            supabaseUrl,
            hostname,
          },
        },
        { status: 500 }
      );
    }

    // ✅ Success
    return NextResponse.json({
      data,
      debug: {
        supabaseUrl,
        hostname,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message || "Unknown server error",
      },
      { status: 500 }
    );
  }
}