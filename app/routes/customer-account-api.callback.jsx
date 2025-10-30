import { redirect } from "react-router";
import { useLoaderData } from "react-router";
import prisma from "../db.server";
import { setCustomerTokenId } from "../sessions.server";

export const loader = async ({ request }) => {
  try {
    // [START step6-extract-params]
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      throw new Error("Missing code or state parameter");
    }
    // [END step6-extract-params]

    // [START step6-retrieve-verifier]
    // Retrieve the code verifier from the database
    const codeVerifierRecord = await prisma.codeVerifier.findUnique({
      where: { state },
    });

    if (!codeVerifierRecord) {
      throw new Error("Invalid state parameter or code verifier not found");
    }
    // [END step6-retrieve-verifier]

    // [START step6-fetch-token-endpoint]
    // Fetch OpenID configuration to get token endpoint
    const openidConfigUrl = `https://${process.env.SHOP_STOREFRONT_DOMAIN}/.well-known/openid-configuration`;
    const openidResponse = await fetch(openidConfigUrl);

    if (!openidResponse.ok) {
      throw new Error(`Failed to fetch OpenID configuration: ${openidResponse.statusText}`);
    }

    const openidConfig = await openidResponse.json();
    const tokenEndpoint = openidConfig.token_endpoint;
    // [END step6-fetch-token-endpoint]

    // Get callback URL
    const callbackUrl = `https://${url.host}/customer-account-api/callback`;

    // Get client_id from environment or config
    const clientId = process.env.SHOPIFY_API_KEY;

    // [START step6-exchange-token]
    // Exchange authorization code for access token
    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        code: code,
        code_verifier: codeVerifierRecord.verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.statusText} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    // [END step6-exchange-token]

    // Calculate token expiration
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // [START step6-store-token]
    // Store the access token in the database
    const customerAccessToken = await prisma.customerAccessToken.create({
      data: {
        shop: process.env.SHOP_STOREFRONT_DOMAIN,
        accessToken: tokenData.access_token,
        expiresAt,
      },
    });

    // Clean up the used code verifier
    await prisma.codeVerifier.delete({
      where: { state },
    });
    // [END step6-store-token]

    // [START step6-redirect]
    // Store tokenId in session cookie and redirect to order list
    const setCookieHeader = await setCustomerTokenId(request, customerAccessToken.id);
    return redirect("/customer-account-api/order-list", {
      headers: {
        "Set-Cookie": setCookieHeader,
      },
    });
    // [END step6-redirect]
  } catch (error) {
    console.error("Error in callback:", error);
    return {
        success: false,
        error: error.message,
    };
  }
};

export default function CustomerAccountApiCallback() {
  const data = useLoaderData();

  // Only renders if there's an error (otherwise loader redirects)
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Customer Account API - Callback Error</h1>
      <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#ffebee", borderRadius: "8px" }}>
        <h2>Authentication Error</h2>
        <p style={{ color: "#c62828" }}>{data?.error || "An error occurred during authentication"}</p>
      </div>
      <a href="/customer-account-api/auth" style={{ marginTop: "1rem", display: "inline-block", color: "#1976d2" }}>
        Try again
      </a>
    </div>
  );
}
