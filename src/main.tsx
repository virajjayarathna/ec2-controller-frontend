import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from 'react-oidc-context'
import type { User } from 'oidc-client-ts';

// --- ADDED: Cognito Config ---
const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_WErHEjlIt",
  client_id: "4dvl10ougak8vdakaj9e2cn3t3",
  redirect_uri: "https://ec2-controller.kingitsolutions.net",
  response_type: "code",
  scope: "email openid phone",

  // --- THIS IS THE FIX ---
  // Changed 'user' to '_user' to fix TS6133 (noUnusedParameters)
  onSigninCallback: (_user: User | void) => {
    window.history.replaceState(null, "", window.location.pathname);
  },
  // -------------------------
};
// -----------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>,
)