import { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { requestedSpaceStationAddress } from './game/spaceStation/spaceStationDevFlag.ts';
import './index.css';

/**
 * `?spacestation=...` swaps the whole app for the spaceStation development sandbox.
 *
 * The sandbox is lazily imported so it becomes its own chunk and never enters the
 * shipped bundle; `App` stays a static import so the normal load path is byte-for-byte
 * unchanged. Only the flag parser — a few lines with no dependencies — is always present.
 */
const SpaceStationSandbox = lazy(() => import('./components/spaceStation/SpaceStationSandbox.tsx'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const spaceStationAddress = requestedSpaceStationAddress();

root.render(
  spaceStationAddress
    ? (
      <Suspense fallback={null}>
        <SpaceStationSandbox address={spaceStationAddress} />
      </Suspense>
    )
    : <App />
);
