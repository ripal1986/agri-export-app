import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import path from 'path';

const SPREADSHEET_ID = '1Xsb46eOHnii34YM_UEY3LERAFrggJZMrPzm1vVc8TNw';

export async function GET() {
  try {
    const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:R', // Fetching all 18 columns
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Map to objects with absolute row index (rows array is 0-indexed, Google sheets is 1-indexed)
    // Example: Header is row[0] (Sheet Row 1). First data is row[1] (Sheet Row 2).
    const formattedData = [];
    // Get last 50 entries
    const startIndex = Math.max(1, rows.length - 50);
    
    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      formattedData.push({
        rowIndex: i + 1, // Google Sheet row index is 1-based
        voucherId: row[0] || "",
        date: row[1] || "",
        dailyPurchaseId: row[2] || "",
        farmerName: row[3] || "",
        variety: row[4] || "",
        netWeight: row[5] || "",
        deductionGrams: row[6] || "",
        totalDeduction: row[7] || "",
        finalWeight: row[8] || "",
        purchaseRate: row[9] || "",
        finalAmount: row[10] || "",
        parchiPhotoUrl: row[11] || "",
        gatepassPhotoUrl: row[12] || "",
        status: row[13] || "Pending",
        cashAmount: row[14] || "",
        chequeAmount: row[15] || "",
        chequeNumber: row[16] || "",
        mobileNumber: row[17] || ""
      });
    }

    // Reverse to show newest first
    formattedData.reverse();

    return NextResponse.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('Google Sheets Read Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
