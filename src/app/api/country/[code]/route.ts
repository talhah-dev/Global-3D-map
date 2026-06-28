import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const res = await fetch(`https://restcountries.com/v3.1/alpha/${code}`);
    const data = await res.json();
    return NextResponse.json(data);
}