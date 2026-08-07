/* ==========================================================================
   Prayer Dome Academy — Teaching, stories, quizzes and resources
   --------------------------------------------------------------------------
   Plain global script. Load before pd-academy.js or pages that consume it.
   Content is intentionally portable: same data powers /lessons, /stories,
   /resources, /quiz and the JSON APIs under /api.
   ========================================================================== */

(function () {
  'use strict';
  var W = window;
  W.PD_ACADEMY = W.PD_ACADEMY || {};

  var tracks = [
    { id: 'foundations', title: 'Foundations', icon: 'fa-cross', color: 'blue', summary: 'Know what you believe and why it matters.' },
    { id: 'prayer', title: 'Prayer & Intercession', icon: 'fa-hands-praying', color: 'gold', summary: 'Grow in daily prayer, night prayer and spiritual warfare.' },
    { id: 'word', title: 'The Word of God', icon: 'fa-book-bible', color: 'blue', summary: 'Study, meditate, obey and teach Scripture with confidence.' },
    { id: 'spirit', title: 'Holy Spirit & Gifts', icon: 'fa-fire', color: 'gold', summary: 'Walk in the Spirit and serve with His power and character.' },
    { id: 'character', title: 'Christlike Character', icon: 'fa-heart', color: 'blue', summary: 'Develop faith, integrity, patience, stewardship and love.' },
    { id: 'mission', title: 'Mission & Service', icon: 'fa-globe-africa', color: 'gold', summary: 'Become active in evangelism, fellowship, giving and ministry.' }
  ];

  var lessonSeeds = [
    ['l01', 'foundations', 'Salvation: A New Life in Christ', 'From seeker to disciple', 'John 3:16', 'Understand why salvation is by grace through faith and how to live as a new creation.', 'Receive Christ, explain salvation, and begin daily obedience.'],
    ['l02', 'foundations', 'The Bible: God’s Living Word', 'A practical guide to Scripture', '2 Timothy 3:16-17', 'See how the Bible is inspired, reliable and sufficient for life and ministry.', 'Read, meditate and apply Scripture daily.'],
    ['l03', 'foundations', 'Faith That Works', 'Believing God in daily life', 'Hebrews 11:6', 'Learn how faith comes, grows and produces action through trials and obedience.', 'Respond to promises with confession, patience and works of faith.'],
    ['l04', 'prayer', 'How to Pray with Confidence', 'The Lord’s Prayer as a pattern', 'Matthew 6:9-13', 'Move from awkward prayer to meaningful conversation with God.', 'Use a simple pattern for personal and family prayer.'],
    ['l05', 'prayer', 'The Power of Night Prayer', 'Watchfulness and intercession', 'Luke 6:12', 'Discover why night seasons can be strategic for seeking God and standing in the gap.', 'Build a sustainable prayer watch without condemnation.'],
    ['l06', 'prayer', 'Fasting and Spiritual Breakthrough', 'Hunger that opens heaven', 'Matthew 6:16-18', 'Learn the purpose, types and safeguards of biblical fasting.', 'Plan a fast and pray with clear biblical motives.'],
    ['l07', 'word', 'How to Study the Bible', 'Observe, interpret, apply', 'Ezra 7:10', 'Use a simple method that helps you understand context and obey truth.', 'Study one passage and produce a personal application.'],
    ['l08', 'word', 'Hearing God Through Scripture', 'Wisdom for decisions', 'Psalm 119:105', 'Learn how God guides through the Word, peace, counsel and circumstances.', 'Test impressions by Scripture and wise counsel.'],
    ['l09', 'word', 'Sharing Your Testimony', 'Tell what God has done', 'Revelation 12:11', 'Prepare a clear, humble story of grace that points people to Jesus.', 'Write and share a three-minute testimony.'],
    ['l10', 'spirit', 'Who Is the Holy Spirit?', 'The believer’s helper', 'John 14:16-17', 'Understand the person, presence and work of the Holy Spirit.', 'Welcome the Spirit’s leadership in daily life.'],
    ['l11', 'spirit', 'The Fruit of the Spirit', 'Character before gifting', 'Galatians 5:22-23', 'Grow in love, joy, peace, patience, kindness, goodness, faithfulness, gentleness and self-control.', 'Identify one fruit to practice in relationships.'],
    ['l12', 'spirit', 'Using Spiritual Gifts Wisely', 'Serve the body in love', '1 Corinthians 12:7', 'Discover how gifts edify the church and must operate with order and humility.', 'Serve in one gift area and ask for feedback.'],
    ['l13', 'character', 'Overcoming Fear and Anxiety', 'Peace under pressure', 'Philippians 4:6-7', 'Replace worry with prayer, truth, thanksgiving and godly action.', 'Create a personal peace plan for anxious moments.'],
    ['l14', 'character', 'Integrity and Stewardship', 'Faithful in little and much', 'Luke 16:10', 'Serve God faithfully with money, time, words, relationships and influence.', 'Set stewardship goals in finances, time and speech.'],
    ['l15', 'character', 'Forgiveness and Healthy Relationships', 'Freedom through grace', 'Colossians 3:13', 'Understand forgiveness, boundaries, reconciliation and love in community.', 'Take one step toward healing a relationship.'],
    ['l16', 'mission', 'Evangelism Made Simple', 'Share Jesus naturally', 'Matthew 28:19-20', 'Learn practical ways to start spiritual conversations and explain the gospel.', 'Pray for one person and share Christ this week.'],
    ['l17', 'mission', 'Serving in the Local Church', 'Every member has a part', '1 Corinthians 12:12-27', 'Discover why serving is not optional for healthy discipleship.', 'Choose a team or ministry to support.'],
    ['l18', 'mission', 'Generosity and Kingdom Giving', 'Heart, habit and harvest', '2 Corinthians 9:7', 'Grow in cheerful, sacrificial and intentional generosity.', 'Create a giving plan and support gospel work.']
  ];

  var lessons = lessonSeeds.map(function (s, i) {
    var track = tracks.filter(function (t) { return t.id === s[1]; })[0];
    var mins = 10 + ((i * 3) % 11);
    var points = [
      'God does not call qualified people in their own strength; He qualifies those who respond to Him.',
      'Truth becomes fruitful when it moves from information to meditation, prayer and obedience.',
      'The Christian life is personal but never private—it is lived together in the body of Christ.',
      'Small faithful acts matter because God sees them, rewards them and uses them for His purpose.',
      'Every lesson should lead to one action: a prayer, a conversation, a service opportunity, or a changed habit.'
    ];
    return {
      id: s[0],
      trackId: s[1],
      track: track.title,
      icon: track.icon,
      color: track.color,
      order: i + 1,
      level: i < 6 ? 'Beginner' : (i < 12 ? 'Growing' : 'Leader'),
      title: s[2],
      subtitle: s[3],
      scripture: s[4],
      summary: s[5],
      minutes: mins,
      objectives: [s[6], 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: s[5] + ' This lesson is designed for spiritual growth rather than mere information. Read slowly, pause after each section, and ask the Holy Spirit to show you where truth should become action.' },
        { heading: 'Biblical Foundation', body: 'The key passage is ' + s[4] + '. Biblical truth is not a collection of isolated ideas. It reveals God’s nature, His promises, His ways and His kingdom purpose. As you study, look for what the text teaches about God, people, sin, grace and mission.' },
        { heading: 'Key Teaching', body: points[i % points.length] + ' In this lesson, focus on the difference between hearing truth and doing it. Discipleship grows through submission, accountability, practice and repetition over time.' },
        { heading: 'Why It Matters Today', body: 'Many believers struggle because they know truths but lack simple pathways to live them out. This lesson gives concrete steps: pray over the Scripture, discuss it with another believer, adjust one habit, and serve someone in the name of Jesus.' },
        { heading: 'Application', body: 'Choose one measurable action before moving on. For example: set a prayer time, memorize one verse, contact one person, forgive one offence, give toward kingdom work, join a serving team, or share what you learned with a friend.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-' + s[0],
      nextLessonId: lessonSeeds[i + 1] ? lessonSeeds[i + 1][0] : null
    };
  });

  var storySeeds = [
    ['st01', 'The Night Prayer That Changed a Family', 'Prayer', 'A midnight prayer meeting began with one person and ended with restoration across generations.'],
    ['st02', 'The Widow’s Seed', 'Generosity', 'A small gift given in faith became a testimony that God supplies seed to the sower.'],
    ['st03', 'A Song in the Hospital', 'Faith', 'While waiting for a report, a believer chose worship and discovered peace that medical news could not explain.'],
    ['st04', 'The Text That Reunited Friends', 'Forgiveness', 'One humble message reopened a door that pride had kept closed for years.'],
    ['st05', 'From Listener to Servant', 'Service', 'A member who once only attended services became one of the most faithful volunteers.'],
    ['st06', 'The Bus Stop Conversation', 'Evangelism', 'A short gospel conversation reminded a discouraged student that God had not forgotten him.'],
    ['st07', 'Bread for the Journey', 'Provision', 'When money ran out, unexpected kindness arrived just in time.'],
    ['st08', 'The Children Who Prayed for Rain', 'Childlike Faith', 'A Sunday school class learned that God hears simple, honest prayers.'],
    ['st09', 'A Bible Left on a Bench', 'The Word', 'A discarded Scripture found its way to someone searching for answers.'],
    ['st10', 'The Quarrel That Became a Ministry', 'Reconciliation', 'Two believers turned their conflict into a ministry of helping others reconcile.']
  ];

  var stories = storySeeds.map(function (s, i) {
    var par = [
      s[3],
      'For a long time, the need looked larger than the answer. Prayers were short, feelings were uncertain, and people around the situation had their own opinions. Yet the people in this story chose to do a small thing faithfully: they brought the matter before God instead of discussing it only with people.',
      'Days passed before anything changed. During those days, the lesson was not spectacle but steadiness. Worship continued. Forgiveness was chosen one conversation at a time. Scripture was remembered, even when feelings did not immediately agree with it.',
      'When the answer began to appear, it did not come in the exact form everyone expected. It came through humility, obedience and timing that only God could arrange. Doors opened, relationships softened, and people who had once felt helpless became witnesses of God’s goodness.',
      'This story matters because it shows that God often works through ordinary obedience. No one needed to be famous, powerful or perfect. They only needed to believe that God sees, God cares, and God rewards those who diligently seek Him.',
      'If this story speaks to you, take one step today. Pray for the situation you have carried in silence. Share your testimony with someone who needs courage. Let God turn your test into a message of hope for another person.'
    ];
    return {
      id: s[0],
      title: s[1],
      category: s[2],
      excerpt: s[3],
      readingTime: 4 + (i % 3),
      date: '2026-0' + ((i % 9) + 1) + '-18',
      author: i % 2 ? 'Prayer Dome Media Team' : 'Pastor Seedwell',
      image: i % 2 ? '/assets/testimonies/hero-praise.jpg' : '/assets/support/hero-support.jpg',
      body: par,
      lessonId: lessons[i % lessons.length].id,
      prompt: 'Ask: Where is God calling me to steady obedience instead of anxious waiting?'
    };
  });

  var resources = [
    {
      id: 'constitution',
      title: 'Prayer Dome Constitution',
      description: 'Core governance, purpose, beliefs, membership and leadership reference document.',
      category: 'Governance',
      format: 'MD',
      icon: 'fa-scale-balanced',
      size: '12 KB',
      version: '2026 edition',
      url: '/resource-view?file=/documents/prayer-dome-constitution.md&title=Prayer%20Dome%20Constitution',
      downloadUrl: '/documents/prayer-dome-constitution.md'
    },
    {
      id: 'statement-of-faith',
      title: 'Statement of Faith',
      description: 'A concise summary of what Prayer Dome believes and teaches.',
      category: 'Doctrine',
      format: 'MD',
      icon: 'fa-cross',
      size: '8 KB',
      version: '2026 edition',
      url: '/resource-view?file=/documents/statement-of-faith.md&title=Statement%20of%20Faith',
      downloadUrl: '/documents/statement-of-faith.md'
    },
    {
      id: 'new-believers-guide',
      title: 'New Believer’s Growth Guide',
      description: 'A practical guide for prayer, Bible reading, fellowship, baptism and service.',
      category: 'Discipleship',
      format: 'MD',
      icon: 'fa-seedling',
      size: '10 KB',
      version: '2026 edition',
      url: '/resource-view?file=/documents/new-believers-guide.md&title=New%20Believer%E2%80%99s%20Growth%20Guide',
      downloadUrl: '/documents/new-believers-guide.md'
    },
    {
      id: 'prayer-watch-guide',
      title: 'Prayer Watch Guide',
      description: 'Simple schedules, prayer points and safeguards for personal and corporate intercession.',
      category: 'Prayer',
      format: 'MD',
      icon: 'fa-moon',
      size: '9 KB',
      version: '2026 edition',
      url: '/resource-view?file=/documents/prayer-watch-guide.md&title=Prayer%20Watch%20Guide',
      downloadUrl: '/documents/prayer-watch-guide.md'
    },
    {
      id: 'serving-teams-handbook',
      title: 'Serving Teams Handbook',
      description: 'Expectations, values and practical guidance for ushers, media, worship, prayer and pastoral teams.',
      category: 'Ministry',
      format: 'MD',
      icon: 'fa-people-group',
      size: '11 KB',
      version: '2026 edition',
      url: '/resource-view?file=/documents/serving-teams-handbook.md&title=Serving%20Teams%20Handbook',
      downloadUrl: '/documents/serving-teams-handbook.md'
    },
    {
      id: 'small-group-guide',
      title: 'Small Group Discussion Guide',
      description: 'Lesson discussion format, reflection questions and outreach planning for groups.',
      category: 'Groups',
      format: 'MD',
      icon: 'fa-comments',
      size: '9 KB',
      version: '2026 edition',
      url: '/resource-view?file=/documents/small-group-guide.md&title=Small%20Group%20Discussion%20Guide',
      downloadUrl: '/documents/small-group-guide.md'
    }
  ];

  function questionForLesson(lesson, idx) {
    var banks = {
      foundations: [
        ['What does salvation come through?', 'Good works only', 'Grace through faith in Christ', 'Family tradition', 'Wealth', 1],
        ['Which passage says Scripture is God-breathed?', 'Psalm 23', '2 Timothy 3:16-17', 'Proverbs 3:5', 'Ruth 1:16', 1],
        ['Faith without works is described as what?', 'Powerful', 'Private', 'Dead', 'Enough', 2]
      ],
      prayer: [
        ['What did the disciples ask Jesus to teach them?', 'How to fast', 'How to pray', 'How to lead', 'How to give', 1],
        ['Where did Jesus pray before choosing the twelve?', 'In the temple', 'On a mountain all night', 'By the sea at noon', 'In a cave', 1],
        ['Biblical fasting should be done with what motive?', 'To be seen by people', 'To draw near to God', 'To force God', 'To replace love', 1]
      ],
      word: [
        ['What is the first step in the study method taught here?', 'Application only', 'Observation', 'Debate', 'Memory only', 1],
        ['Scripture is described as a what to our path?', 'Lamp', 'Wall', 'Shadow', 'Noise', 0],
        ['A testimony should mainly point to whom?', 'Ourselves', 'Jesus', 'A pastor only', 'Luck', 1]
      ],
      spirit: [
        ['Jesus called the Holy Spirit another what?', 'Lawgiver', 'Helper', 'Servant', 'Accuser', 1],
        ['Which list includes love, joy and peace?', 'Gifts of the Spirit', 'Fruit of the Spirit', 'Ten Commandments', 'Beatitudes only', 1],
        ['Spiritual gifts are given to do what?', 'Compete with others', 'Edify the church', 'Make people proud', 'Replace love', 1]
      ],
      character: [
        ['What should replace anxiety according to Philippians 4?', 'Silence only', 'Prayer and thanksgiving', 'Worry planning only', 'Isolation', 1],
        ['Faithfulness in little things leads to what?', 'Nothing important', 'Greater responsibility', 'Pride always', 'Secret sin', 1],
        ['How should believers treat one another according to Colossians 3?', 'Compete', 'Forgive', 'Avoid forever', 'Judge only', 1]
      ],
      mission: [
        ['The Great Commission tells believers to make what?', 'Money', 'Disciples', 'Buildings only', 'Rules only', 1],
        ['The church is described as one what with many members?', 'Army only', 'Body', 'Mountain', 'Business', 1],
        ['God loves what kind of giver?', 'Reluctant', 'Cheerful', 'Forced', 'Anonymous only', 1]
      ]
    };
    var base = banks[lesson.trackId][idx % 3];
    if (idx === 3) {
      return ['What should you do after studying this lesson?', 'Forget it quickly', 'Apply one action step', 'Compare yourself proudly', 'Keep it secret forever', 1];
    }
    if (idx === 4) {
      return ['What score is required to earn a lesson certificate?', '50% or higher', '60% or higher', '80% or higher', 'No score required', 2];
    }
    return base;
  }

  var quizzes = lessons.map(function (lesson) {
    var questions = [];
    for (var i = 0; i < 6; i++) questions.push(questionForLesson(lesson, i));
    return {
      id: 'quiz-' + lesson.id,
      lessonId: lesson.id,
      title: lesson.title,
      trackId: lesson.trackId,
      track: lesson.track,
      description: 'Check your understanding of “' + lesson.title + '.” Pass with 80% or higher to earn a certificate.',
      level: lesson.level,
      questions: questions,
      passingScore: 80
    };
  });

  W.PD_ACADEMY.DATA = {
    version: '2026.08.07',
    tracks: tracks,
    lessons: lessons,
    stories: stories,
    resources: resources,
    quizzes: quizzes
  };

  W.PD_ACADEMY.getTrack = function (id) {
    return tracks.filter(function (t) { return t.id === id; })[0] || null;
  };
  W.PD_ACADEMY.getLesson = function (id) {
    return lessons.filter(function (l) { return l.id === id; })[0] || null;
  };
  W.PD_ACADEMY.getQuiz = function (id) {
    return quizzes.filter(function (q) { return q.id === id; })[0] || null;
  };
  W.PD_ACADEMY.getStory = function (id) {
    return stories.filter(function (s) { return s.id === id; })[0] || null;
  };
})();
