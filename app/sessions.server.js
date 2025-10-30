// [START step5-session-storage]
import { createCookieSessionStorage } from "react-router";

/**
 * Customer session storage for Customer Account API authentication
 * Stores customer access token ID in an encrypted, HTTP-only cookie
 */
export const customerSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__customer_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "default-secret-change-in-production"],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60, // 1 hour (3600 seconds)
  },
});

/**
 * Helper to get customer token ID from session
 * @param {Request} request - The incoming request
 * @returns {Promise<string|null>} The customer token ID or null
 */
export async function getCustomerTokenId(request) {
  const session = await customerSessionStorage.getSession(
    request.headers.get("Cookie")
  );
  return session.get("customerTokenId");
}

/**
 * Helper to set customer token ID in session
 * @param {Request} request - The incoming request
 * @param {string} tokenId - The customer token ID to store
 * @returns {Promise<string>} Set-Cookie header value
 */
export async function setCustomerTokenId(request, tokenId) {
  const session = await customerSessionStorage.getSession(
    request.headers.get("Cookie")
  );
  session.set("customerTokenId", tokenId);
  return customerSessionStorage.commitSession(session);
}

/**
 * Helper to destroy customer session
 * @param {Request} request - The incoming request
 * @returns {Promise<string>} Set-Cookie header value
 */
export async function destroyCustomerSession(request) {
  const session = await customerSessionStorage.getSession(
    request.headers.get("Cookie")
  );
  return customerSessionStorage.destroySession(session);
}
// [END step5-session-storage]
