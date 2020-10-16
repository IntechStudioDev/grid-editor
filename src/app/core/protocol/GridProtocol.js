import * as grid_protocol from '../../../external/grid-protocol/grid_protocol.json';
import {GRID_CONTROLLER} from './GridController.js';

const iconv = require('iconv-lite');

let global_id = 0;

let PROTOCOL = {};

export const GRID_PROTOCOL = {
  
  initialize: function(){

    let HWCFG = {};
    let CONST = {};
    let INSTR = {};
    let CLASSES = {};
    let BRC = {};
    let VERSION = {};
    let PARAMETERS = {};
    let HEARTBEAT_INTERVAL = 0;

    let PROTOCOL = {};

    for (const key in grid_protocol) {
      if(typeof grid_protocol[key] !== 'object'){

        // GRID MODULE HWCFGS
        if(key.startsWith('GRID_MODULE_')){
          let paramName = key.substr('GRID_MODULE_'.length);
          HWCFG[paramName] = +grid_protocol[key];
        }

        if(key == 'GRID_PARAMETER_HEARTBEAT_interval'){
          HEARTBEAT_INTERVAL = +grid_protocol[key] + 10;
        }

        // GRID INSTRUCTIONS
        if(key.startsWith('GRID_INSTR')){
          let paramName = key.slice(11).slice(0,-5);
          let dec = parseInt(grid_protocol[key], 16); 
          INSTR[paramName] = dec;
        }
        
        // GRID CONSTS
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

        // GRID VERSION
        if(key.startsWith('GRID_PROTOCOL_VERSION_')){
          const param = key.substr('GRID_PROTOCOL_VERSION_'.length);
          VERSION[param] = +grid_protocol[key];
        }

        // GRID BROADCAST 
        else if(key.startsWith('GRID_BRC_') && key['GRID_BRC_'.length] == key['GRID_BRC_'.length].toUpperCase()){    
          const param = key.substr('GRID_BRC_'.length).split('_');
          BRC[param[0]] = {offset: 0, length: 0};
        } 

        // GRID CLASS XXX CODES
        else if(key.startsWith('GRID_CLASS_') && key.slice(-4) == 'code'){
          CLASSES[key.slice('GRID_CLASS_'.length).slice(0,-5)] = +grid_protocol[key];
        }

        let param = '';

        if(key.startsWith('GRID_CLASS_')){
          param = key.split('_')[2];
          if(param[0] == param[0].toUpperCase()){
            if (!PROTOCOL.hasOwnProperty(param)) {
              PROTOCOL[param] = {};
            }
          }
        }

      }
    }

    for(const key in grid_protocol){
      if(typeof grid_protocol[key] !== 'object'){
        let paramName = '';
        let className = '';
        if(key.startsWith('GRID_CLASS_')){
          className = key.split('_')[2]
          if(className[0] == className[0].toUpperCase()){
            paramName = key.split('_')[3];
            if(paramName[0] == paramName[0].toUpperCase()){
              if(key.slice(-6) == 'offset'){
                PROTOCOL[className][paramName] = {...PROTOCOL[className][paramName], offset: 0};
              }else{
                PROTOCOL[className][paramName] = {...PROTOCOL[className][paramName], length: 0};
              }
              PROTOCOL[className][paramName][key.slice(-6)] = +grid_protocol[key];
            }
          }
        }
      }
    }

    for (const key in grid_protocol) {
      if(typeof grid_protocol[key] !== 'object'){
        if(key.startsWith('GRID_BRC_') && key['GRID_BRC_'.length] == key['GRID_BRC_'.length].toUpperCase()){
          const param = key.substr('GRID_BRC_'.length).split('_');
          BRC[param[0]][param[1]] = +grid_protocol[key];
        }
      }
    }

    this.PROTOCOL = {
      ...PROTOCOL,
      BRC: BRC , 
      CLASSES: CLASSES, 
      HWCFG: HWCFG, 
      CONST: CONST,
      INSTR: INSTR,
      VERSION: VERSION,
      PARAMETERS: PARAMETERS,
      HEARTBEAT_INTERVAL: HEARTBEAT_INTERVAL
    }
    
  },

  decode: function(serialData){
    /**
     * 
     * Slices serial data between STX 0x02 and ETX 0x03 for further processing by GRID_CLASS_XXX_code's.
     * 
     */

    const CLASSES = this.PROTOCOL.CLASSES;
    const INSTR = this.PROTOCOL.INSTR;

    let _decoded = [];
    let class_name = '';
    let instr = '';
    let id = 0; 

    //console.log(serialData);

    serialData.forEach((element,i) => {  

      // GRID_CONST_STX -> LENGTH:3 CLASS_code 0xYYY
      if(element == 2){ 

        // CLASS BUILD
        class_name = parseInt("0x"+String.fromCharCode(serialData[i+1], serialData[i+2], serialData[i+3]));
        // INSTR DETECTION
        instr = parseInt('0x'+String.fromCharCode(serialData[i+4]));

        for (const key in INSTR){
          if(INSTR[key] == instr){ 
            instr = key;
          }
        }       

        id = ""+ i +"";
        for (const key in CLASSES){
          if(CLASSES[key] == class_name){ 
            _decoded.push({id: id, class: key, offset: i, instr: instr});     
          }
        }       
    
      }

      // GRID_CONST_ETX
      if(element == 3){
        let obj = _decoded.find(o => o.id === id);
        if(obj !== undefined){
          obj.length = i - obj.offset;
        }
      }
    });

    
    return this.decode_by_class(serialData, _decoded);

  },

  decode_by_class: function(serialData, decoded){

    let DATA = {
     EVENT: []
    };

    DATA.BRC = this.decode_by_code(serialData, 'BRC');

    decoded.forEach((obj)=>{

      let array = serialData.slice(obj.offset, obj.length + obj.offset);

      // special processing
      if(obj.class == "EVENT"){
        DATA.EVENT.push(this.decode_by_code(array, obj.class))
      }
      if(obj.class == "HEARTBEAT"){
        DATA.HEARTBEAT = this.decode_by_code(array, obj.class);
        let moduleType = this.utility_moduleLookup(DATA.HEARTBEAT.HWCFG);
        DATA.CONTROLLER = GRID_CONTROLLER.create(DATA.BRC, DATA.HEARTBEAT, moduleType, false)
      }

      // normal processing
      if(obj.class == "MIDIRELATIVE"){
        DATA.MIDIRELATIVE = this.decode_by_code(array, obj.class);
      }
      if(obj.class == "MIDIABSOLUTE"){
        DATA.MIDIABSOLUTE = this.decode_by_code(array, obj.class);
      }
      if(obj.class == "BANKACTIVE"){
        DATA.BANKACTIVE = this.decode_by_code(array, obj.class)
      }
      if(obj.class == "LEDPHASE"){
        DATA.LEDPHASE = this.decode_by_code(array, obj.class)
      }
      if(obj.class == "LEDCOLOR"){
        DATA.LEDCOLOR = this.decode_by_code(array, obj.class)
      }
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
  },

  decode_by_code: function(serialData, classCode){
    var CLASS = this.PROTOCOL[classCode];
    var object = {}
    for (const param in CLASS) {
      let _value = serialData.slice(
        CLASS[param].offset, CLASS[param].length + CLASS[param].offset
      );    
      let value = parseInt("0x"+String.fromCharCode(..._value));   
      if(param == 'DX' || param == 'DY'){
        object[param] = value - 127;
      } else {
        object[param] = value;
      }
    }
    return object;
  },

  get_module_info: function(MODULE_INFO){
    let DX = 0;
    let DY = 0;
    let ROT = 0;

    if(MODULE_INFO !== ''){
      DX = +MODULE_INFO.id.split(';')[0].split(':').pop() + 127;
      DY = +MODULE_INFO.id.split(';')[1].split(':').pop() + 127;
      switch (MODULE_INFO.rotation){
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
  },

  configure: function(CLASS_NAME, PARAMETERS){
    let CLASS = this.PROTOCOL.CLASSES[CLASS_NAME].toString(16).padStart(3,'0')
    const body = [
        this.PROTOCOL.CONST.STX + 128,
        ...[CLASS.charCodeAt(0), CLASS.charCodeAt(1), CLASS.charCodeAt(2)],
        this.PROTOCOL.INSTR.EXECUTE.toString(16).charCodeAt(0),
        ...this.encode_class_parameters(PARAMETERS, this.PROTOCOL[CLASS_NAME]),
        this.PROTOCOL.CONST.ETX + 128
    ]
    return body;
  },

  configure_raw: function(PARAMETERS){
    const body = [
        this.PROTOCOL.CONST.STX + 128,
        ...PARAMETERS,
        this.PROTOCOL.CONST.ETX + 128
    ]
    return body;
  },

  serialize_actions: function(PARAMETERS, ACTIONS){
    let CONFIG = this.PROTOCOL.CLASSES['CONFIGURATION'].toString(16).padStart(3, '0')
    const body = [
        this.PROTOCOL.CONST.STX,
        ...[CONFIG.charCodeAt(0), CONFIG.charCodeAt(1), CONFIG.charCodeAt(2)],
        this.PROTOCOL.INSTR.EXECUTE.toString(16).charCodeAt(0) ,
        ...this.encode_class_parameters(PARAMETERS, this.PROTOCOL['CONFIGURATION']),
        ...ACTIONS,
        this.PROTOCOL.CONST.ETX
    ];
    return body;
  },

  encode: function (MODULE_INFO, CLASS_NAME, PARAMETERS, SERIALIZED){

    const BRC = this.get_module_info(MODULE_INFO);

    const PROTOCOL = this.PROTOCOL;

    const prepend = [PROTOCOL.CONST.SOH, PROTOCOL.CONST.BRC]
    
    let BRC_PARAMETERS = [
      {ID: this.utility_genId()}, 
      {DX: BRC.DX}, 
      {DY: BRC.DY}, 
      {AGE: 0}, 
      {ROT: BRC.ROT}
    ];

    BRC_PARAMETERS = this.encode_class_parameters(BRC_PARAMETERS, PROTOCOL['BRC']);

    let command = '';

    if(SERIALIZED !== ''){

      command = SERIALIZED;

    } else {
      let CLASS = PROTOCOL.CLASSES[CLASS_NAME].toString(16).padStart(3,'0');
      command = [
        PROTOCOL.CONST.STX,
        ...[CLASS.charCodeAt(0), CLASS.charCodeAt(1), CLASS.charCodeAt(2)],
        PROTOCOL.INSTR.EXECUTE.toString(16).charCodeAt(0),
        ...this.encode_class_parameters(PARAMETERS, PROTOCOL[CLASS_NAME]),
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

  encode_class_parameters: function(PARAMETERS, INFO){
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

  utility_genId: function() {
    if((global_id / 255) == 1){
      global_id = 0;
    }
    return global_id += 1;
  },
  
  utility_moduleLookup: function(hwcfg){
    var HWCFG = this.PROTOCOL.HWCFG;
    let type = '';
    for (const key in HWCFG) {
      if(HWCFG[key] == hwcfg)
        return type = key;
      }
  },
}