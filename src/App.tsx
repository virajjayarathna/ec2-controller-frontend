import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import { useAuth } from 'react-oidc-context';

const API_URL = import.meta.env.VITE_API_URL;
const COOLDOWN_MS = 300000; 

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
  const auth = useAuth();

  const signOutRedirect = () => {
    auth.removeUser(); 
    
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const logoutUri = import.meta.env.VITE_APP_REDIRECT_URI;
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
    
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };


  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cooldownInstances, setCooldownInstances] = useState<string[]>([]);

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

  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchInstances();
    }
  }, [auth.isAuthenticated]);

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

    } catch (err)
      {
      console.error(err);
      setError(`Failed to ${action}. Check console.`);
      setCooldownInstances(prev => prev.filter(id => id !== instanceId));
    }
  };

  const isInstanceInCooldown = (instanceId: string) => {
    return cooldownInstances.includes(instanceId);
  };

  if (auth.isLoading) {
    return <div className="loading-text">Loading authentication...</div>;
  }

  if (auth.error) {
    return <div className="loading-text" style={{ color: 'red' }}>Authentication Error: {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
    return (
      <>
        <div className="auth-header">
          <span>Hello, {auth.user?.profile.email}</span>
          <button onClick={() => signOutRedirect()} className="btn-logout">
            Sign Out
          </button>
        </div>

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

  return (
    <div className="login-container">
      <h1>EC2 Self-Service Portal</h1>
      <p>Please sign in to continue.</p>
      <button onClick={() => auth.signinRedirect()} className="btn-login">
        Login
      </button>
    </div>
  );
}

export default App;
