export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Hardcoded temporarily to bypass Vercel env issues
    const supabaseUrl = "https://asubkqoqvqhhexgqdjbc.supabase.co";

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ?.replace(/[\r\n]/g, "")
        .trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ?.replace(/[\r\n]/g, "")
        .trim();

    if (!serviceKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("checkins")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          debug: {
            supabaseUrl,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      debug: {
        supabaseUrl,
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