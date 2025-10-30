import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from 'react-oidc-context'
import type { User } from 'oidc-client-ts'; // <-- 1. IMPORT THIS TYPE

// --- ADDED: Cognito Config ---
const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_WErHEjlIt",
  client_id: "4dvl10ougak8vdakaj9e2cn3t3",
  redirect_uri: "https://ec2-controller.kingitsolutions.net",
  response_type: "code",
  scope: "email openid phone",

  // --- 2. THIS IS THE FIX ---
  // This callback runs after a successful sign-in
  // and removes the query parameters from the URL.
  onSigninCallback: (user: User | void) => {
    window.history.replaceState(null, "", window.location.pathname);
  },
  // -------------------------
};
// -----------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* --- MODIFIED: Wrapped App with AuthProvider --- */}
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>,
)