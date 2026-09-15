import { NextResponse } from 'next/server';

/** Ancienne API intérêts lead — utiliser PUT /api/prospects/[id]/contacts/[contactId]/interests */
export async function PUT() {
  return NextResponse.json(
    {
      error:
        'Endpoint obsolète. Utilisez /api/prospects/[id]/contacts/[contactId]/interests',
    },
    { status: 410 },
  );
}

export async function GET() {
  return PUT();
}
