import { readConfig } from './config.js';
import { createFirebaseTokenVerifier } from './auth.js';
import { createStateServer } from './stateServer.js';

const config = readConfig();
const tokenVerifier = createFirebaseTokenVerifier(config);
const { httpServer } = createStateServer({ config, tokenVerifier });

httpServer.listen(config.port, () => {
  console.log(`paravoxia-state-server listening on :${config.port}`);
});
