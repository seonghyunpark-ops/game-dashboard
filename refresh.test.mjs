import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const source=await fs.readFile(new URL('./app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('// Reload from the server;'),source.indexOf('const session = createSession({'));
function setup(read=async()=>({docs:[{id:'u',data:()=>({score:4})}]}),join=async()=>{}){
 let user={uid:'admin'};const button={},statuses=[],state={src:'game',rows:{},profiles:{}};
 const scope={$:()=>button,session:{user:()=>user,ensure:async()=>({db:{}})},state,SOURCES:{game:{collection:'users',firebase:{},columns:[],authJoin:true}},FINANCE:[],getDocsFromServer:read,collection:(_,c)=>c,joinAuth:join,setStatus:(s)=>statuses.push(s),setupControls(){},render(){},inferColumns(){}};
 vm.runInNewContext(code,scope);return{scope,state,button,statuses,logout(){user=null;}};
}
test('refresh reads server and automatically joins login information',async()=>{let joined=0;const t=setup(undefined,async()=>{joined++;});await t.button.onclick();assert.equal(joined,1);assert.equal(t.state.rows.game[0].score,4);assert.match(t.statuses.at(-1),/로그인 정보 포함/);assert.equal(t.button.disabled,false);});
test('late server data is discarded after logout',async()=>{let finish;const t=setup(()=>new Promise(r=>finish=r));const pending=t.button.onclick();await new Promise(setImmediate);t.logout();finish({docs:[{id:'secret',data:()=>({score:1})}]});await pending;assert.equal(t.state.rows.game,undefined);assert.equal(t.button.disabled,true);});
test('auth permission failure preserves fresh server rows and reports partial failure',async()=>{const t=setup(undefined,async()=>{throw Error('권한 없음');});await t.button.onclick();assert.equal(t.state.rows.game[0].score,4);assert.match(t.statuses.at(-1),/로그인 정보 조회 실패/);});
test('switching data source discards a late refresh',async()=>{let finish;const t=setup(()=>new Promise(r=>finish=r));const pending=t.button.onclick();await new Promise(setImmediate);t.state.src='other';finish({docs:[]});await pending;assert.equal(t.state.rows.game,undefined);});


test('refresh supports multiple profile collections and preserves the field allowlist',async()=>{const t=setup(async collection=>({docs:[{id:'u',data:()=>collection==='profiles'?{nickname:'new name',privateField:'secret'}:{score:4}}]}));t.scope.SOURCES.game.profileJoins=[{collection:'profiles',fields:['nickname']},{collection:'profiles',fields:['nickname']}];await t.button.onclick();assert.equal(t.state.profiles.game.length,2);assert.equal(t.state.profiles.game[0].get('u').nickname,'new name');assert.equal(t.state.profiles.game[0].get('u').privateField,undefined);});
