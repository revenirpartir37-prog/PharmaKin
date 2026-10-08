import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    app: "PharmaKin",
    version: "1.0.0",
    by: "HenoBuild Entreprise",
  });
}
