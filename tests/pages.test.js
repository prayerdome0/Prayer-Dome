let JSDOM;
try { ({JSDOM} = require('jsdom')); }
catch (e) {
  console.error('jsdom is not installed. Run:  npm install --no-save jsdom');
  process.exit(2);
}
const fs=require('fs'), path=require('path');
const ROOT=require('path').join(__dirname,'..');
let pass=0,fail=0;
const t=(name,ok,extra='')=>{ok?pass++:fail++; console.log((ok?'PASS  ':'FAIL  ')+name+(extra?'  '+extra:''));};

(async()=>{
const html=fs.readFileSync(path.join(ROOT,'ai-prayer.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://prayerdome.net/ai-prayer'});
const w=dom.window;
// stub APIs jsdom lacks
w.localStorage.clear();
w.navigator.clipboard={writeText:()=>Promise.resolve()};
w.Element.prototype.scrollIntoView=function(){};
// load data + inline script
w.eval(fs.readFileSync(path.join(ROOT,'ai-prayer-data.js'),'utf8'));
const inline=[...dom.window.document.querySelectorAll('script:not([src]):not([type])')].map(s=>s.textContent).join('\n');
try{ w.eval(inline); }catch(e){ console.log('inline script error:',e.message); }

const d=w.document;
t('topic chips rendered', d.querySelectorAll('#topicChips .chip').length===18, d.querySelectorAll('#topicChips .chip').length+' chips');

// simulate a user asking
d.getElementById('askInput').value="I'm struggling with fear";
w.askAssistant();
const res=d.getElementById('results');
t('results rendered after ask', res.innerHTML.length>500);
t('shows Fear & Anxiety topic', res.textContent.includes('Fear & Anxiety'));
t('renders scripture refs', (res.textContent.match(/KJV/g)||[]).length===4);
t('renders prayer points', res.querySelectorAll('ol.points li').length===5);
t('renders written prayer', res.querySelector('.prayer-body').textContent.length>100);
t('renders encouragement', !!res.querySelector('.encourage'));
t('no crisis banner for fear', !res.querySelector('.crisis'));

// crisis path
d.getElementById('askInput').value="I feel hopeless and want to end it all";
w.askAssistant();
t('crisis banner appears for self-harm text', !!d.querySelector('#results .crisis'));
t('crisis banner is first element', d.querySelector('#results .result-block').firstElementChild.classList.contains('crisis'));

// unmatched
d.getElementById('askInput').value="zzzz qqqq";
w.askAssistant();
t('fallback general prayer on no match', d.getElementById('results').textContent.includes('General Prayer'));

// save
w.showTopic('healing');
w.savePrayer();
t('savePrayer persists', JSON.parse(w.localStorage.getItem('pd-saved-prayers')).length===1);
t('saved list visible', d.getElementById('savedWrap').style.display==='block');
w.removeSaved('healing');
t('removeSaved works', JSON.parse(w.localStorage.getItem('pd-saved-prayers')).length===0);

// XSS
d.getElementById('askInput').value='<img src=x onerror=alert(1)> fear';
w.askAssistant();
t('no script/img injection from user input', !d.getElementById('results').querySelector('img[onerror]'));

// theme
w.toggleDarkMode();
t('dark mode toggles + persists', d.body.classList.contains('dark-mode') && w.localStorage.getItem('pd-theme')==='dark');

// ---- live.html structural checks (module script can't run in jsdom) ----
const lhtml=fs.readFileSync(path.join(ROOT,'live.html'),'utf8');
const ldom=new JSDOM(lhtml,{url:'https://prayerdome.net/live'});
const ld=ldom.window.document;
for(const id of ['liveDot','liveTag','livePlayer','offlineState','playOverlay','statusTitle','viewerCount','chatBody','chatInput','sendBtn','archiveGrid','npTitle','reminderBtn','asPrayer','chatComposer','chatLocked'])
  t('live.html has #'+id, !!ld.getElementById(id));
t('live.html play button present', !!ld.querySelector('.play-btn'));
t('live.html uses exact welcome copy', ld.body.textContent.includes('Welcome to Prayer Dome Live.'));
t('live.html admin-managed copy', ld.body.textContent.includes('managed by Prayer Dome administrators'));
t('live.html closing copy', ld.body.textContent.includes('Stay connected, be encouraged, and worship together wherever you are.'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
})();
