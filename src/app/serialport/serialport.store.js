import { writable, get } from 'svelte/store';

import { debugStore } from '../stores/debug.store';

function createSerialComm(){
  const store = writable({
    list: [],
    open: undefined,
    selected: ''
  });

  return {
    ...store,
    write: (args) => { 
      debugStore.update(store => {
        let output = args;
        console.log(typeof output)
        if(typeof output == 'object'){
          output = args.map(arg => {
            return String.fromCharCode(arg)
          });
          output = output.join('');
        }
        
        store = [...store, {type: 'output', data: output} ]
        return store;
      })
      let port = get(store).open;
      port.write([...args, 10]);
      return;
    },
    selected: (port) => {
      store.update(store => {
        store.selected = port;
        return store;
      });
      return;
    },
    open: (port) => {
      store.update(store=>{
        store.open = port;
        return store;
      })
      return;
    }
  }
}

export const serialComm = createSerialComm();

 