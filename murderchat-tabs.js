export const murderchatTabs=[['accounts','계정 · 재화'],['plays','플레이 기록'],['rewards','출석 · 보상'],['coupons','쿠폰'],['ai','AI 사용량']];
export function renderMurderchatTabs(panels){
 return '<div class="mc-tabs" role="tablist" aria-label="머더미스터리 관리 패널">'+murderchatTabs.map(([id,label],i)=>`<button class="btn" type="button" role="tab" id="mc-tab-${id}" data-mc-tab="${id}" aria-controls="mc-panel-${id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${label}</button>`).join('')+'</div>'+murderchatTabs.map(([id],i)=>`<div role="tabpanel" id="mc-panel-${id}" aria-labelledby="mc-tab-${id}" tabindex="0" ${i?'hidden':''}>${panels[id]||''}</div>`).join('');
}
export function mountMurderchatTabs(root,{selected='accounts',onSelect=()=>{}}={}){
 const tabs=[...root.querySelectorAll('[data-mc-tab]')];
 const select=(id,focus=false)=>{
  if(!tabs.some(t=>t.dataset.mcTab===id))id='accounts';
  for(const tab of tabs){const active=tab.dataset.mcTab===id;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;root.querySelector('#'+tab.getAttribute('aria-controls')).hidden=!active;if(active&&focus)tab.focus();}
  onSelect(id);
 };
 for(const tab of tabs){
  tab.onclick=()=>select(tab.dataset.mcTab);
  tab.onkeydown=e=>{const i=tabs.indexOf(tab),n=tabs.length;const next={ArrowRight:(i+1)%n,ArrowLeft:(i+n-1)%n,Home:0,End:n-1}[e.key];if(next===undefined)return;e.preventDefault();select(tabs[next].dataset.mcTab,true);};
 }
 select(selected);
}
