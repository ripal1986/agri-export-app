import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import path from 'path';

const SPREADSHEET_ID = '1Xsb46eOHnii34YM_UEY3LERAFrggJZMrPzm1vVc8TNw';

export async function POST(req) {
  try {
    const body = await req.json();
    const { 
      rowIndex,
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

    if (!rowIndex) {
      return NextResponse.json({ success: false, error: "Row index is required for update" }, { status: 400 });
    }

    const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const range = `Sheet1!A${rowIndex}:R${rowIndex}`; // Update row up to R (18 columns)

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
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
            status || "Completed",
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
    console.error('Google Sheets Update Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
