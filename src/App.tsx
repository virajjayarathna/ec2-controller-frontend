import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from 'react-oidc-context'; // Import useAuth hook
import './App.css';

// Your API Gateway Invoke URL
const API_URL = "https://fp39v1gzh6.execute-api.us-east-1.amazonaws.com/api";

// Cooldown time in milliseconds (5 minutes)
const COOLDOWN_MS = 300000;

// Interface defining the structure of instance information
interface InstanceInfo {
  accountId: string;
  accountName: string;
  instanceId: string;
  instanceType: string;
  region: string;
  state: string;
  name: string;
  env: string;
}

// --- NEW: Separate component for the EC2 Instance Management UI ---
// This makes the main App component cleaner and focused on auth state
function InstanceManager() {
  const auth = useAuth(); // Get auth context again if needed (e.g., for token)
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cooldownInstances, setCooldownInstances] = useState<string[]>([]);

  // --- MODIFIED: Use useCallback to memoize fetchInstances ---
  // Prevents recreation on every render unless dependencies change (auth token)
  const fetchInstances = useCallback(async () => {
    setError(null);
    if (!auth.user?.id_token) {
        setError("Authentication token not available.");
        setIsInitialLoading(false);
        return; // Don't fetch if no token
    }

    try {
      const response = await axios.post(
        API_URL,
        { action: "listInstances" },
        { // --- NEW: Add Authorization header ---
          headers: {
            Authorization: `Bearer ${auth.user.id_token}`,
          },
        }
      );
      const sortedData = response.data.sort((a: InstanceInfo, b: InstanceInfo) =>
        a.name.localeCompare(b.name)
      );
      setInstances(sortedData);
    } catch (err) {
      console.error("Fetch instances error:", err);
      // Check if it's an Axios error and provide more detail
      if (axios.isAxiosError(err)) {
        setError(`Failed to fetch instances: ${err.response?.statusText || err.message}. Check console.`);
      } else {
        setError("Failed to fetch instances. Check console for details.");
      }
    } finally {
      setIsInitialLoading(false);
    }
  // --- DEPENDENCY: Include auth.user?.id_token in dependency array ---
  }, [auth.user?.id_token]);


  // Run fetchInstances when the component mounts and when the token changes
  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]); // fetchInstances is memoized

  // --- MODIFIED: Use useCallback for handleInstanceAction ---
  const handleInstanceAction = useCallback(async (
    instanceId: string,
    accountId: string,
    region: string,
    action: "startInstance" | "stopInstance"
  ) => {
    if (!auth.user?.id_token) {
      setError("Authentication token not available for action.");
      return; // Don't perform action if no token
    }

    setCooldownInstances(prev => [...prev, instanceId]);
    setError(null);

    try {
      await axios.post(
        API_URL,
        {
          action: action,
          instanceId: instanceId,
          accountId: accountId,
          region: region,
        },
        { // --- NEW: Add Authorization header ---
          headers: {
            Authorization: `Bearer ${auth.user.id_token}`,
          },
        }
      );

      // Refresh list immediately after successful action *request*
      // (The actual instance state change might take time)
      fetchInstances();

      setTimeout(() => {
        setCooldownInstances(prev => prev.filter(id => id !== instanceId));
        // Optional: Could refresh again here if needed, but the first refresh should catch the state change eventually
        // fetchInstances();
      }, COOLDOWN_MS);

    } catch (err) {
      console.error(`${action} error:`, err);
      if (axios.isAxiosError(err)) {
          setError(`Failed to ${action}: ${err.response?.statusText || err.message}. Check console.`);
      } else {
        setError(`Failed to ${action}. Check console.`);
      }
      setCooldownInstances(prev => prev.filter(id => id !== instanceId));
    }
  // --- DEPENDENCIES: Include auth.user?.id_token and fetchInstances ---
  }, [auth.user?.id_token, fetchInstances]);

  // Helper to check if an instance is in cooldown
  const isInstanceInCooldown = (instanceId: string) => {
    return cooldownInstances.includes(instanceId);
  };

  // Render the Instance Manager UI
  return (
    <>
      <h1>AWS EC2 Self-Service Portal</h1>
       {/* --- NEW: Display User Email --- */}
       <div className="text-center mb-4 text-gray-600">
         Logged in as: {auth.user?.profile?.email}
       </div>
      <button
        onClick={fetchInstances}
        // Disable refresh if any instance is cooling down OR if currently loading
        disabled={cooldownInstances.length > 0 || isInitialLoading}
        className="btn-refresh"
      >
        {isInitialLoading ? 'Loading...' : cooldownInstances.length > 0 ? 'Working...' : 'Refresh List'}
      </button>

      {isInitialLoading && <p className="loading-text">Loading instances...</p>}
      {error && <p className="loading-text" style={{ color: 'red' }}>Error: {error}</p>}

      {!isInitialLoading && !error && instances.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Instance ID</th>
              <th>Type</th>
              <th>Account</th>
              <th>Env Tag</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((instance) => (
              <tr key={instance.instanceId}>
                <td>{instance.name}</td>
                <td>
                  <span className={`state-${instance.state}`}>{instance.state}</span>
                </td>
                <td>{instance.instanceId}</td>
                <td>{instance.instanceType}</td>
                <td>{instance.accountName} ({instance.accountId})</td>
                <td>{instance.env}</td>
                <td>
                  <button
                    className="btn-start"
                    disabled={instance.state !== 'stopped' || isInstanceInCooldown(instance.instanceId)}
                    onClick={() => handleInstanceAction(instance.instanceId, instance.accountId, instance.region, 'startInstance')}
                  >
                    Start
                  </button>
                  <button
                    className="btn-stop"
                    disabled={instance.state !== 'running' || isInstanceInCooldown(instance.instanceId)}
                    onClick={() => handleInstanceAction(instance.instanceId, instance.accountId, instance.region, 'stopInstance')}
                  >
                    Stop
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
       {!isInitialLoading && !error && instances.length === 0 && (
           <p className="loading-text">No instances found or you may not have permission to view them.</p>
       )}
    </>
  );
}


// --- Main App component now handles authentication state ---
function App() {
  const auth = useAuth(); // Get authentication status and methods

  // --- Handle Auth Loading State ---
  if (auth.isLoading) {
    return <div className="loading-text">Loading authentication...</div>;
  }

  // --- Handle Auth Error State ---
  if (auth.error) {
    return <div className="loading-text" style={{color: 'red'}}>Authentication Error: {auth.error.message}</div>;
  }

  // --- Handle Authenticated State ---
  if (auth.isAuthenticated) {
    return (
      <div className="container mx-auto p-4">
        {/* Render the Instance Manager component */}
        <InstanceManager />

        {/* Sign Out Button */}
        <div className="mt-6 text-center">
            {/* Use signoutRedirect for standard OIDC logout */}
             <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition duration-200"
                onClick={() => auth.signoutRedirect()} // Use standard OIDC signout
                >
                Sign out
            </button>
            {/* Display token info - useful for debugging, remove for production */}
             <details className="mt-4 text-left text-xs text-gray-500 bg-gray-100 p-2 rounded">
                 <summary>Token Information (Debug)</summary>
                 <pre className="whitespace-pre-wrap break-all">ID Token: {auth.user?.id_token}</pre>
                 {/* <pre className="whitespace-pre-wrap break-all">Access Token: {auth.user?.access_token}</pre> */}
                 {/* <pre className="whitespace-pre-wrap break-all">Refresh Token: {auth.user?.refresh_token}</pre> */}
             </details>
        </div>
      </div>
    );
  }

  // --- Handle Unauthenticated State ---
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
       <h1 className="text-2xl font-bold mb-6">AWS EC2 Self-Service Portal</h1>
      <p className="mb-4">Please sign in to manage your instances.</p>
      <button
        className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-200"
        onClick={() => auth.signinRedirect()} // Initiate sign-in flow
      >
        Sign in with Cognito
      </button>
       {/* Note: The custom signOutRedirect is removed as auth.signoutRedirect is generally preferred */}
    </div>
  );
}

export default App;
