"use strict";function buildJSONRPCResult(r,e){const t={jsonrpc:"2.0",id:r,result:e};return validateJSONRPCResponse(t),t}function buildJSONRPCError(r=null,e){void 0===e&&(e=createJSONRPCError(-32603,"'err' parameter is missing"));const t={code:e.jsonRPCErrorCode||1,message:e.message,data:{}};for(var o=Object.keys(e),n=0;n<o.length;n++){const r=o[n];"jsonRPCErrorCode"!==r&&"message"!==r&&(t.data[r]=e[r])}return{jsonrpc:"2.0",error:t,id:r}}function validateJSONRPCRequest({jsonrpc:r,method:e,id:t,params:o}){if(validateJSONRPCAttribute(r),!e)throw createJSONRPCError(-32600,"'method' attribute is missing");if("string"!=typeof e)throw createJSONRPCError(-32600,"'method' attribute must be a string");if(validateJSONRPCIdAttribute(t),!(void 0===o||Array.isArray(o)||null!==o&&"object"==typeof o))throw createJSONRPCError(-32602,"'params' attribute must be an array, an object or undefined")}function validateJSONRPCResponse({jsonrpc:r,result:e,error:t,id:o}){if(validateJSONRPCAttribute(r),void 0!==e&&void 0!==t)throw createJSONRPCError(-32603,"A JSON-RPC response cannot have both a 'result' and 'error' attribute");if(void 0!==t){if(!t.code||"number"!=typeof t.code)throw createJSONRPCError(-32603,"A JSON-RPC error response must have a 'code' attribute");if(!t.message||"string"!=typeof t.message)throw createJSONRPCError(-32603,"A JSON-RPC error response must have a 'message' attribute")}validateJSONRPCIdAttribute(o)}function validateJSONRPCAttribute(r){if(!r)throw createJSONRPCError(-32600,"'jsonrpc' attribute is missing");if("2.0"!==r)throw createJSONRPCError(-32600,"'jsonrpc' attribute value must be '2.0'")}function validateJSONRPCIdAttribute(r){if(null!==r&&"number"!=typeof r&&"string"!=typeof r)throw createJSONRPCError(-32600,"'id' attribute must be a number, a string or null")}Object.defineProperty(exports,"__esModule",{value:!0});const errors={"-32700":"Parse error","-32600":"Invalid request","-32601":"Method not found","-32602":"Invalid params","-32603":"Internal error"};function createJSONRPCError(r,e){if(e||(e=errors[String(r)]),!e)return createJSONRPCError(-32603);const t=new Error(e);return t.jsonRPCErrorCode=r,t}function _extends(){return(_extends=Object.assign||function(r){for(var e=1;e<arguments.length;e++){var t=arguments[e];for(var o in t)Object.prototype.hasOwnProperty.call(t,o)&&(r[o]=t[o])}return r}).apply(this,arguments)}function createClientError(r="Unknown client error",e){return _createError(r,_extends({},e,{$isClientError:!0}))}function isClientError(r){return Boolean(r&&r.$isClientError)}function isServerError(r){return Boolean(r&&r.$isServerError)}function _createError(r,e){const t=r instanceof Error?r:new Error(r);return Object.assign(t,e),t}function _asyncToGenerator(r){return function(){var e=this,t=arguments;return new Promise(function(o,n){var s=r.apply(e,t);function step(r,e){try{var t=s[r](e),i=t.value}catch(r){return void n(r)}t.done?o(i):Promise.resolve(i).then(_next,_throw)}function _next(r){step("next",r)}function _throw(r){step("throw",r)}_next()})}}const INVOKE_METHOD_VERSION=1;class RemoteResourceJSONRPCHandler{constructor({resource:r,publicMethods:e}){this.resource=r,this.publicMethods=e}handleRequest(r,{awsRequestId:e}={}){var t=this;return _asyncToGenerator(function*(){try{if(validateJSONRPCRequest(r),"invoke"!==r.method)throw createJSONRPCError(-32601);const o=r.params||{},n=o.name,s=o.input,i=o.environment,a=o.version;if(!n)throw createClientError("Method name is missing");if(void 0===a)throw createClientError("'invoke' method version is missing");if(a!==INVOKE_METHOD_VERSION)throw createClientError(`'invoke' method version ${a} is unsupported`);if(!t.publicMethods.includes(n))throw createClientError(`Remote method '${n}' doesn't exist`);let u=yield t.resource[n](s,i);return u&&u.$serialize&&(u=u.$serialize()),buildJSONRPCResult(r.id,{output:u})}catch(t){let o=t;if(!(t.jsonRPCErrorCode||isClientError(t)||isServerError(t))){if(e){let r=t.stack||t.message;r=(r=r.replace(/\s+/g," ")).trim(),console.log("[ERROR] "+r)}else console.error(t);let r="An error occurred while running a resource method remotely";e&&(r+=` (awsRequestId: '${e}')`),o=createJSONRPCError(-1,r)}return buildJSONRPCError(r.id,o)}})()}}function _extends$1(){return(_extends$1=Object.assign||function(r){for(var e=1;e<arguments.length;e++){var t=arguments[e];for(var o in t)Object.prototype.hasOwnProperty.call(t,o)&&(r[o]=t[o])}return r}).apply(this,arguments)}let jsonRPCHandler;function handler(r,{awsRequestId:e},t){jsonRPCHandler.handleRequest(r,{awsRequestId:e}).then(r=>{t(null,r)}).catch(t)}(()=>{const r=require("./definition.json");let e=require("./builder");e.default&&(e=e.default);const t=e(),o=_extends$1({},r.attributes,t);jsonRPCHandler=new RemoteResourceJSONRPCHandler({resource:o,publicMethods:r.methods})})(),exports.handler=handler;
