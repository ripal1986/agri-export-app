import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    
    // Using environment variables with fallbacks
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    
    const helperUser = process.env.HELPER_USERNAME || 'manager';
    const helperPass = process.env.HELPER_PASSWORD || 'manager123';

    if (username === adminUser && password === adminPass) {
      return NextResponse.json({ success: true, role: 'admin' });
    }
    
    if (username === helperUser && password === helperPass) {
      return NextResponse.json({ success: true, role: 'helper' });
    }

    return NextResponse.json({ success: false, error: 'ખોટો યુઝરનેમ અથવા પાસવર્ડ!' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
