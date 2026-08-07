'use strict';
const academy=require('./academy');
module.exports=function(req,res){const data=academy.getAcademyData();const out={success:true,count:data.quizzes.length,passingScore:80,quizzes:data.quizzes};if(res){res.statusCode=200;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','public, max-age=300, stale-while-revalidate=3600');res.end(JSON.stringify(out,null,2));}return out;};
