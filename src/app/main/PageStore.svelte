<script>

  import grid from "../protocol/grid-protocol";
  import { runtime, engine } from "../runtime/runtime.store";
  import instructions from "../serialport/instructions";
  import { serialComm } from "../serialport/serialport.store";

  export let classes;


  function store() {
    instructions.sendPageStoreToGrid();
  }

</script>

<button 
  on:click={()=>{store()}} 
  disabled={$engine != 'ENABLED'}
  class="{$engine == 'ENABLED' ? 'hover:bg-commit-saturate-20 hover:border-commit-saturate-20' : 'opacity-75'} flex items-center justify-center rounded my-2 focus:outline-none border-2 border-commit bg-commit hover:bg-commit-saturate-20 hover:border-commit-saturate-20 text-white px-2 py-0.5 {classes}">
    Store
</button>

<style>



</style>
