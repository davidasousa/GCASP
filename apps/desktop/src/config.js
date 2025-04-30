// Flip this to true when you want to point at the real GCASP API.
export const useProdApi = true;

// The two URLs you’re switching between:
const LOCAL_API_URL    = 'http://localhost:5001';
const GCASP_API_URL    = 'http://gcasp.us-east-2.elasticbeanstalk.com';

// Export the one your app should use:
export const API_URL = useProdApi ? GCASP_API_URL : LOCAL_API_URL;
