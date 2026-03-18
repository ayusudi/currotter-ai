import { google } from 'googleapis';

function getGoogleDriveClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing Google Drive configuration: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN are required'
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function uploadToDrive(
  files: Array<{ filename: string; buffer: Buffer; mimeType: string }>,
  folderName: string
): Promise<{ folderId: string; folderUrl: string; fileCount: number }> {
  const drive = getGoogleDriveClient();

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id, webViewLink',
  });

  const folderId = folder.data.id!;

  for (const file of files) {
    const { Readable } = await import('stream');
    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null);

    await drive.files.create({
      requestBody: {
        name: file.filename,
        parents: [folderId],
      },
      media: {
        mimeType: file.mimeType,
        body: stream,
      },
      fields: 'id',
    });
  }

  return {
    folderId,
    folderUrl: folder.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`,
    fileCount: files.length,
  };
}
