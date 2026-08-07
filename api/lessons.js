'use strict';
const academy = require('./academy');
function summary(l){return {id:l.id,trackId:l.trackId,track:l.track,title:l.title,subtitle:l.subtitle,scripture:l.scripture,summary:l.summary,level:l.level,minutes:l.minutes,objectives:l.objectives,sections:l.sections,reflection:l.reflection,action:l.action,openingPrayer:l.openingPrayer,quizId:l.quizId,nextLessonId:l.nextLessonId};}
module.exports=function(req,res){const data=academy.getAcademyData();const out={success:true,count:data.lessons.length,lessons:data.lessons.map(summary)};if(res){res.statusCode=200;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','public, max-age=300, stale-while-revalidate=3600');res.end(JSON.stringify(out,null,2));}return out;};
