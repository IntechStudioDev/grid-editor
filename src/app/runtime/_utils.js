// es6 import
import { getComponentInformation } from '../config-blocks/_configs.js';
import grid from '../protocol/grid-protocol.js';
import stringManipulation from '../main/user-interface/_string-operations.js';
import { v4 as uuidv4 } from 'uuid';

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
    if(fullConfig.length == 0) return Promise.reject("No config passed!");
    let configs = this.rawLuaToConfigList(fullConfig);
    configs = this.configBreakDown(configs);
    return await this.extendProperties(configs);
  },

  // make smaller chunks from <?lua ... ?>, huge raw lua
  // returns an array of possible actions
  rawLuaToConfigList: function(rawLua){

    // get rid of new line, enter
    rawLua = rawLua.replace(/[\n\r]+/g, '');
    // get rid of more than 2 spaces
    rawLua = rawLua.replace(/\s{2,10}/g, ' ');

    // remove lua opening and closing characters
    // this function is used for both parsing full config (long complete lua) and individiual actions lua
    if(rawLua.startsWith('<?lua')){
      rawLua = rawLua.split('<?lua')[1].split('?>')[0];
    }

    // splt by meta comments
    let configList = rawLua.split(/(--\[\[@+[a-z]+\]\])/);

    // filter "*space*" with regex or empty string
    // configList = configList.filter(function(el){ return !el.match(/(^\s+$)|(^$)/)});

    configList = configList.slice(1);

    return configList;
  
  },

  // break down config to script and short properties
  configBreakDown: function(configList){

    /**
     * If the configuration is with unknown short script tag, make an invalid short script and return the script part,
     * as the rawLuaToConfigList does not care if no comments are found...
     */

    let configMatrix = [];
    for (let i = 0; i < configList.length; i+=2) {
      if(/(--\[\[@+[a-z]+\]\])/.test(configList[i+1])){
        //console.log('NEXT IS REGEX!');
      }
      let [short, script] = [configList[i].slice(5,-2), configList[i+1] ? configList[i+1].trim() : '' ]
      configMatrix.push({short: short, script: script})
    }

    return configMatrix;
  },

  // add extra properties used in the app, like the id for listing and component
  extendProperties: function(configList){
    return Promise.all(configList.map(async (element,index) => {

      // if short is not in lua... revert to codeblock!
      if(!grid.properties.LUA.find(l => l.short == element.short)){
       element.short = 'cb'
      }

      return {
        short: element.short, 
        script: element.script, 
        id: uuidv4(), 
        human: getHumanFunctionName({short: element.short}),
        ...await getComponentInformation({short: element.short})
      }
    }));
  },

  scriptToSegments: function({script, short}){
    // get the part after function name with parenthesis
    let config = [];
    config = script.split(short)[1];
    // remove parenthesis
    config = config.slice(1, -1);
    // split by comma to make array
    config = config.split(',');
  
    return config;
  },

  humanScriptToSegments: function({script, human}){
    // get the part after function name with parenthesis
    let config = [];
    config = script.split(human)[1];

    // remove spaces
    config = config.replace(/\s+/g, '');
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
      if(e == "\"") { /* no return */ }
      else { code += e }
    })
    return code;
  },

  humanSegmentsToScript: function({human = '', short, array = []}){
    let code = human; // prepend with type
    const _unformatted = JSON.stringify(array);
    [..._unformatted].forEach(e => {
      if(e == '['){ code += '(' }
      else if(e == ']') { code += ')'}
      else if(e == "\"") { /* no return */ }
      else { code += e }
    })
    return code;
  },

  configMerge: function({config}){
    let lua = '';
    config.forEach((e,i) => {
      lua += `--[[@${e.short}]] ` + e.script + "\n";  
    });
    lua = '<?lua ' + lua.replace(/(\r\n|\n|\r)/gm, "") + ' ?>';
    return lua;
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
    parser = 'VALID';
  } catch (error) {
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