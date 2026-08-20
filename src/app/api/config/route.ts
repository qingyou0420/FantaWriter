import { NextRequest, NextResponse } from "next/server";
import {
  getEnvDiagnostics,
  getConfigFilePath,
  saveApiConfig,
} from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  const env = getEnvDiagnostics();
  return NextResponse.json({
    ok: true,
    env,
    configPath: getConfigFilePath(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      apiKey?: string;
      model?: string;
      baseURL?: string;
    };
    const result = saveApiConfig({
      apiKey: body.apiKey,
      model: body.model,
      baseURL: body.baseURL,
    });
    return NextResponse.json({
      ok: true,
      path: result.path,
      env: getEnvDiagnostics(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
