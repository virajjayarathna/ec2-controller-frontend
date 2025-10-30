import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import { useAuth } from 'react-oidc-context'; // <-- ADDED

// Your API Gateway Invoke URL
const API_URL = "https://fp39v1gzh6.execute-api.us-east-1.amazonaws.com/api";

// --- NEW: Cooldown time as requested ---
const COOLDOWN_MS = 300000; // 5 minutes

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

function App() {
  // --- ADDED: Auth logic from snippet ---
  const auth = useAuth();

const signOutRedirect = () => {
    // --- THIS IS THE FIX ---
    // 1. Clear the user from the local app's storage
    auth.removeUser(); 
    // ----------------------

    // 2. Redirect to Cognito to log out from the "master" session
    const clientId = "4dvl10ougak8vdakaj9e2cn3t3";
    const logoutUri = "https://ec2-controller.kingitsolutions.net";
    const cognitoDomain = "https://us-east-1werhejlit.auth.us-east-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };
  // ------------------------------------

  // --- EXISTING: State for your EC2 portal ---
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cooldownInstances, setCooldownInstances] = useState<string[]>([]);

  // --- EXISTING: Function to fetch all instances ---
  const fetchInstances = async () => {
    setError(null);
    try {
      const response = await axios.post(API_URL, {
        action: "listInstances"
      });
      const sortedData = response.data.sort((a: InstanceInfo, b: InstanceInfo) =>
        a.name.localeCompare(b.name)
      );
      setInstances(sortedData);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch instances. Check console for details.");
    } finally {
      setIsInitialLoading(false);
    }
  };

  // --- MODIFIED: This now only runs when authenticated ---
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchInstances();
    }
    // We add auth.isAuthenticated as a dependency.
    // This will trigger fetchInstances() once auth is ready.
  }, [auth.isAuthenticated]);

  // --- EXISTING: Function to handle Start/Stop button clicks ---
  const handleInstanceAction = async (
    instanceId: string,
    accountId: string,
    region: string,
    action: "startInstance" | "stopInstance"
  ) => {
    setCooldownInstances(prev => [...prev, instanceId]);
    setError(null);
    
    try {
      await axios.post(API_URL, {
        action: action,
        instanceId: instanceId,
        accountId: accountId,
        region: region
      });
      
      setTimeout(() => {
        setCooldownInstances(prev => prev.filter(id => id !== instanceId));
        fetchInstances();
      }, COOLDOWN_MS);

    } catch (err) {
      console.error(err);
      setError(`Failed to ${action}. Check console.`);
      setCooldownInstances(prev => prev.filter(id => id !== instanceId));
    }
  };

  // --- EXISTING: Helper to check if an instance is in cooldown ---
  const isInstanceInCooldown = (instanceId: string) => {
    return cooldownInstances.includes(instanceId);
  };

  // --- ADDED: Auth loading state ---
  if (auth.isLoading) {
    return <div className="loading-text">Loading authentication...</div>;
  }

  // --- ADDED: Auth error state ---
  if (auth.error) {
    return <div className="loading-text" style={{ color: 'red' }}>Authentication Error: {auth.error.message}</div>;
  }

  // --- ADDED: Auth authenticated state ---
  // This wraps your entire existing portal UI
  if (auth.isAuthenticated) {
    return (
      <>
        {/* --- ADDED: Auth header with user info and logout button --- */}
        <div className="auth-header">
          <span>Hello, {auth.user?.profile.email}</span>
          <button onClick={() => signOutRedirect()} className="btn-logout">
            Sign Out
          </button>
        </div>
        {/* -------------------------------------------------------- */}

        <h1>AWS EC2 Self-Service Portal</h1>
        <button onClick={fetchInstances} disabled={cooldownInstances.length > 0} className="btn-refresh">
          {cooldownInstances.length > 0 ? 'Working...' : 'Refresh List'}
        </button>

        {isInitialLoading && <p className="loading-text">Loading instances...</p>}
        {error && <p className="loading-text" style={{ color: 'red' }}>{error}</p>}
        
        {!isInitialLoading && !error && (
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
      </>
    );
  }

  // --- ADDED: Auth unauthenticated state (Sign in button) ---
  return (
    <div className="login-container">
      <h1>EC2 Self-Service Portal</h1>
      <p>Please sign in to continue.</p>
      <button onClick={() => auth.signinRedirect()} className="btn-login">
        Sign In
      </button>
    </div>
  );
}

export default App;