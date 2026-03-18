import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function createOAuth2Client(callbackUrl?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing Google OAuth configuration: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required'
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, callbackUrl);
}

export function getGoogleAuthUrl(callbackUrl: string, state: string): string {
  const oauth2Client = createOAuth2Client(callbackUrl);
  return oauth2Client.generateAuthUrl({
    access_type: 'online',
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string, callbackUrl: string) {
  const oauth2Client = createOAuth2Client(callbackUrl);
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function uploadToDrive(
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null },
  files: Array<{ filename: string; buffer: Buffer; mimeType: string }>,
  folderName: string
): Promise<{ folderId: string; folderUrl: string; fileCount: number }> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

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
