
import {genkit, Plugin, isDev, localFileStore} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';


config();

const plugins: Plugin[] = [
  googleAI({
    apiVersion: ['v1beta'],
  }),
];

// If a second API key is provided, configure a separate instance of the Google AI plugin.
// This allows for fallback logic if the primary key hits its rate limit.
if (process.env.SECOND_GEMINI_API_KEY) {
  plugins.push(googleAI({
    apiKey: process.env.SECOND_GEMINI_API_KEY,
    id: 'googleai-fallback', // Give it a unique ID to distinguish it from the default
    apiVersion: ['v1beta'],
  }));
}


if (isDev) {
  plugins.push(localFileStore());
}


export const ai = genkit({
  plugins,
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
