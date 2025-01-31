import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [message, setMessage] = useState(''); // State to hold the message
  // Define the async function to trigger the IPC call
  const triggerIPC = async () => {
    try {
      // Call the method exposed in preload.js to trigger the IPC
      console.log('Step 1');
      await window.electron.startTrigger('trigger-channel');
    } catch (error) {
      console.error('Failed to trigger IPC:', error);
    }
  };

  // JSX to render the component
  const pattern = (
    <div>
      <h2>Hello GCASP</h2>
      <button onClick={triggerIPC}>Trigger IPC</button>
      <p>{ message }</p> {/* Display the message */}
    </div>
  );

  return pattern;
}

const root = createRoot(document.body);
root.render(<App />);
