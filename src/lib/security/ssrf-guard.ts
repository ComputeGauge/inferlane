export function isAllowedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Must be HTTPS
    if (parsed.protocol !== 'https:') return false;

    // Block private/internal IPs
    const hostname = parsed.hostname.toLowerCase();
    const blocked = [
      'localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1',
      '169.254.169.254',  // AWS metadata
      '169.254.170.2',    // ECS metadata
      'metadata.google.internal',  // GCP metadata
    ];
    if (blocked.includes(hostname)) return false;

    // Block private IP ranges
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      if (parts[0] === 10) return false;                          // 10.0.0.0/8
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;  // 172.16.0.0/12
      if (parts[0] === 192 && parts[1] === 168) return false;    // 192.168.0.0/16
      if (parts[0] === 127) return false;                         // 127.0.0.0/8
    }

    // Block URLs that are too long
    if (url.length > 2048) return false;

    return true;
  } catch {
    return false;
  }
}
