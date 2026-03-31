#!/usr/bin/env node
/**
 * Generate API Token for Client Website
 *
 * Usage:
 *   node scripts/generate-api-token.js <email> <password> <tenant-id> [token-name]
 *
 * Example:
 *   node scripts/generate-api-token.js admin@demo.com Admin@12345 tenant-uuid-xxx "Client Website"
 */

require('dotenv').config({ path: './apps/admin-api/.env' });

const API_BASE = process.env.PLATFORM_API_URL || 'http://localhost:3001';

async function main() {
  const [, , email, password, tenantId, tokenName = 'Client Website'] =
    process.argv;

  if (!email || !password || !tenantId) {
    console.log(`
Usage: node scripts/generate-api-token.js <email> <password> <tenant-id> [token-name]

Example:
  node scripts/generate-api-token.js admin@demo.com Admin@12345 abc-123-xyz "My Blog"
    `);
    process.exit(1);
  }

  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await fetch(`${API_BASE}/admin/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json();

    if (!loginData.success) {
      throw new Error(loginData.error?.message || 'Login failed');
    }

    const accessToken = loginData.data.accessToken;
    const refreshToken = loginData.data.refreshToken;
    console.log('✓ Logged in');

    // 2. Switch to tenant
    console.log(`Switching to tenant ${tenantId}...`);
    const switchRes = await fetch(`${API_BASE}/admin/v1/auth/switch-tenant`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantId, refreshToken }),
    });
    const switchData = await switchRes.json();

    if (!switchData.success) {
      throw new Error(switchData.error?.message || 'Switch tenant failed');
    }

    const tenantToken = switchData.data.accessToken;
    const tenantRefreshToken = switchData.data.refreshToken;
    console.log('✓ Switched to tenant');

    // 3. Create API token
    console.log('Creating API token...');
    const tokenRes = await fetch(`${API_BASE}/admin/v1/api-tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: tokenName,
        scopes: ['posts:read', 'config:read', 'categories:read', 'tags:read'],
        rateLimitRpm: 300,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.success) {
      throw new Error(tokenData.error?.message || 'Token creation failed');
    }

    const apiToken = tokenData.data.token;

    console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                     API TOKEN GENERATED SUCCESSFULLY                     ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  Token Name: ${tokenName.padEnd(54)}║
║                                                                          ║
║  ${apiToken.padEnd(68)}║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║  USAGE IN YOUR CLIENT WEBSITE:                                           ║
║                                                                          ║
║  Option 1 - Fetch API:                                                  ║
║                                                                          ║
║    fetch('${API_BASE}/api/v1/posts', {                    ║
║      headers: { 'X-API-Token': '${apiToken}' }    ║
║    })                                                                   ║
║                                                                          ║
║  Option 2 - Environment Variable:                                        ║
║                                                                          ║
║    PLATFORM_API_TOKEN=${apiToken}
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
