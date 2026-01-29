// Token refresh utilities for YouTube and Spotify OAuth
import { prisma } from '../config/database.js';
import { config } from '../config/env.js';
import { Platform } from '@prisma/client';
import type { ConnectedPlatform } from '@prisma/client';

// Token response interface for OAuth providers
interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Refresh YouTube access token using refresh token
 */
export async function refreshYouTubeToken(connection: ConnectedPlatform): Promise<string> {
  if (!connection.refreshToken) {
    throw new Error('No refresh token available for YouTube');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.youtube.clientId,
      client_secret: config.youtube.clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh YouTube token: ${error}`);
  }

  const tokens = await response.json() as OAuthTokenResponse;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Update token in database
  await prisma.connectedPlatform.update({
    where: { id: connection.id },
    data: {
      accessToken: tokens.access_token,
      expiresAt,
    },
  });

  return tokens.access_token;
}

/**
 * Refresh Spotify access token using refresh token
 */
export async function refreshSpotifyToken(connection: ConnectedPlatform): Promise<string> {
  if (!connection.refreshToken) {
    throw new Error('No refresh token available for Spotify');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Spotify token: ${error}`);
  }

  const tokens = await response.json() as OAuthTokenResponse;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Update token in database (Spotify may return a new refresh token)
  await prisma.connectedPlatform.update({
    where: { id: connection.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || connection.refreshToken,
      expiresAt,
    },
  });

  return tokens.access_token;
}

/**
 * Get valid access token, refreshing if needed
 */
export async function getValidToken(
  connection: ConnectedPlatform
): Promise<string> {
  // Check if token is expired or will expire in next 5 minutes
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  const isExpired = connection.expiresAt &&
    new Date(connection.expiresAt).getTime() < Date.now() + bufferTime;

  if (!isExpired) {
    return connection.accessToken;
  }

  // Refresh based on platform
  if (connection.platform === Platform.YOUTUBE) {
    return refreshYouTubeToken(connection);
  } else if (connection.platform === Platform.SPOTIFY) {
    return refreshSpotifyToken(connection);
  }

  return connection.accessToken;
}
