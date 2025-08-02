
'use server';
import {genkit, Plugin, durableStore, localFileStore, prod} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { firebase } from '@genkit-ai/firebase';
import {config} from 'dotenv';

config();

const firebasePlugin = firebase();

const plugins: Plugin[] = [
  googleAI({
    apiVersion: ['v1beta'],
  }),
];
if (prod) {
  plugins.push(firebasePlugin);
}

if (!prod) {
  durableStore({
    provider: 'local',
    options: {
      path: '.genkit/durableStore.json',
    },
  });
  localFileStore({
    path: '.genkit/flow-state',
  });
}

export const ai = genkit({
  plugins,
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
