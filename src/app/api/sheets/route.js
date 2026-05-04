import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import path from 'path';

// Using the provided Spreadsheet ID
const SPREADSHEET_ID = '1Xsb46eOHnii34YM_UEY3LERAFrggJZMrPzm1vVc8TNw';

export async function POST(req) {
  try {
    const body = await req.json();
    const { 
      voucherId, 
      date, 
      dailyPurchaseId,
      farmerName, 
      mobileNumber,
      variety,
      netWeight, 
      deductionGrams, 
      totalDeduction,
      finalWeight,
      purchaseRate,
      finalAmount,
      parchiPhotoUrl,
      gatepassPhotoUrl,
      status,
      cashAmount,
      chequeAmount,
      chequeNumber
    } = body;

    let authOptions = { scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
    if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL) {
      authOptions.credentials = {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
    } else {
      authOptions.keyFile = path.join(process.cwd(), 'google-credentials.json');
    }
    const auth = new google.auth.GoogleAuth(authOptions);

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:R', // Expanded range up to R (18 columns)
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            voucherId,
            date,
            dailyPurchaseId,
            farmerName,
            variety,
            netWeight,
            deductionGrams,
            totalDeduction,
            finalWeight,
            purchaseRate,
            finalAmount,
            parchiPhotoUrl || "No Photo",
            gatepassPhotoUrl || "No Photo",
            status || "Pending",
            cashAmount || "",
            chequeAmount || "",
            chequeNumber || "",
            mobileNumber || ""
          ]
        ],
      },
    });

    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Google Sheets Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
