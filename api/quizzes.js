'use strict';
const academy=require('./academy');
module.exports=function(req,res){
  const data=academy.getAcademyData();
  const out={
    success:true,
    count:data.quizzes.length,
    passingScore:80,
    quizzes:data.quizzes.map(q => ({
      id: q.id, lessonId: q.lessonId, title: q.title, trackId: q.trackId,
      track: q.track, description: q.description, level: q.level,
      questionCount: q.questions ? q.questions.length : 0,
      passingScore: q.passingScore || 80
    }))
  };
  if(res){
    res.statusCode=200;
    if (typeof res.setHeader === 'function') res.setHeader('Content-Type','application/json');
    if (typeof res.setHeader === 'function') res.setHeader('Cache-Control','public, max-age=300, stale-while-revalidate=3600');
    res.end(JSON.stringify(out,null,2));
  }
  return out;
};
