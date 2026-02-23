// Google Drive integration (via Replit connector)
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }
  return accessToken;
}

async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function uploadToDrive(
  files: Array<{ filename: string; buffer: Buffer; mimeType: string }>,
  folderName: string
): Promise<{ folderId: string; folderUrl: string; fileCount: number }> {
  const drive = await getUncachableGoogleDriveClient();

  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  const folder = await drive.files.create({
    requestBody: folderMetadata,
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
