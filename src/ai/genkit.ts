
'use server';
import {genkit, Plugin, configureGenkit, isDev} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
// import { firebase } from '@genkit-ai/firebase'; // Temporarily removed to fix build error
import {config} from 'dotenv';
import { durableStore, localFileStore } from 'genkit/local';


config();

// const firebasePlugin = firebase(); // Temporarily removed

const plugins: Plugin[] = [
  googleAI({
    apiVersion: ['v1beta'],
  }),
];

if (isDev()) {
  plugins.push(durableStore());
  plugins.push(localFileStore());
}


// if (prod) {
  // plugins.push(firebasePlugin); // Temporarily removed
// }


export const ai = genkit({
  plugins,
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
