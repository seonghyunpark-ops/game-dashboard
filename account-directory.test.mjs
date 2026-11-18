import test from 'node:test';
import assert from 'node:assert/strict';
import {filterAccounts,accountRows,createDirectoryLoader} from './account-directory.js';
test('searches hidden email, account code, name and login provider',()=>{
 const rows=[{uid:'u',accountCode:'ABCD',displayName:'Juyi',emails:['relay@privaterelay.appleid.com'],providers:['Apple']}];
 for(const q of ['juyi','abcd','relay@','Apple'])assert.equal(filterAccounts(rows,q).length,1);
 assert.equal(filterAccounts(rows,'missing').length,0);
 assert.match(accountRows([{...rows[0],displayName:'<script>',coins:1000,tokens:100,storiesOwned:0}]),/&lt;script&gt;/);
});
test('loads every page without requiring any transaction records',async()=>{
 const owner={getIdToken:async()=>'test'},published=[],urls=[];
 const loader=createDirectoryLoader({owner:()=>owner,endpoint:'https://example.com/api',publish:s=>published.push(s),fetcher:async url=>{urls.push(url);return {ok:true,json:async()=>({rows:[{uid:String(urls.length)}],nextPageToken:urls.length===1?'next':null})};}});
 await loader.load();assert.match(urls[1],/pageToken=next/);assert.equal(published.at(-1).rows.length,2);assert.equal(published.at(-1).loading,false);
});
test('logout discards late private responses',async()=>{
 let user={getIdToken:async()=>'test'},resolve;const published=[];
 const loader=createDirectoryLoader({owner:()=>user,endpoint:'https://example.com',publish:s=>published.push(s),fetcher:()=>new Promise(r=>resolve=r)});
 const loading=loader.load();await Promise.resolve();user=null;loader.cancel();resolve({ok:true,json:async()=>({rows:[{uid:'private'}]})});await loading;
 assert.equal(published.length,0);
});
