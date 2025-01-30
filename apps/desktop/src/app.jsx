import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [message, setMessage] = useState(''); // State to hold the message

  // Define the async function to trigger the IPC call
  const triggerIPC = async () => {
    try {
      // Call the method exposed in preload.js to trigger the IPC
      const result = await window.electron.getData();
      console.log(result.message); // Log the message from main process
      setMessage(result.message); // Set the message in state
    } catch (error) {
      console.error('Failed to trigger IPC:', error);
    }
  };

  // JSX to render the component
  const pattern = (
    <div>
      <h2>Hello GCASP</h2>
      <button onClick={triggerIPC}>Trigger IPC</button> {/* Correctly set the onClick handler */}
      <p>{message}</p> {/* Display the message */}
    </div>
  );

  return pattern;
}

const root = createRoot(document.body);
root.render(<App />);
