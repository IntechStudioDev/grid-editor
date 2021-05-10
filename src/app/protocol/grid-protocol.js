import { createNestedObject, returnDeepestObjects, mapObjectsToArray } from './_utils.js';
import { editor_lua_properties } from './editor-properties.js';
import * as grid_protocol from '../../external/grid-protocol/grid_protocol_nightly.json';

const utility_genId  = () => {
  if((global_id / 255) == 1){
    global_id = 0;
  }
  return global_id += 1;
}

const moduleLookup = (hwcfg) => {
  var HWCFG = grid.properties.HWCFG;
  let type = '';
  for (const key in HWCFG) {
    if(HWCFG[key] == hwcfg)
      return type = key;
  }
}

const get_module_info = (MODULE_INFO) => {
  let DX = 0;
  let DY = 0;
  let ROT = 0;

  if(MODULE_INFO !== ''){
    DX = +MODULE_INFO.dx + 127;
    DY = +MODULE_INFO.dy + 127;
    switch (MODULE_INFO.rot){
      case -0:
        ROT = 0; break;
      case 90:
        ROT = 1; break;
      case 180:
        ROT = 2; break;
      case 270:
        ROT = 3; break;
    }
  }
  return {ROT, DX, DY};
}

// Template Parameter Event Assignment table.
const TPEA = { 
  down: {
    desc: 'down',
    value: '4',
    code: 'DP'
  },
  up: {
    desc: 'up',
    value: '5',
    code: 'DR'
  },
  rotation: {
    // same as slide, just it's easier to read
    desc: 'rotation',
    value: '1',
    code: 'AVC7'
  },
  slide: {
    // same as rotation, just it's easier to read
    desc: 'slide',
    value: '1',
    code: 'AVC7'
  },
  push_rot: {
    desc: 'push rot',
    value: '13',
    code: 'ENCPUSHROT'
  },
  init: {
    desc: 'bank init',
    value: '0',
    code: 'INIT'
  }
}


