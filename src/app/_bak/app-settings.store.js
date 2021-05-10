import { writable } from 'svelte/store';

import * as grid_protocol from '../../external/grid-protocol/grid_protocol_nightly.json';

const GRID = grid_protocol;

function isElectron() {
  // Renderer process
  if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
      return true;
  }

  // Main process
  if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!process.versions.electron) {
      return true;
  }

  // Detect the user agent when the `nodeIntegration` option is set to true
  if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
      return true;
  }

  return false;
}

export const appSettings = writable({
  size: 2,
  version: {
    major: +GRID.GRID_PROTOCOL_VERSION_MAJOR,
    minor: +GRID.GRID_PROTOCOL_VERSION_MINOR,
    patch: +GRID.GRID_PROTOCOL_VERSION_PATCH
  },
  overlays: {controlName: false},
  debugMode: false,
  selectedDisplay: '',
  layoutMode: false,
  isElectron: isElectron(),
  configType: 'uiEvents',
  activePanel: 'gridConfiguration',
  preferences: false,
  os: checkOS()
});

export const preferenceStore = writable({
  midiMonitor: {
    show: false,
    option: true
  }
})