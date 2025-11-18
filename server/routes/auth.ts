import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// GET /api/auth/gmail - Start OAuth flow
router.get('/gmail', (req, res) => {
    try {
        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.compose',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
        ];

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
        });

        res.json({ url: authUrl });
    } catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
});

// GET /api/auth/gmail/callback - Handle OAuth callback
router.get('/gmail/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=${encodeURIComponent(String(error))}`
        );
    }

    if (!code) {
        return res.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=no_code`
        );
    }

    try {
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(String(code));
        oauth2Client.setCredentials(tokens);

        // Get user info
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data: userInfo } = await oauth2.userinfo.get();

        // Create account data
        const accountData = {
            id: `gmail_${userInfo.id}`,
            email: userInfo.email!,
            provider: 'gmail',
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date,
            name: userInfo.name,
            picture: userInfo.picture,
        };

        // Encode account data to pass to client
        const encodedData = encodeURIComponent(JSON.stringify(accountData));

        // Redirect back to settings with success
        res.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?gmail_auth=success&account=${encodedData}`
        );
    } catch (error) {
        console.error('Error in Gmail OAuth callback:', error);
        res.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=auth_failed`
        );
    }
});

export default router;
