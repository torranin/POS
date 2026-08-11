import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  await destroySession();
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || "127.0.0.1:3005";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  return NextResponse.redirect(`${protocol}://${host}/login`, 303);
}
