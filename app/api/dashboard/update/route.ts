import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, contacted, admin_notes, contacted_by, disposition } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const payload = {
      contacted: contacted ?? false,
      admin_notes: admin_notes ?? "",
      contacted_by: contacted ? contacted_by ?? "" : null,
      contacted_at: contacted ? new Date().toISOString() : null,
      disposition: disposition ?? "",
    };

    const { data, error } = await supabase
      .from("checkins")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}