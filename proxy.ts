import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (request.nextUrl.pathname === "/sw.js") {
    response.headers.set("Cache-Control", "no-cache");
    response.headers.set("Service-Worker-Allowed", "/");
  }
  return response;
}
