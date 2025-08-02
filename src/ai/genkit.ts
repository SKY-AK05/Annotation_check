
import {genkit, Plugin, isDev, localFileStore} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {config} from 'dotenv';


config();

const plugins: Plugin[] = [
  googleAI({
    apiVersion: ['v1beta'],
  }),
];

if (isDev) {
  plugins.push(localFileStore());
}


export const ai = genkit({
  plugins,
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
