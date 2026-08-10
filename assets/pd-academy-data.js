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

  var lessons = [
    {
      id: 'l01',
      trackId: 'foundations',
      track: 'Foundations',
      icon: 'fa-cross',
      color: 'blue',
      order: 1,
      level: 'Beginner',
      title: 'Salvation: A New Life in Christ',
      subtitle: 'From seeker to disciple',
      scripture: 'John 3:16',
      summary: 'Understand why salvation is by grace through faith and how to live as a new creation.',
      minutes: 12,
      objectives: ['Receive Christ, explain salvation, and begin daily obedience.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Every person who turns to Jesus enters a new identity that is not self-made but gifted. Salvation is not a reward for the well-behaved; it is rescue for the helpless. The Bible presents humanity as separated from God by sin, unable to bridge the distance through effort, tradition or moral improvement. Into that hopeless gap, God sent His Son — not as an example only, but as a substitute. The cross carries our guilt; the empty tomb secures our hope. To receive Christ is to receive a new life where past shame no longer defines you, present struggle no longer disqualifies you, and future glory is no longer uncertain.' },
        { heading: 'Biblical Foundation', body: 'John 3:16 concentrates the gospel into one sentence: God’s love, God’s gift, faith’s requirement and eternal life’s promise. God’s love is initiating — ‘God so loved the world.’ His gift is extreme — ‘He gave His only begotten Son.’ The condition is simple and deeply personal — ‘whosoever believeth in Him.’ The result is both rescue and gift — ‘should not perish, but have everlasting life.’ Parallel passages — Ephesians 2:8-10, Romans 5:8, 2 Corinthians 5:17 — confirm that salvation is by grace through faith, produced by Christ’s finished work, not our unfinished efforts.' },
        { heading: 'Key Teaching', body: 'Grace does not make obedience optional; it makes it possible. When you are born again, God writes His law on your heart, sends His Spirit to dwell in you, and adopts you into a family that teaches you to live as a child of God. Practically, this means three realities. First, assurance rests on Christ’s cross, not your emotional fluctuations. Second, transformation is progressive: old habits are unlearned slowly through renewal of the mind. Third, identity precedes behaviour — you do not serve to become accepted; you serve because you already are.' },
        { heading: 'Why It Matters Today', body: 'Many believers live as spiritual orphans despite being adopted. They carry condemnation into prayer, comparison into fellowship, and fear into tomorrow. This lesson corrects those patterns. When salvation is understood as a completed rescue, prayer shifts from bargaining to fellowship, giving shifts from guilt to gratitude, and holiness shifts from performance to love. In Zambia, Eswatini, Ireland and beyond, members who grasp this grace become steady witnesses — families notice the change before sermons explain it.' },
        { heading: 'Application', body: 'Settle your standing before God today. Write down the date and verse you first believed, share your three-sentence testimony with one person this week, and establish two non-negotiable rhythms: a daily five-minute conversation with God and one chapter of John each day for the next week. If you have not been baptised as a believer, speak to your pastor about the next baptism opportunity — baptism is the biblical first step of public obedience.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l01',
      nextLessonId: 'l02'
    },
    {
      id: 'l02',
      trackId: 'foundations',
      track: 'Foundations',
      icon: 'fa-cross',
      color: 'blue',
      order: 2,
      level: 'Beginner',
      title: 'The Bible: God’s Living Word',
      subtitle: 'A practical guide to Scripture',
      scripture: '2 Timothy 3:16-17',
      summary: 'See how the Bible is inspired, reliable and sufficient for life and ministry.',
      minutes: 17,
      objectives: ['Read, meditate and apply Scripture daily.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'We live in an age of competing voices — social media, tradition, opinion and experience all claim authority. The Bible claims a distinct kind of authority: it is God-breathed. That does not mean God dictated words mechanically, but that human authors, moved by the Holy Spirit, wrote exactly what God intended to communicate. The result is a book that is both fully human — reflecting language, history and personality — and fully divine — truthful, reliable and ever-relevant for teaching, correction and formation.' },
        { heading: 'Biblical Foundation', body: '2 Timothy 3:16-17 teaches that all Scripture is inspired and profitable — for doctrine, reproof, correction and training in righteousness — so that the servant of God may be equipped for every good work. Psalm 119 celebrates the Word as lamp, treasure and delight. Jesus Himself treated Scripture as the unbreakable Word of His Father. When He resisted the devil, He said, ‘It is written.’ When He corrected error, He pointed to what Scripture had spoken. The Bible’s authority rests on Christ’s endorsement as much as on its own claim.' },
        { heading: 'Key Teaching', body: 'Reliability and sufficiency are two pillars. Reliability means you can trust the Bible’s record of history, its depiction of God, and its promises for today. The manuscripts are exceptionally well-attested, the historical references check out, and the prophetic patterns find fulfilment in Christ. Sufficiency means you do not need new revelations equal to Scripture to live faithfully. God may guide through impressions, but those impressions are tested by and never override the Word. To honour Scripture, read it prayerfully, study it carefully, memorize it deliberately and obey it quickly.' },
        { heading: 'Why It Matters Today', body: 'Without a centred Word, groups drift. Without it, prayer becomes imagination. Without it, leadership becomes personality. A church that loves the Word becomes resilient when scandals, sufferings and shortages come, because its confidence rests not on charisma but on what is written. Members who handle the Bible wisely become able to teach their children, counsel their friends, resist deception and walk in wisdom when culture shifts.' },
        { heading: 'Application', body: 'Begin a sustainable plan today: one chapter a day from John, then Romans, then Psalms and Proverbs. Keep a journal with four columns — What does this teach me about God? About humanity? What should I obey? Who should I share with? Memorise one verse this week and rehearse it at work, in transit and before sleep. Choose one habit shaped by last week’s reading and adjust it by the Spirit’s help.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l02',
      nextLessonId: 'l03'
    },
    {
      id: 'l03',
      trackId: 'foundations',
      track: 'Foundations',
      icon: 'fa-cross',
      color: 'blue',
      order: 3,
      level: 'Beginner',
      title: 'Faith That Works',
      subtitle: 'Believing God in daily life',
      scripture: 'Hebrews 11:6',
      summary: 'Learn how faith comes, grows and produces action through trials and obedience.',
      minutes: 13,
      objectives: ['Respond to promises with confession, patience and works of faith.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Faith is often misunderstood as mere optimism or religious feeling. Biblical faith is confidence grounded in reliable testimony — specifically, what God has said and what He has shown Himself to be. It begins as hearing, grows as trusting, and becomes visible as action. Hebrews calls it the substance of things hoped for, the evidence of things not seen — not sightlessness but trust with good reasons.' },
        { heading: 'Biblical Foundation', body: 'Hebrews 11:6 states the necessity: without faith it is impossible to please God, for he that cometh to God must believe that He is and that He is a rewarder of those who diligently seek Him. Romans 10:17 explains the supply: faith comes by hearing, and hearing by the Word of God. James 2 shows the fruit: faith without works is dead because genuine confidence expresses itself in obedience. Abraham, the father of faith, illustrates this journey — hearing a promise, staggering at delay, yet obeying step by step.' },
        { heading: 'Key Teaching', body: 'Faith grows through three disciplines. First, confession — agreeing aloud with what God has said rather than only narrating what circumstances say. Second, patience — trusting God’s timing when harvest does not signal immediately. Third, obedience — taking the next revealed step without requiring the entire map. Trials are not failure; they are the gymnasium where trust becomes strength. God does not delay to frustrate but to form.' },
        { heading: 'Why It Matters Today', body: 'Anxieties about provision, health, family and future expose where our trust truly rests. This lesson helps believers move from panic to prayer, from complaint to thanksgiving, from control to surrender. When faith is nurtured in community, members learn to distinguish faith from presumption: faith is bold yet humble, specific yet submitted to God’s sovereignty. A church that practices faith becomes generous in lean seasons and calm in chaotic ones.' },
        { heading: 'Application', body: 'Identify one promise that addresses your current struggle and write it on a card to carry. Confess it morning and evening, thanking God for it as already true in Christ. Ask two mature believers to pray that promise over you, and decide one act of obedience that proves you believe God will keep His word — make a call, start a habit, or step into a responsibility you have postponed while waiting to ‘feel ready’.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l03',
      nextLessonId: 'l04'
    },
    {
      id: 'l04',
      trackId: 'prayer',
      track: 'Prayer & Intercession',
      icon: 'fa-hands-praying',
      color: 'gold',
      order: 4,
      level: 'Beginner',
      title: 'How to Pray with Confidence',
      subtitle: 'The Lord’s Prayer as a pattern',
      scripture: 'Matthew 6:9-13',
      summary: 'Move from awkward prayer to meaningful conversation with God.',
      minutes: 18,
      objectives: ['Use a simple pattern for personal and family prayer.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Prayer is not a performance for God but conversation with Him. Many believers feel awkward because they imagine they must impress Him with eloquence. Jesus gave a pattern not to script us but to shape us — moving us from self-conscious sentences to God-centred communion. When prayer becomes pattern, it becomes freedom rather than burden.' },
        { heading: 'Biblical Foundation', body: 'Matthew 6:9-13 is often called the Lord’s Prayer, but more accurately it is the disciples’ prayer. It opens with relational access — ‘Our Father which art in heaven’ — and reverent wonder — ‘Hallowed be Thy name.’ It then surrenders to God’s agenda — ‘Thy kingdom come, Thy will be done’ — before asking for daily bread, forgiveness, and protection. The order teaches dependency, reconciliation and trust. Jesus did not intend mere repetition but emulation of these priorities.' },
        { heading: 'Key Teaching', body: 'Six movements form a sustainable rhythm: praise for who God is, thanksgiving for what He has done, confession for what hinders fellowship, petition for personal needs, intercession for others, and stillness to listen through Scripture. Keep petitions concrete and time-bound so you can notice answers. Use Scripture as vocabulary — pray Psalms when you lack words, promises when you lack courage, and confessions when you lack humility. Short, regular prayers beat rare, marathon ones.' },
        { heading: 'Why It Matters Today', body: 'Without a pattern, prayer follows mood. With a pattern, prayer forms mood. Families who pray this way find children learn by imitation, marriages soften because forgiveness is practiced daily, and small groups gain unity because they ask for the same kingdom first. In a noisy digital environment, a simple, memorable pattern guards the quiet space where God speaks.' },
        { heading: 'Application', body: 'Tomorrow morning, pray through Matthew 6:9-13 slowly, spending two minutes on each phrase, journaling one sentence for each movement. Repeat the pattern in the evening with a family member or friend, asking them for one request to carry. Review your journal at the end of the week and mark one answered prayer with thanksgiving before the church.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l04',
      nextLessonId: 'l05'
    },
    {
      id: 'l05',
      trackId: 'prayer',
      track: 'Prayer & Intercession',
      icon: 'fa-hands-praying',
      color: 'gold',
      order: 5,
      level: 'Beginner',
      title: 'The Power of Night Prayer',
      subtitle: 'Watchfulness and intercession',
      scripture: 'Luke 6:12',
      summary: 'Discover why night seasons can be strategic for seeking God and standing in the gap.',
      minutes: 14,
      objectives: ['Build a sustainable prayer watch without condemnation.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Some of the most decisive moments in Jesus’ ministry happened at night. He withdrew before dawn to pray, spent all night before choosing the twelve, and was found in prayer at midnight before His arrest. Night is not more spiritual than day, but its silence, stillness and vulnerability can sharpen spiritual sensitivity. At Prayer Dome we treat night watches as invitation, not law — an opportunity to seek God when distractions sleep.' },
        { heading: 'Biblical Foundation', body: 'Luke 6:12 records that Jesus went out into a mountain to pray and continued all night in prayer to God. Acts 16 shows Paul and Silas praying and singing at midnight when prison gates opened. Psalm 134 celebrates those who ‘by night stand in the house of the LORD.’ These texts do not mandate sleeplessness; they model watchfulness — a church aware that spiritual realities are addressed on knees before they are seen in streets.' },
        { heading: 'Key Teaching', body: 'Watchfulness has practical safeguards. Begin with one consistent watch rather than sporadic all-nighters. Pray with Scripture, not speculation; plead the blood of Jesus, not personal intensity, as your confidence. Share the burden as a community so no few carry all. Balance zeal with wisdom — protect health, family and work. Keep a list of seven people and five church requests you cover each night you keep watch, and note encouragements you sense, testing them in community.' },
        { heading: 'Why It Matters Today', body: 'Suffering often isolates people at night. Job loss, illness, family strain and spiritual oppression feel heavier after midnight. A people who can pray by night become a people who can comfort by day. Churches in Zambia praying for rainfall, Eswatini praying for youth, Ireland praying for awakening — all learn that night prayer fuels day labour without requiring every member to keep every watch.' },
        { heading: 'Application', body: 'Choose one night this week to set an alarm thirty minutes earlier than usual. Use the six-movement pattern in lesson four, with emphasis on intercession for your household and church. If married or in a group, invite another to agree with you. The next morning, journal what you noticed in prayer and one practical step to serve the person you prayed for.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l05',
      nextLessonId: 'l06'
    },
    {
      id: 'l06',
      trackId: 'prayer',
      track: 'Prayer & Intercession',
      icon: 'fa-hands-praying',
      color: 'gold',
      order: 6,
      level: 'Beginner',
      title: 'Fasting and Spiritual Breakthrough',
      subtitle: 'Hunger that opens heaven',
      scripture: 'Matthew 6:16-18',
      summary: 'Learn the purpose, types and safeguards of biblical fasting.',
      minutes: 19,
      objectives: ['Plan a fast and pray with clear biblical motives.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Fasting is hunger chosen for a higher hunger. It declares that God is more necessary than bread, more satisfying than comfort, and more worthy than the attention fasting temporarily sets aside. In Scripture, fasting accompanies humility, repentance, guidance-seeking and intercession — never manipulation.' },
        { heading: 'Biblical Foundation', body: 'Matthew 6:16-18 places fasting beside giving and praying in the Sermon on the Mount. Jesus says ‘when ye fast,’ assuming His people will fast, but warns against doing it to be seen. He fasted forty days before His public ministry, as did Moses before Sinai and Elijah before Horeb. God promises nearness to the humble and merciful, not to the performative. Isaiah 58 shows fasting that truly pleases God looses bonds of wickedness and shares bread with the hungry.' },
        { heading: 'Key Teaching', body: 'Types are flexible: a meal, a day, an early-morning to evening abstention, a mono-diet, or abstention from non-food comforts like entertainment where food abstention is unwise. Motives must stay pure: not to impress, not to earn, not to replace obedience. Distinguish private fasts (personal) from corporate fasts (church-called). Break fasts wisely, protect health, and avoid fasting if medical conditions require regular food unless advised by a clinician. Use freed time and money to pray and to give.' },
        { heading: 'Why It Matters Today', body: 'Fast food, quick scrolling and constant acquisition dull spiritual sensitivity. Fasting retrains attention. It helps believers notice overlooked sins, hear quieter whispers of the Spirit, and realise how often they reach for comfort before counsel. Churches that fast together report softened hearts toward reconciliation, clarity about money, and courage toward mission.' },
        { heading: 'Application', body: 'Plan one simple fast this month: one meal once a week, devoted to prayer for a burdensome situation. Before you begin, write motive, passage, requests and how you will break the fast. During, journal temptations and insights. After, share one lesson and one answer with a trusted friend, and consider turning a portion of what you saved into generosity to someone in need.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l06',
      nextLessonId: 'l07'
    },
    {
      id: 'l07',
      trackId: 'word',
      track: 'The Word of God',
      icon: 'fa-book-bible',
      color: 'blue',
      order: 7,
      level: 'Growing',
      title: 'How to Study the Bible',
      subtitle: 'Observe, interpret, apply',
      scripture: 'Ezra 7:10',
      summary: 'Use a simple method that helps you understand context and obey truth.',
      minutes: 15,
      objectives: ['Study one passage and produce a personal application.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'God desires not only that we read Scripture, but that we be changed by it. Ezra the priest is commended because he set his heart to study the law of the LORD, to do it, and to teach it. That order — study, practice, teach — keeps us from becoming critics before we are disciples. A simple, repeatable method helps ordinary people handle Scripture with confidence.' },
        { heading: 'Biblical Foundation', body: 'Ezra 7:10 — ‘For Ezra had prepared his heart to seek the law of the LORD, and to do it, and to teach in Israel statutes and judgments.’ The verbs matter: seek with diligence, do with obedience, teach with credibility. Acts 17:11 commends the Bereans for examining Scriptures daily to test teaching. Psalm 1 promises fruitfulness for those who meditate day and night. The goal is not information accumulation but transformation through beholding Christ.' },
        { heading: 'Key Teaching', body: 'Use Observe — Interpret — Apply. Observe: What does the passage say? Who is speaking, to whom, when, where? What words repeat? What images or contrasts stand out? Interpret: What did it mean to first hearers, in context, genre and storyline? What does it teach about God, humanity, sin, grace, salvation, church and mission? Apply: What should I believe differently, stop, start, or share? Make it specific, measurable and accountable to another believer.' },
        { heading: 'Why It Matters Today', body: 'Shallow engagement produces shallow disciples. Quick devotionals divorced from context often misapply promises. A clear method protects against error, equips parents to teach children, helps small-group leaders facilitate without dominating, and creates a common language — ‘What did you observe?’ — that every member can use. Over months, ordinary people become trustworthy handlers of the Word.' },
        { heading: 'Application', body: 'Choose Mark 7:31-37 or Psalm 1 and apply Observe-Interpret-Apply on paper: write ten observations, three interpretive insights, and one applicational action with deadline and accountability partner. Bring your sheet to small group next week and compare learnings.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l07',
      nextLessonId: 'l08'
    },
    {
      id: 'l08',
      trackId: 'word',
      track: 'The Word of God',
      icon: 'fa-book-bible',
      color: 'blue',
      order: 8,
      level: 'Growing',
      title: 'Hearing God Through Scripture',
      subtitle: 'Wisdom for decisions',
      scripture: 'Psalm 119:105',
      summary: 'Learn how God guides through the Word, peace, counsel and circumstances.',
      minutes: 20,
      objectives: ['Test impressions by Scripture and wise counsel.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Every believer longs to say, ‘God led me.’ The New Testament promises guidance but frames it relationally: sheep hear a shepherd’s voice because they know Him. Guidance is less a technique to master and more a relationship to nurture. Scripture, the Spirit’s inner prompting, counsel of the mature, providence, and peace work together — not competitively — to show the next step.' },
        { heading: 'Biblical Foundation', body: 'Psalm 119:105 — ‘Thy word is a lamp unto my feet, and a light unto my path.’ 2 Corinthians 5:7 reminds us we walk by faith, not by sight. Acts 13 shows the church at Antioch worshipping, fasting, hearing the Spirit say, ‘Separate me Barnabas and Saul,’ and then sensing community confirmation. John 16 says the Spirit will guide into truth. No single factor alone carries absolute weight; corroboration matters.' },
        { heading: 'Key Teaching', body: 'Five lenses discern God’s will. Word: Does Scripture command, forbid or shape this? Spirit: Do you sense inner nudging, producing peace and not manipulation? Counsel: Do two or three mature believers who know your life confirm this? Providence: Are circumstances opening with faithfulness or force? Peace: Is there settled, Christ-anchored peace rather than mere relief? Test all impressions by Scripture’s authority, the body’s wisdom, and the fruit that emerges over time.' },
        { heading: 'Why It Matters Today', body: 'Anxiety often stems from decision-urgency without decision-clarity. This framework lowers pressure because it shifts the question from ‘Will I miss God?’ to ‘Am I walking with Him?’ In a media-saturated age where every direction claims divine endorsement, the biblically formed believer can distinguish the Shepherd’s voice from strangers.' },
        { heading: 'Application', body: 'Bring one current decision to the five lenses and write your findings. Choose the next faithful step, however small, and tell two trusted friends your commitment and deadline. Review after two weeks and adjust, keeping Scripture open and community close.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l08',
      nextLessonId: 'l09'
    },
    {
      id: 'l09',
      trackId: 'word',
      track: 'The Word of God',
      icon: 'fa-book-bible',
      color: 'blue',
      order: 9,
      level: 'Growing',
      title: 'Sharing Your Testimony',
      subtitle: 'Tell what God has done',
      scripture: 'Revelation 12:11',
      summary: 'Prepare a clear, humble story of grace that points people to Jesus.',
      minutes: 16,
      objectives: ['Write and share a three-minute testimony.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'The most powerful tool many believers possess is the quiet, credible story of what Jesus has done for them. No degree is needed to say, ‘I was blind, but now I see.’ Revelation declares that believers overcome by the blood of the Lamb and the word of their testimony — the Lamb supplies merit; the testimony supplies witness.' },
        { heading: 'Biblical Foundation', body: 'Revelation 12:11 — they overcame him by the blood of the Lamb and by the word of their testimony. Mark 5:19 shows Jesus sending the formerly possessed man home with the words, ‘Go home to thy friends, and tell them how great things the Lord hath done for thee.’ Acts 26 demonstrates Paul’s testimony as apologetic — before kings and governors he simply recounts his story, making the gospel personal and undeniable.' },
        { heading: 'Key Teaching', body: 'A clear testimony has three sentences: what your life was like before Christ (without exaggeration), how you met Christ (who, where, Scripture, prayer), and what Christ is doing now (a change, a habit, a hope). Keep it two to three minutes, Christ-centred, humble and hope-offering. Avoid jargon, avoid exploiting others’ stories, and end with a gentle invitation: ‘May I share more, or pray for you?’ Practise until it flows naturally.' },
        { heading: 'Why It Matters Today', body: 'People may debate arguments but they cannot easily dismiss a transformed life they witness daily. In families where one member follows Jesus first, a well-told story often opens doors that forceful debate would close. In community, testimony encourages the discouraged: one person’s story of God’s provision can sustain another’s faith for months.' },
        { heading: 'Application', body: 'Draft your testimony in 180 words and read it aloud to a friend for feedback. Practise delivering it in under three minutes. Pray for one person this week by name, look for a natural opening, and offer your story without pressure. Afterward, note their response and keep praying.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l09',
      nextLessonId: 'l10'
    },
    {
      id: 'l10',
      trackId: 'spirit',
      track: 'Holy Spirit & Gifts',
      icon: 'fa-fire',
      color: 'gold',
      order: 10,
      level: 'Growing',
      title: 'Who Is the Holy Spirit?',
      subtitle: 'The believer’s helper',
      scripture: 'John 14:16-17',
      summary: 'Understand the person, presence and work of the Holy Spirit.',
      minutes: 12,
      objectives: ['Welcome the Spirit’s leadership in daily life.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'The Holy Spirit is not an impersonal force to be used but a personal presence to be welcomed. Jesus called Him another Helper — like Himself — who would be with and in believers forever. To understand the Spirit is to understand how God stays close after Christ’s ascension and how the church remains empowered until His return.' },
        { heading: 'Biblical Foundation', body: 'John 14:16-17 — Jesus will pray the Father, and He shall give you another Comforter. Romans 8 testifies that the Spirit indwells, adopts (Abba, Father), sanctifies, intercedes when words fail, and assures of future glory. Acts 1:8 promises power for witness. The Spirit’s work is comprehensive: He convicts the lost, regenerates the believer, seals for the day of redemption, illuminates Scripture, and groans in prayer.' },
        { heading: 'Key Teaching', body: 'Three postures welcome Him. Worship: thank Him for His nearness. Dependence: ask Him to lead specific decisions and conversations. Surrender: yield areas of known resistance — speech, money, sexuality, bitterness — rather than compartmentalising Him. He is holy, so holiness matters; He is gentle, so hostility grieves Him; He is truthful, so truth-telling honours Him. Guidance is seldom spectacular; it is often a quiet inclination aligned with Scripture and confirmed by community.' },
        { heading: 'Why It Matters Today', body: 'Burnout, cynicism and moral fatigue often reflect self-reliance rather than Spirit-dependence. Leaders who practise regular acknowledgement of the Spirit find endurance that discipline alone cannot supply. Prayer watches continue because the Spirit sustains; reconciliation occurs because the Spirit softens; Scripture comes alive because the Spirit illuminates.' },
        { heading: 'Application', body: 'For the next seven days, begin each morning with five minutes of silence: ‘Holy Spirit, I welcome You. Teach me, fill me, and form Christ in me. Lead my speech and stewardship today.’ Journal one guidance or conviction you sense and test it with a mature believer before acting.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l10',
      nextLessonId: 'l11'
    },
    {
      id: 'l11',
      trackId: 'spirit',
      track: 'Holy Spirit & Gifts',
      icon: 'fa-fire',
      color: 'gold',
      order: 11,
      level: 'Growing',
      title: 'The Fruit of the Spirit',
      subtitle: 'Character before gifting',
      scripture: 'Galatians 5:22-23',
      summary: 'Grow in love, joy, peace, patience, kindness, goodness, faithfulness, gentleness and self-control.',
      minutes: 17,
      objectives: ['Identify one fruit to practice in relationships.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Character is the fruit that proves the root is alive. Galatians contrasts fruit of the Spirit with works of the flesh — not to shame but to give diagnosis. Fruit grows organically, not mechanically. It is cultivated through abiding, not achieved through striving. God is not looking for impressive gifts only, but for a transformed nature that makes gifts trustworthy.' },
        { heading: 'Biblical Foundation', body: 'Galatians 5:22-23 lists nine facets of one fruit: love, joy, peace, patience, kindness, goodness, faithfulness, gentleness and self-control. Against such there is no law — character needs no legislation. This fruit mirrors Christ’s character: love that serves enemies, joy that survives loss, peace that guards heart and mind, patience that bears long, kindness that initiates good, goodness that does what is right when unseen, faithfulness that keeps promises, gentleness that restrains power, self-control that masters desires.' },
        { heading: 'Key Teaching', body: 'Growth is both crisis and process. Pruning seasons — disappointment, delay, correction — accelerate formation if yielded to. Practically, choose one fruit to practise for a month. If love, initiate an act of love before being asked. If peace, establish a time-bound worry window, then return concerns to God. Invite one friend to ask you weekly about progress, keeping feedback honest and grace-filled.' },
        { heading: 'Why It Matters Today', body: 'Gifting without character impresses temporarily but wounds eventually. Families, teams and churches flourish where character is visibly forming. Children imitate what they see more than what they hear. A church where self-control is growing becomes safe for the vulnerable, generous with money, and steady under criticism.' },
        { heading: 'Application', body: 'Ask two people who know you well: ‘Which fruit do you see growing in me, and which seems weakest?’ Choose the weakest for the next thirty days, design one daily practice, and review weekly with your small group. Thank God for one example where the Spirit enabled a response you once could not manage.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l11',
      nextLessonId: 'l12'
    },
    {
      id: 'l12',
      trackId: 'spirit',
      track: 'Holy Spirit & Gifts',
      icon: 'fa-fire',
      color: 'gold',
      order: 12,
      level: 'Growing',
      title: 'Using Spiritual Gifts Wisely',
      subtitle: 'Serve the body in love',
      scripture: '1 Corinthians 12:7',
      summary: 'Discover how gifts edify the church and must operate with order and humility.',
      minutes: 13,
      objectives: ['Serve in one gift area and ask for feedback.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Spiritual gifts are grace deposits for the good of others, not badges of superiority. They are the Spirit’s equipment given to each believer as He wills, so that the body is built up and the world is loved more effectively. The New Testament repeatedly says gifts must operate in love, order and humility.' },
        { heading: 'Biblical Foundation', body: '1 Corinthians 12:7 — the manifestation of the Spirit is given to every man to profit withal. Romans 12, Ephesians 4 and 1 Peter 4 describe diversity — prophecy, service, teaching, encouragement, giving, leadership, mercy, healing, tongues and interpretation, among others — yet unity. Gifts are for edification, equipping and service. Disorder, self-promotion and division are signs that gifts are being abused, however impressive they appear.' },
        { heading: 'Key Teaching', body: 'Discovery involves desire, experimentation, evaluation and confirmation. Desire the gifts, especially that you may excel in edifying the church. Experiment by serving in different roles. Evaluate fruit — are people strengthened, comforted and brought closer to Jesus? Seek confirmation from trusted leaders. Orderly practice includes preparation, accountability, testing of prophetic impressions by Scripture and community, and refusal to pressure people to respond. Love is the checklist: is this kind, humble, patient and for the other’s good?' },
        { heading: 'Why It Matters Today', body: 'Churches that suppress gifts become dry; churches that disorder gifts become distrustful. Healthy churches chart a middle way: eager yet ordered. When gifts function humbly, the church becomes more like a household where each member knows their part and the whole body grows. Service becomes joyful because people serve according to design, not duty alone.' },
        { heading: 'Application', body: 'Take one month to serve in an area you suspect matches your gift — hospitality, teaching, mercy, giving, leading, worship or prayer. Ask your team lead for feedback at the month’s end: ‘Did my service build others up, and did love lead?’ Adjust, remain, or try another area with docility.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l12',
      nextLessonId: 'l13'
    },
    {
      id: 'l13',
      trackId: 'character',
      track: 'Christlike Character',
      icon: 'fa-heart',
      color: 'blue',
      order: 13,
      level: 'Leader',
      title: 'Overcoming Fear and Anxiety',
      subtitle: 'Peace under pressure',
      scripture: 'Philippians 4:6-7',
      summary: 'Replace worry with prayer, truth, thanksgiving and godly action.',
      minutes: 18,
      objectives: ['Create a personal peace plan for anxious moments.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Anxiety rarely obeys logic. You can know God is in control and still feel the chest tighten. The Bible does not dismiss such experiences as failure but addresses them as formation opportunities. Philippians invites the anxious not to try harder to calm themselves, but to bring everything to a God who keeps hearts and minds through peace that surpasses understanding.' },
        { heading: 'Biblical Foundation', body: 'Philippians 4:6-7 — ‘Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.’ The context is relational tension and missionary pressure, not ideal calm. The prescription is comprehensive: prayer (general communion), supplication (specific requests), thanksgiving (remembrance of goodness)' },
        { heading: 'Key Teaching', body: 'A personal peace plan helps when anxiety spikes. First, breathe and pray Scripture aloud — Psalm 46, Isaiah 41:10, or Matthew 11:28. Second, write the worry as a request with a date, then thank God for one past provision. Third, choose an action within your control — a call to make, a habit to adjust — and limit rehearsing what you cannot control to a brief, time-bound window. Fourth, invite a brother or sister to pray agreement over the matter within twenty-four hours.' },
        { heading: 'Why It Matters Today', body: 'Children and youth report record anxieties, workers face economic strain, and families navigate uncertainty. A church that models honest disclosure, Scripture meditation and community prayer becomes a non-anxious presence in a reactive world. Small groups that normalise brief, specific prayer for anxiety become refuges where people learn peace by practice, not only by concept.' },
        { heading: 'Application', body: 'Draft a half-page peace plan today: your go-to Scriptures, a prayer pattern, a thanksgiving list, a trusted person to call, and one healthy action for when anxiety rises. Share it with your small group and revise after using it once. Memorise Philippians 4:6-7 this month.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l13',
      nextLessonId: 'l14'
    },
    {
      id: 'l14',
      trackId: 'character',
      track: 'Christlike Character',
      icon: 'fa-heart',
      color: 'blue',
      order: 14,
      level: 'Leader',
      title: 'Integrity and Stewardship',
      subtitle: 'Faithful in little and much',
      scripture: 'Luke 16:10',
      summary: 'Serve God faithfully with money, time, words, relationships and influence.',
      minutes: 14,
      objectives: ['Set stewardship goals in finances, time and speech.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Integrity is faithfulness in the hidden places when no audience applauds. Stewardship is the conviction that everything we have — money, time, words, relationships and influence — belongs ultimately to God, entrusted to us to manage for His glory and others’ good. Luke says faithfulness in little qualifies for greater trust.' },
        { heading: 'Biblical Foundation', body: 'Luke 16:10 — ‘He that is faithful in that which is least is faithful also in much.’ 1 Corinthians 4:2 declares it is required in stewards that a man be found faithful. Proverbs connects wise stewardship with provision, dishonest gain with poverty. Jesus taught generosity, contentment and accounting: the parable of the talents underscores that God expects fruit from what He entrusts, and the widow’s mite shows He measures sacrifice, not just size.' },
        { heading: 'Key Teaching', body: 'Money reveals heart. Practise first-fruits generosity, live within means, avoid debt that entangles, keep truthful accounts and avoid get-rich-quick schemes. Time reveals priorities. Keep Sabbath, honour appointments, limit distraction, and invest in people over mere productivity. Words reveal character. Let your yes be yes, speak truth in love, refuse gossip, and use your voice to encourage. Relationships reveal maturity. Honour marriage, protect purity, forgive debts, and use influence to lift not leverage others.' },
        { heading: 'Why It Matters Today', body: 'Church health is often stewardship health. Financial secrecy, time mismanagement and word failures erode trust faster than doctrinal disputes. When members steward well, families stabilise, poverty is softened through generosity, and leaders gain credibility that serves the gospel. Integrity becomes the quiet sermon that makes evangelism believable.' },
        { heading: 'Application', body: 'Set three measurable goals for the next thirty days: a financial goal (percentage to give, debt to reduce), a time goal (consistent quiet time, on-time attendance), and a speech goal (no complaint day once a week). Review weekly with an accountable friend and record fruit.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l14',
      nextLessonId: 'l15'
    },
    {
      id: 'l15',
      trackId: 'character',
      track: 'Christlike Character',
      icon: 'fa-heart',
      color: 'blue',
      order: 15,
      level: 'Leader',
      title: 'Forgiveness and Healthy Relationships',
      subtitle: 'Freedom through grace',
      scripture: 'Colossians 3:13',
      summary: 'Understand forgiveness, boundaries, reconciliation and love in community.',
      minutes: 19,
      objectives: ['Take one step toward healing a relationship.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Every community, including the church, experiences hurt. Words wound, expectations disappoint, and sometimes harm is profound. Forgiveness does not excuse wrong, erase memory or always restore trust instantly, but it does release the offender to God, refuse to nurse vengeance, and open a path toward healing — whether or not full reconciliation is immediately possible.' },
        { heading: 'Biblical Foundation', body: 'Colossians 3:13 — forbearing one another and forgiving one another, if any man have a quarrel against any: even as Christ forgave you, so also do ye. Ephesians 4 teaches to speak truth in love, keep unity, and put away bitterness. Matthew 18 outlines a gracious but firm process: speak privately, bring a witness if needed, and involve the church if restoration requires it. Throughout, truth and grace stay married.' },
        { heading: 'Key Teaching', body: 'Forgiveness is a decision that precedes healing. Choose to forgive as Christ forgave you — freely, though not without cost to Him. Then practise a process: name the wound, grieve it honestly before God and a trustworthy guide, set wise boundaries that protect without punishing, and, where appropriate, pursue reconciliation through listening, confession and restitution. Reconciliation requires repentance from the offender and rebuilt trust over time; forgiveness can be offered unilaterally, but reconciliation takes two.' },
        { heading: 'Why It Matters Today', body: 'Unforgiveness poisons worship, fractures families and suffocates mission. Members who learn to forgive become peacemakers in homes where quarrels have simmered for years, in workplaces where favouritism wounded, and in churches where conflict calcified. Small groups that practise forgiveness become communities where people can be honest without fearing exile.' },
        { heading: 'Application', body: 'Prayerfully name one relationship where resentment lingers. Write what happened, what you lost and what you choose today before God. If safe, take one step: a brief message, a mediation request, or a conversation guided by a mature believer. Commit to pray for the other person daily for one week, asking God to bless them as you would wish to be blessed.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l15',
      nextLessonId: 'l16'
    },
    {
      id: 'l16',
      trackId: 'mission',
      track: 'Mission & Service',
      icon: 'fa-globe-africa',
      color: 'gold',
      order: 16,
      level: 'Leader',
      title: 'Evangelism Made Simple',
      subtitle: 'Share Jesus naturally',
      scripture: 'Matthew 28:19-20',
      summary: 'Learn practical ways to start spiritual conversations and explain the gospel.',
      minutes: 15,
      objectives: ['Pray for one person and share Christ this week.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Jesus left His church with a commission that feels both intimate and immense: make disciples of all nations. The scope is global, but the method is ordinary — ordinary believers, in ordinary places, introducing ordinary conversations about an extraordinary Saviour. Evangelism is not the work of a gifted few; it is the privilege of every witness.' },
        { heading: 'Biblical Foundation', body: 'Matthew 28:19-20 — Go therefore and teach all nations, baptizing them in the name of the Father and of the Son and of the Holy Ghost. Acts 1:8 adds geography: Jerusalem, Judea, Samaria and the uttermost parts. Romans 10:14 reminds us faith comes by hearing. The gospel is specific: Christ died, was buried, rose, and offers forgiveness and eternal life to all who repent and believe. The method is gracious: speak with gentleness and reverence, season words with salt, and let good deeds adorn the message.' },
        { heading: 'Key Teaching', body: 'Simple rhythms help. Pray daily for three people by name — a personal ‘three.’ Cultivate friendship before demanding answers: share meals, ask good questions, listen well. Look for providential openings — a crisis, a curiosity, a celebration — and ask, ‘Would you like to hear what helps me in such moments?’ Use a short outline: God loves, humanity fell, Christ came, response invited. Always invite a response, but never coerce; conversion belongs to the Lord.' },
        { heading: 'Why It Matters Today', body: 'In pluralistic societies, many believers retreat into silence for fear of offence, while others argue combatively and repel. This lesson charts a middle way: convictional kindness. In Zambia, where faith is widely professed, the need is depth; in Eswatini, where tradition runs deep, the need is clarity; in Ireland, where secularism rises, the need is gentle, persistent presence. Each context requires listening before speaking.' },
        { heading: 'Application', body: 'List three people you see regularly who do not yet profess Christ. Pray for them daily by name for the next seven days, look for one act of kindness toward each, and prepare your three-sentence testimony. Ask God for one opportunity this week to share it, and after, record what you learned for your small group.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l16',
      nextLessonId: 'l17'
    },
    {
      id: 'l17',
      trackId: 'mission',
      track: 'Mission & Service',
      icon: 'fa-globe-africa',
      color: 'gold',
      order: 17,
      level: 'Leader',
      title: 'Serving in the Local Church',
      subtitle: 'Every member has a part',
      scripture: '1 Corinthians 12:12-27',
      summary: 'Discover why serving is not optional for healthy discipleship.',
      minutes: 20,
      objectives: ['Choose a team or ministry to support.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'The New Testament never imagines a healthy Christian detached from a local church. Salvation places believers into a body, and each body needs every member. Paul’s image is anatomical: eyes, hands and feet each essential, each dependent. To be part of the body is to belong, to serve, to submit to one another out of reverence for Christ, and to guard the unity of the Spirit.' },
        { heading: 'Biblical Foundation', body: '1 Corinthians 12:12-27 teaches that God arranged members as He willed, with diversity for functionality. Romans 12 describes members differing according to the grace given us, called to use gifts to serve the whole. Hebrews 10:24-25 exhorts not to forsake assembling but to provoke one another to love and good works. Ephesians 4 shows mature churches equipping saints for works of service, so that the body builds itself up in love.' },
        { heading: 'Key Teaching', body: 'Every member matters. Discovery comes through serving, not only surveying gifts. Experiment in a team for a season, receive feedback, and iterate. Commitment matters: membership is covenant, not consumption — saying ‘I belong here, I give here, I am accountable here.’ Submission matters: honouring pastoral oversight, receiving correction, and resolving conflict according to Matthew 18. Multiplication matters: train others as you have been trained.' },
        { heading: 'Why It Matters Today', body: 'Consumer spirituality is fragile: when preferences are not met, people leave. Body life roots people: when hardship hits, they are carried. Members who serve in a team report stronger faith, deeper friendships and greater resilience than those who merely attend. Serving teams also become evangelistic front doors: welcoming and hospitality ministry may be the first impression that opens a seeker’s heart to the sermon.' },
        { heading: 'Application', body: 'Choose one team — prayer, hospitality, media/tech, worship, children/youth, follow-up or administration — and commit to serve on it weekly for the next three months. Attend the next team huddle, complete the Serving Teams Handbook reading, and identify one apprentice behind you to invest in by the quarter’s end.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l17',
      nextLessonId: 'l18'
    },
    {
      id: 'l18',
      trackId: 'mission',
      track: 'Mission & Service',
      icon: 'fa-globe-africa',
      color: 'gold',
      order: 18,
      level: 'Leader',
      title: 'Generosity and Kingdom Giving',
      subtitle: 'Heart, habit and harvest',
      scripture: '2 Corinthians 9:7',
      summary: 'Grow in cheerful, sacrificial and intentional generosity.',
      minutes: 16,
      objectives: ['Create a giving plan and support gospel work.', 'Connect the teaching to everyday life.', 'Prepare to pass the linked quiz and apply one action step.'],
      openingPrayer: 'Lord Jesus, open my eyes to see wonderful things in Your Word. Teach me, change me, and use me for Your glory. In Jesus’ name, amen.',
      sections: [
        { heading: 'Introduction', body: 'Money is one of the clearest spiritual thermometers: where your treasure is, there your heart will be. The gospel does not demonize possessions, but it does relativize them. Generosity is not an extra for the especially zealous; it is normal Christianity — a joyful, intentional participation in God’s mission. 2 Corinthians warns that principles matter: the cheerful giver trusts the God who supplies seed to the sower and bread for food.' },
        { heading: 'Biblical Foundation', body: '2 Corinthians 9:6-8 — God loves a cheerful giver; He who supplies seed and bread will enlarge the harvest of your righteousness, so that you may abound in every good work. 1 Timothy 6 teaches contentment with food and clothing, warning that the love of money pierces people with many sorrows. Malachi 3 invites testing: bring the tithe, see if God will not open windows of heaven. Acts 2 demonstrates radical sharing where need existed, not as legislation but as Spirit-prompted love.' },
        { heading: 'Key Teaching', body: 'Three movements shape a healthy giving life. Heart: see giving as worship — gratitude for grace, not guilt for obligation. Habit: plan proportionally, regularly and proportionate to income, with first-fruits priority rather than leftovers. Harvest: expect God to produce righteousness, joy, provision and gospel advance beyond what can be calculated. Keep records, give discreetly, avoid manipulation, and celebrate joy instead of coerced totals. Leaders model with transparency and accountability.' },
        { heading: 'Why It Matters Today', body: 'Economic pressures tempt contraction. Housing, education, health and transport consume budgets across all three nations. A formed giver learns that generosity is not the enemy of family care but its expression — teaching children that security rests in God, not only in savings. Churches that teach generosity well see members grow in contentment and the mission gains resources for printing, feeding, broadcasting and mercy.' },
        { heading: 'Application', body: 'Create a giving plan this month: decide a percentage to give, automate it if possible, and allocate a portion for kingdom work beyond routine support. Choose one additional act of generosity — a meal, school support, or blessing to someone who cannot repay — and do it within the next fourteen days. Review with a trusted mature friend or leader for wisdom.' }
      ],
      reflection: [
        'What verse or phrase stood out most, and why?',
        'What has stopped you from applying this truth in the past?',
        'What is the Holy Spirit asking you to believe, stop, start, or share?',
        'Who can help you remain accountable this week?'
      ],
      action: 'Complete the lesson summary in your own words, then take the linked quiz. If you pass with 80% or higher, download your certificate and continue to the next lesson in the track.',
      quizId: 'quiz-l18',
      nextLessonId: null
    }
  ];

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
      id: 'statement-of-faith',
      title: 'Prayer Dome Statement of Faith',
      description: 'A concise summary of what Prayer Dome believes and teaches.',
      category: 'Doctrine',
      format: 'PDF',
      icon: 'fa-cross',
      size: '167 KB',
      version: '2026 edition',
      url: '/documents/statement-of-faith.pdf',
      downloadUrl: '/documents/statement-of-faith.pdf'
    },
    {
      id: 'new-believers-guide',
      title: 'New Believer’s Growth Guide',
      description: 'A practical guide for prayer, Bible reading, fellowship, baptism and service.',
      category: 'Discipleship',
      format: 'PDF',
      icon: 'fa-seedling',
      size: '167 KB',
      version: '2026 edition',
      url: '/documents/new-believers-guide.pdf',
      downloadUrl: '/documents/new-believers-guide.pdf'
    },
    {
      id: 'prayer-watch-guide',
      title: 'Prayer Watch Guide',
      description: 'Simple schedules, prayer points and safeguards for personal and corporate intercession.',
      category: 'Prayer',
      format: 'PDF',
      icon: 'fa-moon',
      size: '165 KB',
      version: '2026 edition',
      url: '/documents/prayer-watch-guide.pdf',
      downloadUrl: '/documents/prayer-watch-guide.pdf'
    },
    {
      id: 'serving-teams-handbook',
      title: 'Serving Teams Handbook',
      description: 'Expectations, values and practical guidance for ushers, media, worship, prayer and pastoral teams.',
      category: 'Ministry',
      format: 'PDF',
      icon: 'fa-people-group',
      size: '168 KB',
      version: '2026 edition',
      url: '/documents/serving-teams-handbook.pdf',
      downloadUrl: '/documents/serving-teams-handbook.pdf'
    },
    {
      id: 'small-group-guide',
      title: 'Small Group Discussion Guide',
      description: 'Lesson discussion format, reflection questions and outreach planning for groups.',
      category: 'Groups',
      format: 'PDF',
      icon: 'fa-comments',
      size: '168 KB',
      version: '2026 edition',
      url: '/documents/small-group-guide.pdf',
      downloadUrl: '/documents/small-group-guide.pdf'
    },
    {
      id: 'user-guide',
      title: 'Prayer Dome App User Guide',
      description: 'A friendly walkthrough of every feature: prayer wall, Bible, sermons, live services and more.',
      category: 'App Guide',
      format: 'PDF',
      icon: 'fa-mobile-screen',
      size: '172 KB',
      version: '2026 edition',
      url: '/Prayer-Dome-User-Guide.pdf',
      downloadUrl: '/Prayer-Dome-User-Guide.pdf'
    }
  ];

  function questionForLesson(lesson, idx) {
    var banks = {
      foundations: [
        ['What does salvation come through?', 'Good works only', 'Grace through faith in Christ', 'Family tradition', 'Wealth', 1],
        ['Which passage says Scripture is God-breathed?', 'Psalm 23', '2 Timothy 3:16-17', 'Proverbs 3:5', 'Ruth 1:16', 1],
        ['Faith without works is described as what?', 'Powerful', 'Private', 'Dead', 'Enough', 2],
        ['Repentance means what?', 'Doing more good works', 'Turning away from sin and back to God', 'Feeling guilty forever', 'Perfect behaviour', 1],
        ['What helps us grow closer to God day by day?', 'Reading His Word and praying', 'Church attendance only', 'Following trends', 'Nothing at all', 0],
        ['According to Hebrews 11, faith is confidence in what?', 'What we can see', 'What we hope for', 'What others say', 'Our own feelings', 1]
      ],
      prayer: [
        ['What did the disciples ask Jesus to teach them?', 'How to fast', 'How to pray', 'How to lead', 'How to give', 1],
        ['Where did Jesus pray before choosing the twelve?', 'In the temple', 'On a mountain all night', 'By the sea at noon', 'In a cave', 1],
        ['Biblical fasting should be done with what motive?', 'To be seen by people', 'To draw near to God', 'To force God', 'To replace love', 1],
        ['Jesus taught His disciples to pray for what daily?', 'Daily bread', 'Wealth', 'Fame', 'Safety only', 0],
        ['Where does Jesus encourage private prayer?', 'In the marketplace', 'In your room', 'On the street corner', 'Only in church', 1],
        ['Praying in the Spirit is guided by whom?', 'Our own effort', 'The Holy Spirit', 'Angels only', 'Emotions alone', 1]
      ],
      word: [
        ['What is the first step in the study method taught here?', 'Application only', 'Observation', 'Debate', 'Memory only', 1],
        ['Scripture is described as a what to our path?', 'Lamp', 'Wall', 'Shadow', 'Noise', 0],
        ['A testimony should mainly point to whom?', 'Ourselves', 'Jesus', 'A pastor only', 'Luck', 1],
        ['The Bible is inspired by whom?', 'Church leaders', 'God through the Holy Spirit', 'Poets only', 'Kings', 1],
        ['Meditating on Scripture means doing what?', 'Forgetting it quickly', 'Chewing it over in the heart', 'Reading it once', 'Criticizing it', 1],
        ['A disciple lets God’s Word do what?', 'Remain unused', 'Transform their life', 'Stay theoretical', 'Bring pride', 1]
      ],
      spirit: [
        ['Jesus called the Holy Spirit another what?', 'Lawgiver', 'Helper', 'Servant', 'Accuser', 1],
        ['Which list includes love, joy and peace?', 'Gifts of the Spirit', 'Fruit of the Spirit', 'Ten Commandments', 'Beatitudes only', 1],
        ['Spiritual gifts are given to do what?', 'Compete with others', 'Edify the church', 'Make people proud', 'Replace love', 1],
        ['Who baptizes believers in the Holy Spirit?', 'A pastor only', 'Jesus', 'The believer', 'An angel', 1],
        ['What does the Spirit of truth do?', 'Guides us into all truth', 'Hides the truth', 'Confuses us', 'Speaks only to prophets', 0],
        ['How is the fruit of the Spirit produced?', 'By self-effort', 'By abiding in Christ', 'By imitation only', 'Instantly', 1]
      ],
      character: [
        ['What should replace anxiety according to Philippians 4?', 'Silence only', 'Prayer and thanksgiving', 'Worry planning only', 'Isolation', 1],
        ['Faithfulness in little things leads to what?', 'Nothing important', 'Greater responsibility', 'Pride always', 'Secret sin', 1],
        ['How should believers treat one another according to Colossians 3?', 'Compete', 'Forgive', 'Avoid forever', 'Judge only', 1],
        ['The greatest virtue, according to 1 Corinthians 13, is what?', 'Faith', 'Love', 'Knowledge', 'Talent', 1],
        ['Humility means what?', 'Thinking less of yourself', 'Depending on God and esteeming others', 'Weakness', 'Silence always', 1],
        ['Growing in character involves doing what?', 'Reaching instant perfection', 'Yielding daily to the Spirit', 'Isolating from others', 'Never failing', 1]
      ],
      mission: [
        ['The Great Commission tells believers to make what?', 'Money', 'Disciples', 'Buildings only', 'Rules only', 1],
        ['The church is described as one what with many members?', 'Army only', 'Body', 'Mountain', 'Business', 1],
        ['God loves what kind of giver?', 'Reluctant', 'Cheerful', 'Forced', 'Anonymous only', 1],
        ['Sharing the gospel with others is often called what?', 'Evangelism', 'Entertainment', 'Business', 'Politics', 0],
        ['Serving others is modelled on whom?', 'Famous leaders', 'Jesus, who came to serve', 'Only the clergy', 'Our own gain', 1],
        ['A good steward uses their gifts to do what?', 'Serve God and others', 'Build their own fame', 'Hide them', 'Compare with others', 1]
      ]
    };
    return banks[lesson.trackId][idx];
  }

  var quizzes = lessons.map(function (lesson) {
    var questions = [];
    // 6 subject questions drawn from the expanded bank (see questionForLesson).
    for (var i = 0; i < 6; i++) questions.push(questionForLesson(lesson, i));
    // 2 shared reflection questions. The full pool is kept so that every
    // attempt can present a different random set of questions.
    questions.push(['What should you do after studying this lesson?', 'Forget it quickly', 'Apply one action step', 'Compare yourself proudly', 'Keep it secret forever', 1]);
    questions.push(['What score is required to earn a lesson certificate?', '50% or higher', '60% or higher', '80% or higher', 'No score required', 2]);
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
