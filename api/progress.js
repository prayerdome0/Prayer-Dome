'use strict';
/* Lightweight public progress endpoint shape. Sensitive personal progress is
   stored locally/firestore; this endpoint documents the API contract and returns
   a safe starter object for anonymous visitors. */
module.exports=function(req,res){res.statusCode=200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({success:true,message:'Use localStorage key pd_academy_progress or Firestore userAcademy/{uid} when signed in.',schema:{completedLessons:[],passedQuizzes:{},certificates:[]}},null,2));};
