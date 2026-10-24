import * as lifecycle from '../lifecycle/engine.mjs';
export const targetFor=(agent='generic',home,targetDirectory)=>lifecycle.resolveTarget({agent,home,'target-directory':targetDirectory}).target;
export async function status({agent='generic',home,targetDirectory}={}){const s=lifecycle.status(lifecycle.resolveTarget({agent,home,'target-directory':targetDirectory}));return {...s,edited:s.edited?['managed-content']:[]};}
export async function install({agent='generic',home,targetDirectory,...options}={}){return lifecycle.install(lifecycle.resolveTarget({agent,home,'target-directory':targetDirectory}),options);}