const grid = {
  
  properties: (function (){

    let HWCFG = {};
    let CONST = {};
    let INSTR = {};
    let CLASSES = {};
    let LUA = {};
    let BRC = {};  
    let VERSION = {};
    let PARAMETERS = {};
    let HEARTBEAT_INTERVAL = 0;

    for (const key in grid_protocol) {
      if(typeof grid_protocol[key] !== 'object'){

        // GRID MODULE HWCFGS
        if(key.startsWith('GRID_MODULE_')){
          let paramName = key.substr('GRID_MODULE_'.length);
          HWCFG[paramName] = +grid_protocol[key];
        }

        // GRID HEARTBEAT INTERVAL
        if(key == 'GRID_PARAMETER_HEARTBEAT_interval'){
          HEARTBEAT_INTERVAL = +grid_protocol[key];
        }

        // GRID INSTRUCTIONS
        if(key.startsWith('GRID_INSTR')){
          let paramName = key.slice(11).slice(0,-5);
          let dec = parseInt(grid_protocol[key], 16); 
          INSTR[paramName] = dec;
        }
        
        // GRID CONSTS TO CONSTRUCT SERIAL DATA
        if(key.startsWith('GRID_CONST')){
          let paramName = key.slice(11);
          let dec = parseInt(grid_protocol[key], 16); 
          CONST[paramName] = dec;
        } 

        // GRID TEMPLATE PARAMETERS
        if(key.startsWith('GRID_PARAMETER_TEMPLATEINDEX_')){
          const param = key.substr('GRID_PARAMETER_TEMPLATEINDEX_'.length).slice(0,-5);
          PARAMETERS[param] = grid_protocol[key];
        }

        // GRID PROTOCOL VERSION
        if(key.startsWith('GRID_PROTOCOL_VERSION_')){
          const param = key.substr('GRID_PROTOCOL_VERSION_'.length);
          VERSION[param] = +grid_protocol[key];
        }

        if(key.startsWith('GRID_BRC_')){
          let paramSet = key.split('_');
          let value = grid_protocol[key];
          if(paramSet[paramSet.length-1] !== "frame"){
            createNestedObject( BRC, paramSet.slice(2,), value )
          }
        }

        // GRID LUA PROPERTIES
        if(key.startsWith('GRID_LUA_')){
          let paramSet = key.split('_');
          let value = grid_protocol[key];
          createNestedObject( LUA, paramSet.slice(3,), value )
        }

        // LEGACY GRID CLASS CONSTRUCTION
        if(key.startsWith('GRID_CLASS_')){
          let paramSet = key.split('_');
          let value = grid_protocol[key];
          if(paramSet[paramSet.length-1] !== "frame"){ // not sure why fram is unsupported...
            createNestedObject( CLASSES, paramSet.slice(2,), value);
          }
        }
      }
    }

    return {
      BRC: BRC , 
      LUA: extendLua(LUA),
      CLASSES: CLASSES, 
      HWCFG: HWCFG, 
      CONST: CONST,
      INSTR: INSTR,
      VERSION: VERSION,
      PARAMETERS: PARAMETERS,
      HEARTBEAT_INTERVAL: HEARTBEAT_INTERVAL,
      AGE: Math.floor(Math.random()*255).toString(16).padStart(2, '0')
    }

    function extendLua(propObject){
      const deepObjects = returnDeepestObjects(propObject);
      const array = mapObjectsToArray(editor_lua_properties, deepObjects);
      return array;
    }

  }()),

  translate: {
    encode: function (MODULE_INFO, CLASS_NAME, INSTR_CODE, PARAMETERS, SERIALIZED){

      function encode_class_parameters(PARAMETERS, INFO){
        let _parameters = [];
        if(PARAMETERS !== ''){
          PARAMETERS.forEach(CLASS => {     
            for (const key in CLASS) {
              let param = [];
              let p = CLASS[key].toString(16).padStart(INFO[key].length,'0');
              for (let i = 0; i < INFO[key].length; i++) {
                param[i] = p.charCodeAt(i)            
              }
              _parameters = [..._parameters, ...param];
            }
          })
        }
        return _parameters;
      }

      const BRC = get_module_info(MODULE_INFO);
  
      const PROTOCOL = grid.properties;
  
      const prepend = [PROTOCOL.CONST.SOH, PROTOCOL.CONST.BRC]
      
      let BRC_PARAMETERS = [
        {ID: utility_genId()}, 
        {DX: BRC.DX}, 
        {DY: BRC.DY}, 
        {AGE: PROTOCOL.AGE}, // ON PROTOCOL INIT, THIS IS GENERATED!
        {ROT: BRC.ROT}
      ];
  
      BRC_PARAMETERS = encode_class_parameters(BRC_PARAMETERS, PROTOCOL['BRC']);
  
      let command = '';
  
      if(SERIALIZED !== ''){
  
        command = SERIALIZED;
  
      } else {
        let CLASS = PROTOCOL.CLASSES[CLASS_NAME].toString(16).padStart(3,'0');
        command = [
          PROTOCOL.CONST.STX,
          ...[CLASS.charCodeAt(0), CLASS.charCodeAt(1), CLASS.charCodeAt(2)],
          PROTOCOL.INSTR[INSTR_CODE].toString(16).charCodeAt(0),
          ...encode_class_parameters(PARAMETERS, PROTOCOL[CLASS_NAME]),
          PROTOCOL.CONST.ETX
        ]
      }  
       
      const append = [
        PROTOCOL.CONST.EOB,
        ...command ,
        PROTOCOL.CONST.EOT
      ]
  
      let message = prepend.concat(BRC_PARAMETERS, append);
  
      let length = (message.length+2).toString(16).padStart(2,'0');
      length = [length.charCodeAt(0), length.charCodeAt(1)]
      message = [...message.slice(0,2), ...length, ...message.slice(2,)];
  
      let checksum = [...message].reduce((a, b) => a ^ b).toString(16).padStart(2,'0');
  
      message = [...message, checksum.charCodeAt(0), checksum.charCodeAt(1)];
  
      return message;
    },

    encode_debugger: function (brc, command){

      const PROTOCOL = this.PROTOCOL;
  
      const prepend = String.fromCharCode(PROTOCOL.CONST.SOH) + String.fromCharCode(PROTOCOL.CONST.BRC);
  
      let BRC_PARAMETERS = [
        this.utility_genId(), +brc[0], +brc[1], +brc[2], +brc[3]
      ];
      
      let params = '';
      BRC_PARAMETERS.forEach(param => {
        params += param.toString(16).padStart(2, '0');
      })
       
      const append = 
        String.fromCharCode(PROTOCOL.CONST.EOB) + 
        command +
        String.fromCharCode(PROTOCOL.CONST.EOT);
  
      let message = prepend + params + append;
  
      message = message.slice(0,2) + (message.length+2).toString(16).padStart(2, '0') + message.slice(2,);
  
      let checksum = [...message].map(a => a.charCodeAt(0)).reduce((a, b) => a ^ b).toString(16); 
  
      message = message + checksum;
  
      return message;
    },
  
    decode: function(serialData){


      function build_decoder(mode, array, id, data, index){
        const CLASSES = grid.properties.CLASSES;
        const INSTR = grid.properties.INSTR;
        
        // CLASS BUILD
        let class_name = '';
        if(data.length > 3 && mode == 'config'){
          class_name = parseInt("0x"+String.fromCharCode(data[index+1], data[index+2], data[index+3]));
        }
    
        if(mode == 'main' && !(data[index] == 2 && data[index+1] == 48 && data[index+2] == 3)){      
          class_name = parseInt("0x"+String.fromCharCode(data[index+1], data[index+2], data[index+3]));
        }
    
        // INSTR DETECTION
        let instr = parseInt('0x'+String.fromCharCode(data[index+4]));
    
        let rawFlag = true;
        for (const key in INSTR){
          if(INSTR[key] == instr){ 
            instr = key;
          }
        }       

        //console.log(class_name)
    
        for (const key in CLASSES){
          if(parseInt(CLASSES[key].code, 16) == class_name){ 
            array.push({id: id, class: key, offset: index, instr: instr});  
            rawFlag = false;   
          }
        }    
    
        if(rawFlag){
          array.push({id: id, class: "RAW", offset: index, instr: instr}); 
        }
    
        
        return array;
      }

      function decode_by_code(serialData, classCode){

        // BRC AND CLASSES ARE IN DIFFERENT HIERARCHY
        const CLASS = classCode == 'BRC' ? grid.properties.BRC : grid.properties.CLASSES[classCode];
        
        let object = {}

        for (const param in CLASS) {
          // offset and length are numbers, handle them accordingly!
          let _value = serialData.slice(
            +CLASS[param].offset, +CLASS[param].length + +CLASS[param].offset
          );    
          let value;
          
          if (_value[0] < 91 && _value[0] > 64 ){
            value = String.fromCharCode(..._value);
          }else{
            value = parseInt("0x"+String.fromCharCode(..._value));    
          }
           
          if(param == 'DX' || param == 'DY'){
            object[param] = value - 127;
          } else {
            object[param] = value;
          }


        }

        return object;
        
      }

      function decode_by_class(serialData, decoded){

        let DATA = {};
    
        DATA.BRC = decode_by_code(serialData, 'BRC');
    
        decoded.forEach((obj)=>{
          //console.log('OBJ',obj);
          let array = serialData.slice(+obj.offset, +obj.length + +obj.offset);
    
          // special processing
          if(obj.class == "EVENT"){
            DATA.EVENT = decode_by_code(array, obj.class);
          }
          if(obj.class == "HEARTBEAT"){
            DATA.HEARTBEAT = decode_by_code(array, obj.class);
            let moduleType = moduleLookup(DATA.HEARTBEAT.HWCFG);
            DATA.CONTROLLER = grid.device.make(DATA.BRC, DATA.HEARTBEAT, moduleType, false)
          }

          if(obj.class == "CONFIGURATION"){   
          // THIS IS NOW REWORKED
          }    
    
          // commands
          if(obj.class == "LOCALSTORE"){
            DATA.COMMAND = { 'LOCALSTORE': obj.instr }
          }
          if(obj.class == "LOCALRECALL"){
            DATA.COMMAND = { 'LOCALRECALL': obj.instr }
          }
          if(obj.class == "LOCALCLEAR"){
            DATA.COMMAND = { 'LOCALCLEAR': obj.instr }
          }
          if(obj.class == "GLOBALSTORE"){
            DATA.COMMAND = { 'GLOBALSTORE': obj.instr }
          }
          if(obj.class == "GLOBALRECALL"){
            DATA.COMMAND = { 'GLOBALRECALL': obj.instr }
          }
          if(obj.class == "GLOBALCLEAR"){
            DATA.COMMAND = { 'GLOBALCLEAR': obj.instr }
          }
    
        });
    
        return DATA;
      }
   
      let _decoded = [];
      let id = 0; 
  
      serialData.forEach((element,i) => {  
      
        // GRID_CONST_STX -> LENGTH:3 CLASS_code 0xYYY
        if(element == 2){ 
          id = ""+ i +"";
          _decoded = build_decoder('main', _decoded, id, serialData, i);    
        }
  
        // GRID_CONST_ETX
        if(element == 3){
          let obj = _decoded.find(o => o.id === id);
          if(obj !== undefined){
            obj.length = i - obj.offset;
          }
        }
      });
      
      return decode_by_class(serialData, _decoded);
    }
  },

  device: {

    elementEvents: {
      button: [ TPEA.init, TPEA.down, TPEA.up ],
      potentiometer: [ TPEA.init, TPEA.rotation ],
      fader: [ TPEA.init, TPEA.slide ],
      blank: [],
      encoder: [ TPEA.init, TPEA.down, TPEA.up, TPEA.rotation, TPEA.push_rot ]
    },
  
    moduleElements: {
      PO16: [
        'potentiometer', 'potentiometer', 'potentiometer', 'potentiometer',
        'potentiometer', 'potentiometer', 'potentiometer', 'potentiometer',
        'potentiometer', 'potentiometer', 'potentiometer', 'potentiometer',
        'potentiometer', 'potentiometer', 'potentiometer', 'potentiometer'
      ],
      PBF4: [
        'potentiometer', 'potentiometer', 'potentiometer', 'potentiometer',
        'fader', 'fader', 'fader', 'fader', 
        'button', 'button', 'button', 'button', 
        'blank', 'blank', 'blank', 'blank'
      ],
      BU16: [
        'button','button','button','button',
        'button','button','button','button',
        'button','button','button','button',
        'button','button','button','button'
      ],
      EN16: [
        'encoder', 'encoder', 'encoder', 'encoder',
        'encoder', 'encoder', 'encoder', 'encoder',
        'encoder', 'encoder', 'encoder', 'encoder',
        'encoder', 'encoder', 'encoder', 'encoder',
      ]
    },

    make: function(header, version, moduleType, virtual){

      const param2lower = (parameters) => {
        let obj = {}
        for (const key in parameters) {
          const _key = key.toLowerCase();
          obj[_key] = parameters[key]
        }
        return obj;
      }

      function createElementSettings(moduleType, virtual){

        moduleType = moduleType.substr(0,4);
    
        let banks = [];
    
        //banks
        for (let b = 0; b < 4; b++) {  
    
          let control_elements = [];
    
          // control elements
          for (let i = 0; i < 16; i++) {
            let events = [];
            let obj = {
              controlElementType: this.moduleElements[moduleType][i],
              controlElementName: '',
            }
            // events
            for (let j=0; j < this.elementEvents[this.moduleElements[moduleType][i]].length; j++) {
              events.push({        
                event: this.elementEvents[this.moduleElements[moduleType][i]][j], 
                // actions // low level config string
                config: [],
                cfgStatus: (virtual || obj.controlElementType == "blank") ? 'not_expected' : 'expected'
              })
            }
            control_elements[i] = {events: events, ...obj, };
          }
    
          banks[b] = control_elements;
    
        }
    
        return banks;
        
      }

      let controller = {
        // implement the module id rep / req
        id: "",
        dx: "",
        dy: "",
        fwVersion: {
          major: "",
          minor: "",
          patch: "",
        },
        alive: Date.now(),
        virtual: "",
        map: {
          top: {dx: "", dy: "",},
          right: {dx: "", dy: ""},
          bot: {dx: "", dy: ""},
          left: {dx: "", dy: ""},
        },
        rot: "",
        isConnectedByUsb: "",
        isLanding: "",
        banks: [], // consider naming to "local"
        global: {}
      }

  
      // generic check, code below if works only if all parameters are provided
      if(header !== undefined && version !== undefined && moduleType !== undefined && virtual !== undefined){
        
        header = param2lower(header);
        //moduleType = param2lower(moduleType);
        moduleType = moduleType.substr(0,4);

        controller = {
          // implement the module id rep / req
          id: moduleType + '_' + 'dx:' + header.dx + ';dy:' + header.dy,
          dx: header.dx,
          dy: header.dy,
          fwVersion: {
            major: version.vmajor,
            minor: version.vminor,
            patch: version.vpatch
          },
          alive: Date.now(),
          virtual: virtual,
          map: {
            top: {dx: header.dx, dy: header.dy+1},
            right: {dx: header.dx+1, dy: header.dy},
            bot: {dx: header.dx, dy: header.dy-1},
            left: {dx: header.dx-1, dy: header.dy},
          },
          rot: header.rot * -90,
          isConnectedByUsb: (header.dx == 0 && header.dx == 0) ? true : false,
          isLanding: false,
          banks:  0, // reateElementSettings(moduleType, virtual), // consider naming to "local"
          global: {  
            bankColors: [[255,0,0],[255,0,0],[255,0,0],[255,0,0]],
            bankEnabled: [true,true,true,true],
            cfgStatus: virtual ? 'not_expected' : 'ok'
          }
        }
        
      }
      
      return controller;
  
    }

  }

}

export default grid;