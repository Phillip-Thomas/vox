import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';

export interface MultiplayerAuthEnv {
  readonly [key: string]: unknown;
  VITE_PARAVOXIA_COOP?: string;
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_PARAVOXIA_STATE_SERVER_URL?: string;
}

export interface MultiplayerSession {
  uid: string;
  idToken: string;
  anonymous: boolean;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function isCoopAuthEnabled(env: MultiplayerAuthEnv = import.meta.env): boolean {
  return env.VITE_PARAVOXIA_COOP === '1' || env.VITE_PARAVOXIA_COOP === 'true';
}

export function getFirebaseClientConfig(env: MultiplayerAuthEnv = import.meta.env): FirebaseOptions | null {
  const {
    VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_APP_ID
  } = env;
  if (!VITE_FIREBASE_API_KEY || !VITE_FIREBASE_AUTH_DOMAIN || !VITE_FIREBASE_PROJECT_ID || !VITE_FIREBASE_APP_ID) {
    return null;
  }
  return {
    apiKey: VITE_FIREBASE_API_KEY,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN,
    projectId: VITE_FIREBASE_PROJECT_ID,
    appId: VITE_FIREBASE_APP_ID
  };
}

export function getMultiplayerStateServerUrl(env: MultiplayerAuthEnv = import.meta.env): string | null {
  const url = env.VITE_PARAVOXIA_STATE_SERVER_URL?.trim();
  return url ? url : null;
}

export async function ensureAnonymousPlayerSession(env: MultiplayerAuthEnv = import.meta.env): Promise<MultiplayerSession | null> {
  if (!isCoopAuthEnabled(env)) return null;
  const config = getFirebaseClientConfig(env);
  if (!config) return null;
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
  }
  const credential = auth!.currentUser
    ? { user: auth!.currentUser }
    : await signInAnonymously(auth!);
  const idToken = await credential.user.getIdToken();
  return {
    uid: credential.user.uid,
    idToken,
    anonymous: credential.user.isAnonymous
  };
}
