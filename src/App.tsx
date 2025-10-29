import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

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
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  // --- FIX: Renamed 'loading' to 'isInitialLoading' ---
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // --- NEW: This array will hold the IDs of instances in "cooldown" ---
  const [cooldownInstances, setCooldownInstances] = useState<string[]>([]);

  // Function to fetch all instances
  const fetchInstances = async () => {
    // --- FIX: We no longer set a "loading" state here ---
    // This stops the table from disappearing on refresh.
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
      // This will set loading to false *only* after the first load
      setIsInitialLoading(false);
    }
  };

  // Run fetchInstances() once when the component loads
  useEffect(() => {
    fetchInstances();
  }, []);

  // Function to handle Start/Stop button clicks
  const handleInstanceAction = async (
    instanceId: string,
    accountId: string,
    region: string,
    action: "startInstance" | "stopInstance"
  ) => {
    // 1. Immediately add instance to cooldown list to disable buttons
    setCooldownInstances(prev => [...prev, instanceId]);
    setError(null);
    
    try {
      // 2. Make the API call to start/stop the instance
      await axios.post(API_URL, {
        action: action,
        instanceId: instanceId,
        accountId: accountId,
        region: region
      });
      
      // 3. Set a 5-minute timer
      setTimeout(() => {
        // 4. After 5 minutes, remove the instance from cooldown
        setCooldownInstances(prev => prev.filter(id => id !== instanceId));
        // 5. And refresh the instance list
        fetchInstances();
      }, COOLDOWN_MS);

    } catch (err) {
      console.error(err);
      setError(`Failed to ${action}. Check console.`);
      // If the API call *itself* fails, remove from cooldown immediately
      setCooldownInstances(prev => prev.filter(id => id !== instanceId));
    }
  };

  // Helper to check if an instance is in cooldown
  const isInstanceInCooldown = (instanceId: string) => {
    return cooldownInstances.includes(instanceId);
  };

  return (
    <>
      <h1>AWS EC2 Self-Service Portal</h1>
      <button onClick={fetchInstances} disabled={cooldownInstances.length > 0} className="btn-refresh">
        {cooldownInstances.length > 0 ? 'Working...' : 'Refresh List'}
      </button>

      {/* --- FIX: This now only shows on the *very first* load --- */}
      {isInitialLoading && <p className="loading-text">Loading instances...</p>}
      {error && <p className="loading-text" style={{ color: 'red' }}>{error}</p>}
      
      {/* --- FIX: The table now *always* shows after the first load --- */}
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
                    // Disable if state is not 'stopped' OR if it's in cooldown
                    disabled={instance.state !== 'stopped' || isInstanceInCooldown(instance.instanceId)}
                    onClick={() => handleInstanceAction(instance.instanceId, instance.accountId, instance.region, 'startInstance')}
                  >
                    Start
                  </button>
                  <button
                    className="btn-stop"
                    // Disable if state is not 'running' OR if it's in cooldown
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

export default App;