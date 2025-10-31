
import { redirect, useLoaderData } from "react-router";
import crypto from "crypto";
import prisma from "../db.server";

// [START step4-define-pkce-helpers]
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function generateState() {
  return crypto.randomBytes(16).toString("base64url");
}
// [END step4-define-pkce-helpers]

export const loader = async ({ request }) => {
  try {
    // [START step4-fetch-openid]
    // Fetch OpenID configuration
    const openidConfigUrl = `https://${process.env.SHOP_STOREFRONT_DOMAIN}/.well-known/openid-configuration`;
    const openidResponse = await fetch(openidConfigUrl);

    if (!openidResponse.ok) {
      throw new Error(`Failed to fetch OpenID configuration: ${openidResponse.statusText}`);
    }

    const openidConfig = await openidResponse.json();
    const authorizationEndpoint = openidConfig.authorization_endpoint;
    // [END step4-fetch-openid]

    // [START step4-generate-and-store]
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store code verifier in database
    await prisma.codeVerifier.create({
      data: {
        state,
        verifier: codeVerifier,
      },
    });
    // [END step4-generate-and-store]

    // [START step4-build-auth-url]
    // Get the callback URL from the request
    const url = new URL(request.url);
    const callbackUrl = `https://${url.host}/customer-account-api/callback`;

    // Get client_id from environment or config
    const clientId = process.env.SHOPIFY_API_KEY;

    // Build authorization URL
    const authUrl = new URL(authorizationEndpoint);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("scope", "openid email customer-account-api:full");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    // Redirect directly to the authorization URL
    return redirect(authUrl.toString());
   
  } catch (error) {
    console.error("Error generating auth URL:", error);
    // If there's an error, return error data to display
    return {
      error: error.message,
    };
  }
};

export default function CustomerAccountApiAuth() {
  const data = useLoaderData();

  // Only renders if there's an error (otherwise loader redirects)
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Customer Account API - Authentication Error</h1>
      <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#ffebee", borderRadius: "8px" }}>
        <h2>Error</h2>
        <p style={{ color: "#c62828" }}>{data?.error || "An unexpected error occurred"}</p>
      </div>
      <a href="/customer-account-api/auth" style={{ marginTop: "1rem", display: "inline-block" }}>
        Try again
      </a>
    </div>
  );
}
// [END step4-build-auth-url]

