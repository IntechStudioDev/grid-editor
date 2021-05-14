import { writable, get, derived } from 'svelte/store';

function checkOS() {
  if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
    return process.platform;
  }

  // Main process
  if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!process.versions.electron) {
      return process.platform;
  }

  // Detect the user agent when the `nodeIntegration` option is set to true
  if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
    return process.platform;
  }

  return 'browser';
}

export const appSettings = writable({
  size: 2,
  version: {
    major: 0,
    minor: 0,
    patch: 0
  },
  overlays: {controlName: false},
  debugMode: false,
  selectedDisplay: '',
  layoutMode: false,
  configType: 'uiEvents',
  activePanel: 'gridConfiguration',
  preferences: false,
  os: checkOS()
});

export const preferenceStore = writable();

function createActionPrefStore(){

  const store = writable({
    advanced: {
      index: undefined, 
      visible: false,
    }
  });

  return {
    ...store,
    showAdvanced: (index, outside) => {
      store.update(s => {
        s.advanced = {
          index: index, 
          visible: !s.advanced.visible
        }
        return s
      });
    }
  }
}

function createAdvancedPrefStore(){
  const store = writable({
    index:-1
  });

  return{
    ...store,
    setIndex: (i) => {
      store.update(s => {s.index = i; return s;})
    }
  }
}

export const selectedConfigPreset = writable({});

export const layout = writable([]);

export const numberOfModulesStore = writable();

export const focusedCodeEditor = writable();

export const configNodeBinding = writable([]);

export const advancedPrefStore = createAdvancedPrefStore();

export const actionPrefStore = createActionPrefStore();

export const actionIsDragged = writable(false);




