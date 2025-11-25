/**
 * Slack Request Signature Verification
 * 
 * Verifies that requests are genuinely from Slack using HMAC-SHA256
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */

export async function verifySlackRequest(request, rawBody, signingSecret) {
    const timestamp = request.headers.get('X-Slack-Request-Timestamp');
    const signature = request.headers.get('X-Slack-Signature');

    if (!timestamp || !signature) {
        console.error('[Slack Verify] Missing signature headers');
        return false;
    }

    // Prevent replay attacks - reject requests older than 5 minutes
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
        console.error('[Slack Verify] Request timestamp too old');
        return false;
    }

    // Compute HMAC-SHA256 signature
    const baseString = `v0:${timestamp}:${rawBody}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(signingSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(baseString)
    );

    // Convert to hex string
    const computedSignature = 'v0=' + Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const isValid = signature === computedSignature;

    if (!isValid) {
        console.error('[Slack Verify] Signature mismatch');
    }

    return isValid;
}
