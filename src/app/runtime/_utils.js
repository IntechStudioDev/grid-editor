// es6 import
import { getComponentInformation } from '../config-blocks/_configs.js';
import grid from '../protocol/grid-protocol.js';
import stringManipulation from '../main/user-interface/_string-operations.js';

// commonjs node require
const lua = require('luaparse');

// init string converter
const _convert = stringManipulation;
_convert.initialize(grid.properties.LUA);

const _utils = {

  /**
   * @configList  - This is the long <?lua ... ?>, where ... = n number of config
   * @config      - Single config with short comment "--[[@ short ]]" and script part
   * @script      - Script without the comment
   * @short       - Comment short script name
   * 
   * @config = --[[@ @short ]] + @script
   */

  gridLuaToEditorLua: async function(fullConfig){
    let configs = this.rawLuaToConfigList(fullConfig);
    configs = this.configBreakDown(configs);
    return await this.extendProperties(configs);
  },

  // make smaller chunks from <?lua ... ?>, huge raw lua
  rawLuaToConfigList: function(rawLua){

    // get rid of new line, enter
    rawLua = rawLua.replace(/[\n\r]+/g, '');
    // get rid of more than 2 spaces
    rawLua = rawLua.replace(/\s{2,10}/g, ' ');

    // splt by meta comments
    let configList = rawLua.split('--[[@');

    // filter "*space*" with regex or empty string
    configList = configList.filter(function(el){ return !el.match(/(^\s+$)|(^$)/)});

    return configList;
  
  },

  // break down config to script and short properties
  configBreakDown: function(configList){

    // get the function name
    const regexp = /^([^\s]+)|([^\s].*)+/g; // pay attention to multiline or single line flag! "m"

    // make an array of action names and script parts
    configList = configList.map((element) => {
      let obj = {short: '', script: ''};

      let arr= [];
      let testy;
      while ((testy = regexp.exec(element)) !== null) {
        arr.push(testy[0])
      }
      obj.short = arr[0].slice(0,-2); // remove tailing "]]"
      obj.script = arr[1];
      
      return obj;
    });

    return configList;

  },

  // add extra properties used in the app, like the id for listing and component
  extendProperties: function(configList){
    try {
      return Promise.all(configList.map(async (element,index) => {
        // TODO: if undefined find... revert to codeblock!

        // TODO: we convert grid short script names to human names!
        console.log(_convert.splitShortScript(element.script));

        return {
          short: element.short, 
          script: element.script, 
          id: (+new Date + index).toString(36).slice(-8), 
          human: getHumanFunctionName({short: element.short}),
          ...await getComponentInformation({short: element.short})
        }
      }));
    } catch (err) {
      console.error(err);
    }
  },

  scriptToSegments: function({script, human, short}){
    console.log(script, human, short)
    // get the part after function name with parenthesis
    let config = [];
    config = script.split(short)[1];
    // remove parenthesis
    config = config.slice(1, -1);
    // split by comma to make array
    config = config.split(',');
  
    return config;
  },

  segmentsToScript: function({human = '', short, array = []}){
    let code = short; // prepend with type
    const _unformatted = JSON.stringify(array);
    [..._unformatted].forEach(e => {
      if(e == '['){ code += '(' }
      else if(e == ']') { code += ')'}
      else if(e == "\"") { /* no return */ }
      else { code += e }
    })
    return code;
  }

}

function getHumanFunctionName({short}){
  const found = grid.properties.LUA.find(e => e.short == short);

  if(!found) return 'no human readable name found';

  return found.human;
}


export function luaParser({config}){
  let parser = '';
  try {
    lua.parse(config);
    parser = 'ok';
  } catch (error) {
    console.log(error);
    parser = error.message;
  } 
  return parser;
}

export function isJson (str){
  try {
      JSON.parse(str);
  } catch (e) {
      return false;
  }
  return true;
}

export function isLua (script){
  try {
      lua.parse(script);
  } catch (err) {
      return false
  }
  return true;
}

export default _utils;