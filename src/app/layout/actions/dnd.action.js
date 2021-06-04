
import { islanding } from '../islanding.js';

import { get } from 'svelte/store';
import { runtime } from '../../stores/runtime.store.js';
import { layout } from '../../stores/layout.store.js';


export function dragndrop(node, layoutMode) {

  let centerCanBeRemoved = false;

  let modul = 'none';

  let dragValidity = true;
  let dragEvent = 'drop';

  let _layout = [];
  let _runtime = [];

  runtime.subscribe(store => _runtime = store);
  layout.subscribe(store => _layout = store);

  let movedCell;

  function handleDragStart(e) {

    modul = e.target.id;

    // NEED THIS BAD BOY, TO REBUILD AVAILABLE CELL IS DRAG IS INVALID
    movedCell = _runtime.find(cell => cell.id === modul);

    // ISLANDING CHECK BEFORE GETTING FORWARD...
    let _islanding = false;
    if(movedCell != undefined){ 
      let islandingArray = islanding.testAllIslanding(_runtime);
      if(islandingArray.length > 0){ 
        islandingArray.forEach(c =>{
          if(c.id == movedCell.id){
            if(c.islanding == 1){
              _islanding = true;
            }
          }
        })
      }
    }

    // PART TO TELL IF IT'S "CENTER" OR CONNECTED BY USB
    let movable = true;
    let movedLayoutCell;
    movedLayoutCell = _layout.find((cell) => cell.id === modul);   
    if(movedLayoutCell != undefined){
      if(movedLayoutCell.isConnectedByUsb){
        movable = false;
      }
    }

    // ON DRAG START, REMOVE THE ELEMENT FROM THE USED grid.

    // AFTER RENDERING THE COMPONENTS DINAMICALLY, THIS IS NOT NEEDED

    if(movable && !_islanding){
      if(!(modul == 'drg-PO16' || modul ==  'drg-BU16' || modul ==  'drg-EN16' || modul ==  'drg-PBF4')){ 
        e.target.style.opacity = '0.4';
      }   
      e.dataTransfer.setData("text", e.target.id);
      node.dispatchEvent(new CustomEvent('dnd-dragstart', {
        detail: {id: e.target.id, movedCell: movedCell}
      }));
      
      node.dispatchEvent(new CustomEvent('dnd-invalid', {detail: {center: false}}));
      window.addEventListener('dragover', handleDragOver);
      
    } else {

      dragValidity = false;

      _runtime.length == 1 ? centerCanBeRemoved = true : centerCanBeRemoved = false;

      if(centerCanBeRemoved){
        e.dataTransfer.setData("text", e.target.id);
        node.dispatchEvent(new CustomEvent('dnd-dragstart', {detail: {id: e.target.id, movedCell: movedCell}}));
        window.addEventListener('dragover', handleDragOver);
      } else {
        node.dispatchEvent(new CustomEvent('dnd-invalid', {detail: {center: true, id: e.target.id, movedCell: movedCell}}));
        window.removeEventListener('dragover', handleDragOver);
      }
      
      console.log('YADA not good + ', 'dragvalidity: ', dragValidity, 'movable: ', movable)
    }
  }

  function handleDragOver(e){
    console.log('here?')
    // DON'T ENABLE TO DROP ON AN OTHER MODULE
    if(e.target.children.length == 0){

      var data = e.target.id;

      if(data.startsWith('grid-cell-')){

        const id = e.target.id.substr(10,);

        const dx = +id.split(';')[0].split(':').pop();
        const dy = +id.split(';')[1].split(':').pop()

        // THERE ARE MODULES ON THE GRID, LET MODULE ONLY IF IT IS OK

        if(_runtime.length > 0){

          _layout.forEach((cell)=>{

            if(cell.canBeUsed && cell.dx == dx && cell.dy == dy){

              e.preventDefault();
              let _cell = data.substr(10,);
              node.dispatchEvent(new CustomEvent('dnd-dragover', {
                detail: _cell
              }));

              window.addEventListener('drop', handleDrop);
            }
          })

        } else {

          // NO USEDCELL YET, SO THERE IS NO MODUL IN THE LAYOUT! ADD ONE!

          if(dx == 0 && dy == 0){

            console.log('not used cell yet')
            e.preventDefault();
            let cell = data.substr(10,);
            node.dispatchEvent(new CustomEvent('dnd-dragover', {
              detail: cell
            }));

            window.addEventListener('drop', handleDrop);
          }
        }  

        dragEvent = 'drop';
      }
      if(e.target.id == 'bin' && !modul.startsWith('drg')){
        e.preventDefault();
        console.log('it\'s the trash area', modul);
        dragEvent = 'remove';
        window.addEventListener('drop', handleDrop);
      } 
    } else{
      dragValidity = false;
    }
    window.addEventListener('dragend',handleDragEnd);
  }

  function handleDrop(e) {
    dragValidity = true;
    e.preventDefault();
    if(dragEvent == 'drop'){
      node.dispatchEvent(new CustomEvent('dnd-drop', {
        detail: {target: e.target, module: e.dataTransfer.getData("text")}
      }));
    }
    if(dragEvent == 'remove'){
      node.dispatchEvent(new CustomEvent('dnd-remove', {
        detail: {modul: modul}
      }));
    }
    
    window.removeEventListener('dragover', handleDragOver);
    
  }

  function handleDragEnd(e){
    node.dispatchEvent(new CustomEvent('dnd-dragend', {
      detail: {id: e.target.id, dragValidity: dragValidity}
    }));
    e.target.style.opacity = 1.0;
    window.removeEventListener('drop', handleDrop);
  }

  //node.addEventListener('dragstart', handleDragStart);
  //node.addEventListener('dragstart',handleDragStart);

  window.addEventListener('dragstart', handleDragStart);

  return {

    update(layoutMode){
      if(!layoutMode){
        window.removeEventListener('dragstart', handleDragStart)
      } else {
        window.addEventListener('dragstart', handleDragStart);
      }
      console.log('layoutMode enabled in action:',layoutMode);
    },

    destroy() {
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragend', handleDragEnd);
    }
  }
}