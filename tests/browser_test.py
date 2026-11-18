from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent.parent/"public"
HTML=re.sub(r'<script[^>]*src=[^>]*></script>','',(ROOT/'index.html').read_text())
HTML=re.sub(r'<link[^>]*rel="stylesheet"[^>]*>','',HTML)
MOCK="""
window.__cloud={loggedIn:false,nick:null,state:null,version:'v1'};
window.fetch=async(url,opts={})=>{
 let params=new URLSearchParams(String(url).split('?')[1]||''), action=params.get('action'),body=JSON.parse(opts.body||'{}');
 let x=window.__cloud;
 const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json'}});
 if(action==='me')return reply(x.loggedIn?{ok:true,signedIn:true,user:{nickname:x.nick},state:x.state,version:x.version}:{ok:true,signedIn:false});
 if(action==='register'){x.loggedIn=true;x.nick=body.nickname;x.state=body.state;x.version='v1';return reply({ok:true,signedIn:true,user:{nickname:x.nick},state:x.state,version:x.version},201);}
 if(action==='login'){if(!x.nick)return reply({error:'Falsch'},401);x.loggedIn=true;return reply({ok:true,signedIn:true,user:{nickname:x.nick},state:x.state,version:x.version});}
 if(action==='save'){if(body.version!==x.version)return reply({error:'Konflikt',state:x.state,version:x.version},409);x.state=body.state;x.version='v'+(Number(x.version.slice(1))+1);return reply({ok:true,version:x.version});}
 if(action==='logout'){x.loggedIn=false;return reply({ok:true});}
 return reply({error:'Unbekannt'},404);
}
"""

def inject(page):
 page.set_content(HTML)
 page.add_style_tag(content=(ROOT/'style.css').read_text())
 page.add_script_tag(content=(ROOT/'assets/decks.js').read_text())
 page.add_script_tag(content=(ROOT/'assets/challenges.js').read_text())
 page.add_script_tag(content=MOCK)
 page.add_script_tag(content=(ROOT/'app.js').read_text())

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
 page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 inject(page)
 assert page.locator('.deck-card').count()==11
 assert page.locator('#xpHeader').count()==1
 page.screenshot(path=str(ROOT/'desktop_preview.png'),full_page=False)
 page.locator('.deck-card').first.locator('[data-action=start-study]').click()
 page.locator('[data-action=reveal]').click()
 page.locator('[data-grade=sure]').click()
 assert page.locator('#xpHeader').inner_text().startswith('✦')
 page.locator('[data-page=achievements]').click();assert page.locator('.achievement').count()==14
 page.locator('[data-page=challenge]').click()
 page.locator('[data-action=challenge-start-mode][data-topic=kg]').click()
 assert page.locator('.choice').count()==4
 page.locator('.choice').first.click();assert page.locator('.arena-explain').count()==1
 page.locator('[data-action=challenge-next]').click()
 assert page.locator('.choice').count()==4
 page.locator('[data-action=challenge-leave]').click()
 page.locator('#accountOpen').click();page.locator('#tabRegister').click()
 page.locator('#accountForm input[name=nickname]').fill('FuchsDerLernt')
 page.locator('#accountForm input[name=password]').fill('StarkesPasswort-3456')
 page.locator('#accountSubmit').click();page.wait_for_timeout(300)
 assert page.locator('#accountDialog').evaluate('(e)=>!e.open'),page.locator('#accountFeedback').inner_text()
 assert 'FuchsDerLernt' in page.locator('#accountOpen').inner_text()
 page.locator('[data-page=study]').click();page.locator('[data-action=start-study]').first.click();page.locator('[data-action=reveal]').click();page.locator('[data-grade=almost]').click()
 page.wait_for_timeout(1500)
 assert page.evaluate('window.__cloud.state.activity.length')>=2
 page.locator('#accountOpen').click();page.locator('#logoutNow').click();page.wait_for_timeout(300)
 assert 'Anmelden' in page.locator('#accountOpen').inner_text()
 assert not errors,errors
 print('Desktop, game mechanics, registration, cloud save/logout: PASS')
 # Mobile and tablet across widths; no overflow
 for width,height in [(390,844),(375,812),(768,900),(1200,880)]:
  mobile=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=width<500,has_touch=width<500)
  pg=mobile.new_page();merr=[];pg.on('pageerror',lambda e:merr.append(str(e)))
  inject(pg)
  assert not pg.evaluate('document.documentElement.scrollWidth > window.innerWidth'),f'horizontal overflow at {width}: '+str(pg.evaluate('document.documentElement.scrollWidth'))
  pg.locator('[data-page=challenge]').click()
  pg.locator('[data-action=challenge-start-mode][data-mode=calm]').first.click()
  assert pg.locator('.choice').count()==4
  if width==390:pg.screenshot(path=str(ROOT/'mobile_preview.png'),full_page=False)
  assert not merr,merr
  mobile.close()
 print('Mobile 375/390, tablet 768 and desktop 1200 responsiveness: PASS')
 browser.close()
