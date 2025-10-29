import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context'; // Import AuthProvider
import './index.css';
import App from './App.tsx';

// --- NEW: Cognito OIDC Configuration ---
// Configuration object for react-oidc-context using your Cognito User Pool details
const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_WErHEjlIt",
  client_id: "4dvl10ougak8vdakaj9e2cn3t3",
  redirect_uri: window.location.origin, // Use current origin for redirect URI
  // You might need to adjust the redirect_uri based on where your app is hosted
  // If "https://ec2-controller.kingitsolutions.net" is the correct final URL, use that.
  // Using window.location.origin is often better for development/dynamic environments.
  response_type: "code",
  // --- MODIFIED: Scope updated to only request openid and email ---
  scope: "openid email", // Ensure these are enabled in Cognito App Client
  // If your API needs access tokens, you might add custom scopes here later.

  // Optional: Add post_logout_redirect_uri if you want users redirected after logout
  // post_logout_redirect_uri: window.location.origin,

  // Optional: Event listeners for debugging or other actions
  // onSigninCallback: (_user: User | void): void => {
  //   window.history.replaceState({}, document.title, window.location.pathname);
  // },
};

// Get the root element from the DOM
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

// Create the React root
const root = createRoot(rootElement);

// Render the application, wrapping App with AuthProvider
root.render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>,
);


