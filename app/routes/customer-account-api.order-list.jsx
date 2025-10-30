import { useLoaderData } from "react-router";
import { useState, useEffect } from "react";
import prisma from "../db.server";
import { getCustomerTokenId } from "../sessions.server";

export const loader = async ({ request }) => {
  try {
    // [START step7-get-token-id]
    // Get tokenId from session cookie
    const tokenId = await getCustomerTokenId(request);

    if (!tokenId) {
      throw new Error("No customer authentication found. Please authenticate first.");
    }
    // [END step7-get-token-id]

    // [START step7-fetch-token]
    // Fetch the access token from the database
    const customerAccessToken = await prisma.customerAccessToken.findUnique({
      where: { id: tokenId },
    });

    if (!customerAccessToken) {
      throw new Error("Access token not found");
    }

    // Check if token is expired
    if (customerAccessToken.expiresAt && new Date() > customerAccessToken.expiresAt) {
      throw new Error("Access token has expired");
    }
    // [END step7-fetch-token]

    // Get shop domain for client-side API calls
    const shopDomain = process.env.SHOP_STOREFRONT_DOMAIN;

    // [START step7-fetch-api-config]
    // Fetch Customer Account API configuration
    const wellKnownUrl = `https://${shopDomain}/.well-known/customer-account-api`;
    const wellKnownResponse = await fetch(wellKnownUrl);

    if (!wellKnownResponse.ok) {
      throw new Error(`Failed to fetch Customer Account API configuration: ${wellKnownResponse.statusText}`);
    }

    const wellKnownConfig = await wellKnownResponse.json();
    const graphqlApiUrl = wellKnownConfig.graphql_api;
    // [END step7-fetch-api-config]

    return {
      success: true,
      tokenId: customerAccessToken.id,
      accessToken: customerAccessToken.accessToken,
      shop: customerAccessToken.shop,
      graphqlApiUrl,
      expiresAt: customerAccessToken.expiresAt?.toISOString(),
    };
  } catch (error) {
    console.error("Error loading access token:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export default function CustomerAccountApiOrderList() {
  const data = useLoaderData();
  const [customerData, setCustomerData] = useState(null);
  const [customerApiError, setCustomerApiError] = useState(null);
  const [isLoadingCustomerData, setIsLoadingCustomerData] = useState(false);

  // [START step7-query-api]
  // Query Customer Account API on the frontend when access token is available
  useEffect(() => {
    if (data.success && data.accessToken) {
      setIsLoadingCustomerData(true);

      const queryCustomerApi = async () => {
        try {
          const response = await fetch(data.graphqlApiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": data.accessToken,
            },
            body: JSON.stringify({
              query: `
                query {
                  customer {
                    id
                    emailAddress {
                      emailAddress
                    }
                    firstName
                    lastName
                    orders(first: 10) {
                      edges {
                        node {
                          id
                          name
                        }
                      }
                    }
                  }
                }
              `,
            }),
          });

          if (response.ok) {
            const apiResult = await response.json();
            if (apiResult.data?.customer) {
              console.log(apiResult.data.customer);
              setCustomerData(apiResult.data.customer);
            } else if (apiResult.errors) {
              setCustomerApiError(JSON.stringify(apiResult.errors, null, 2));
            }
          } else {
            const errorText = await response.text();
            setCustomerApiError(`API request failed: ${response.status} - ${errorText}`);
          }
        } catch (error) {
          setCustomerApiError(`Failed to query Customer Account API: ${error.message}`);
          console.error("Customer API query error:", error);
        } finally {
          setIsLoadingCustomerData(false);
        }
      };

      queryCustomerApi();
    }
  }, [data.success, data.accessToken, data.graphqlApiUrl]);
  // [END step7-query-api]

  if (!data.success) {
    return (
      <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <h1>Customer Account API - Order List</h1>
        <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#ffebee", borderRadius: "8px" }}>
          <h2>Error</h2>
          <p style={{ color: "#c62828" }}>{data.error}</p>
        </div>
        <a href="/customer-account-api/auth" style={{ marginTop: "1rem", display: "inline-block" }}>
          Authenticate
        </a>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Customer Orders</h1>

      {isLoadingCustomerData && (
        <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#e3f2fd", borderRadius: "8px" }}>
          <h3>Loading Orders...</h3>
          <p style={{ fontSize: "0.875rem", color: "#666" }}>
            Fetching your order history from the Customer Account API...
          </p>
        </div>
      )}

      {customerData && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ padding: "1rem", backgroundColor: "#e8f5e9", borderRadius: "8px", marginBottom: "1rem" }}>
            <h3 style={{ marginTop: 0 }}>Customer Information</h3>
            <p style={{ margin: "0.5rem 0" }}>
              <strong>Email:</strong> {customerData.emailAddress?.emailAddress || "N/A"}
            </p>
            <p style={{ margin: "0.5rem 0" }}>
              <strong>First Name:</strong> {customerData.firstName || "N/A"}
            </p>
            <p style={{ margin: "0.5rem 0" }}>
              <strong>Last Name:</strong> {customerData.lastName || "N/A"}
            </p>
          </div>

          {customerData.orders?.edges && customerData.orders.edges.length > 0 ? (
            <div>
              <h3>Orders ({customerData.orders.edges.length})</h3>
              <ul style={{ listStyleType: "disc", paddingLeft: "1.5rem" }}>
                {customerData.orders.edges.map((orderEdge) => {
                  const order = orderEdge.node;
                  return (
                    <li key={order.id} style={{ marginBottom: "0.5rem" }}>
                      <strong>{order.name}</strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#fff9e6", borderRadius: "4px" }}>
              <em>No orders found for this customer.</em>
            </div>
          )}
        </div>
      )}

      {customerApiError && (
        <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#ffebee", borderRadius: "8px" }}>
          <h3>❌ Customer Account API Error</h3>
          <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
            Error occurred while querying the Customer Account API:
          </p>
          <pre style={{
            marginTop: "0.5rem",
            padding: "1rem",
            backgroundColor: "#fff",
            border: "1px solid #ef9a9a",
            borderRadius: "4px",
            fontSize: "0.75rem",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0
          }}>
            {customerApiError}
          </pre>
        </div>
      )}
    </div>
  );
}
