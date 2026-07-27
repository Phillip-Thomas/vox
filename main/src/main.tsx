import { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { requestedAnchorageAddress } from './game/anchorage/anchorageDevFlag.ts';
import './index.css';

/**
 * `?anchorage=...` swaps the whole app for the anchorage development sandbox.
 *
 * The sandbox is lazily imported so it becomes its own chunk and never enters the
 * shipped bundle; `App` stays a static import so the normal load path is byte-for-byte
 * unchanged. Only the flag parser — a few lines with no dependencies — is always present.
 */
const AnchorageSandbox = lazy(() => import('./components/anchorage/AnchorageSandbox.tsx'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const anchorageAddress = requestedAnchorageAddress();

root.render(
  anchorageAddress
    ? (
      <Suspense fallback={null}>
        <AnchorageSandbox address={anchorageAddress} />
      </Suspense>
    )
    : <App />
);
