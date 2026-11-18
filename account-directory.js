const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v&&!isNaN(new Date(v))?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—';
export const filterAccounts=(rows,query)=>{const q=query.trim().toLowerCase();return rows.filter(a=>[a.uid,a.accountCode,a.displayName,a.nickname,...(a.emails||[]),...(a.providers||[])].join(' ').toLowerCase().includes(q));};
export function accountRows(rows){
 return rows.length?rows.map(a=>`<tr><td>${esc(a.displayName||a.nickname||'이름 미제공')}<br><small>${esc(a.nickname||'')}</small></td><td><code>${esc(a.accountCode)}</code><br><small>${esc(a.uid)}</small></td><td>${(a.emails||[]).map(esc).join('<br>')||'제공되지 않음'}${a.emailHidden?'<br><small>Apple 이메일 가리기 · 원래 이메일은 조회 불가</small>':''}</td><td>${esc(a.providers.join(' · ')||'연동 정보 없음')}</td><td>${Number(a.coins).toLocaleString('ko-KR')}</td><td>${Number(a.tokens).toLocaleString('ko-KR')}</td><td>${Number(a.storiesOwned)}편</td><td>${esc(date(a.createdAt))}</td><td>${esc(date(a.lastSignInAt))}</td><td>${a.disabled?'사용 중지':'정상'}</td></tr>`).join(''):'<tr><td colspan="10">일치하는 계정이 없습니다.</td></tr>';
}
export function createDirectoryLoader({owner,publish,endpoint,fetcher=fetch}){
 let generation=0,controller;
 return {
  cancel(){generation++;controller?.abort();},
  async load(){
   const ticket=++generation,user=owner();controller?.abort();controller=new AbortController();
   const current=()=>ticket===generation&&owner()===user;
   if(!user)return;
   const rows=[],seen=new Set();let pageToken;
   try{
    do{
     const token=await user.getIdToken();if(!current())return;
     const url=new URL(endpoint);url.searchParams.set('view','accounts');if(pageToken)url.searchParams.set('pageToken',pageToken);
     const response=await fetcher(url.href,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal});
     if(!response.ok)throw Error(response.status===403?'관리 계정만 조회할 수 있습니다.':`계정 조회 실패 (${response.status})`);
     const page=await response.json();if(!current())return;
     if(!Array.isArray(page.rows))throw Error('계정 목록 응답을 확인해 주세요.');
     for(const row of page.rows)if(!rows.some(r=>r.uid===row.uid))rows.push(row);
     pageToken=page.nextPageToken;
     if(pageToken&&seen.has(pageToken))throw Error('페이지가 반복되어 조회를 중단했습니다.');
     if(pageToken)seen.add(pageToken);
     publish({rows:[...rows],loading:!!pageToken});
    }while(pageToken);
   }catch(e){if(current()&&e.name!=='AbortError')publish({rows,error:e.message});}
  }
 };
}
export function mountAccountDirectory(host,{owner,endpoint}){
 const section=document.createElement('section');section.className='card cutline-section';
 section.innerHTML='<div class="card-h"><h2>전체 게임 계정</h2><button type="button" class="btn" data-directory-refresh>계정 새로고침</button></div><div class="note cutline-notice">로그인한 계정은 결제·쿠폰 사용 전에도 표시됩니다. Apple 가림 주소와 Play 게임즈 계정은 실제 이메일이 제공되지 않을 수 있습니다. 마지막 로그인은 인증 기록 기준이며 실시간 접속 상태가 아닙니다.</div><div style="padding:12px"><label>계정 검색 <input type="search" data-directory-query placeholder="이름 · 이메일 · 계정 코드 · UID · 로그인 방식" style="width:min(520px,100%);padding:8px"></label><p role="status" data-directory-status>계정 목록을 불러오는 중…</p></div><div class="tablewrap"><table><thead><tr>'+['이름 / 닉네임','계정 코드 / UID','이메일','로그인 방식','작품 코인','AI CHAT 토큰','소장 작품','가입 시각','마지막 로그인','상태'].map(t=>`<th scope="col">${t}</th>`).join('')+'</tr></thead><tbody></tbody></table></div>';
 host.prepend(section);let state={rows:[],loading:true};
 const input=section.querySelector('input'),status=section.querySelector('[data-directory-status]'),button=section.querySelector('button');
 const render=()=>{const matches=filterAccounts(state.rows,input.value);section.querySelector('tbody').innerHTML=accountRows(matches);status.textContent=state.error?`${state.error} · ${state.rows.length}개까지 조회됨`:`${state.loading?'불러오는 중 · ':''}전체 ${state.rows.length}개 / 검색 ${matches.length}개`;button.disabled=!!state.loading;};
 const loader=createDirectoryLoader({owner,endpoint,publish:value=>{if(!section.isConnected)return;state=value;render();}});
 input.addEventListener('input',render);button.onclick=()=>{state={rows:[],loading:true};render();loader.load();};loader.load();
 return ()=>{loader.cancel();section.remove();state={rows:[]};};
}
