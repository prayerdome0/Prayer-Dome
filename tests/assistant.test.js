global.window = undefined;
const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'..','ai-prayer-data.js'),'utf8');
eval(src.replace(/if \(typeof window[\s\S]*$/,''));

const tests=[
 ["I'm struggling with fear","fear"],
 ["Pray for my family","family"],
 ["i lost my job and cant pay rent","provision"],
 ["my mother passed away last week","grief"],
 ["I was diagnosed with cancer","healing"],
 ["my marriage is falling apart","marriage"],
 ["I don't know what to do about this decision","guidance"],
 ["I can't forgive my brother","forgiveness"],
 ["I feel hopeless and want to give up","depression"],
 ["I am so tired and weary","strength"],
 ["protect me on my journey","protection"],
 ["thank you God for everything","thanksgiving"],
 ["I doubt God is real","faith"],
 ["how do i get saved","salvation"],
 ["I have exams next week","work"],
 ["I am addicted to pornography","addiction"],
 ["pray for my pastor and church","church"],
 ["pray for my country and leaders","nation"],
 ["asdfgh qwerty",null],
];
let pass=0,fail=0;
for(const [q,exp] of tests){
  const r=pdBuildResponse(q);
  const got=r.matched?r.primary.id:null;
  const ok= exp===null ? !r.matched : got===exp;
  console.log((ok?'PASS':'FAIL')+`  "${q}" -> ${got}${ok?'':'  (expected '+exp+')'}`);
  ok?pass++:fail++;
}
// crisis
const c=pdBuildResponse("I want to kill myself");
console.log((c.crisis?'PASS':'FAIL')+'  crisis flag on suicidal text ->',c.crisis, c.primary.id);
c.crisis?pass++:fail++;
const nc=pdBuildResponse("thank you God");
console.log((!nc.crisis?'PASS':'FAIL')+'  no false crisis flag ->',nc.crisis);
!nc.crisis?pass++:fail++;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
