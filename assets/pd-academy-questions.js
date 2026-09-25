/* ==========================================================================
   Prayer Dome Academy — Expanded Question Banks
   --------------------------------------------------------------------------
   Augments pd-academy-data.js with a 30-question pool per lesson and an
   18-question pool per track. Loaded after pd-academy-data.js and before
   pd-academy.js. Keeps the main data file readable while giving every quiz
   the variety modern e-learning platforms expect: each attempt picks a
   different random subset, and answer options are shuffled each time, so
   students cannot memorise positions.
   ========================================================================== */

(function () {
  'use strict';
  if (!window.PD_ACADEMY || !window.PD_ACADEMY.DATA) return;
  var DATA = window.PD_ACADEMY.DATA;

  // Each entry: [prompt, optA, optB, optC, optD, correctIdx]
  // correctIdx is 0..3 inclusive. The renderer shuffles options at runtime.
  var TRACK_BANK = {
    foundations: [
      ['What is the gospel in one sentence?', 'God loves the world and gave His Son so whoever believes has eternal life', 'Be a good person', 'Attend church every Sunday', 'Read the Bible in one year', 0],
      ['Who wrote most of the New Testament letters?', 'Paul', 'Peter', 'John', 'James', 0],
      ['Which verse says the Bible is God-breathed?', '2 Timothy 3:16', 'Psalm 23:1', 'John 3:16', 'Romans 8:28', 0],
      ['Faith without works is described in James 2 as what?', 'Dead', 'Strong', 'Complete', 'Enough', 0],
      ['What is the result of genuine saving faith?', 'A transformed life', 'Automatic perfection', 'Wealth', 'No change', 0],
      ['How is salvation received, according to Ephesians 2:8-9?', 'By grace through faith', 'By good works', 'By church membership', 'By speaking in tongues', 0],
      ['The clearest single verse on God\'s love is…', 'John 3:16', 'Proverbs 3:5', 'Psalm 1:1', 'Genesis 1:1', 0],
      ['A disciple is someone who…', 'Believes, obeys and teaches others', 'Only reads the Bible', 'Avoids suffering', 'Knows theology', 0],
      ['What does repentance involve?', 'Turning from sin toward God', 'Doing more rituals', 'Feeling sorry only', 'Paying fines', 0],
      ['The Trinity refers to…', 'Father, Son and Holy Spirit', 'Three churches', 'Three apostles', 'Three gospels', 0],
      ['Who is the Holy Spirit to a believer?', 'Helper, Teacher and Comforter', 'A feeling only', 'An angel', 'An impersonal force', 0],
      ['Which chapter is called the love chapter?', '1 Corinthians 13', 'Romans 8', 'Psalm 119', 'John 14', 0],
      ['The Bible\'s authority rests ultimately on…', 'Christ\'s endorsement of it', 'Popular votes', 'Family tradition', 'Cultural trends', 0],
      ['A healthy believer practices regular…', 'Bible reading, prayer and fellowship', 'Only fasting', 'Only preaching', 'Only singing', 0],
      ['Justification means…', 'Declared righteous in Christ', 'Made perfectly sinless now', 'Forgotten by God', 'Elevated to angel', 0],
      ['Sanctification is the process of…', 'Becoming more like Christ', 'Instant perfection', 'Avoiding all hardship', 'Hiding sins', 0],
      ['Which book contains the Ten Commandments given to Moses?', 'Exodus 20', 'Genesis 1', 'Judges 4', 'Acts 2', 0],
      ['Biblical hope is…', 'A confident expectation rooted in God\'s promises', 'Wishful thinking', 'Optimism only', 'A guess', 0]
    ],
    prayer: [
      ['What did the disciples ask Jesus to teach them?', 'How to pray', 'How to fast', 'How to lead', 'How to give', 0],
      ['Which pattern did Jesus give for prayer?', 'The Lord\'s Prayer (Matthew 6)', 'The Aaronic blessing', 'The Shema', 'Psalm 23', 0],
      ['Where did Jesus pray before choosing the twelve?', 'On a mountain all night', 'At a wedding', 'In a market', 'On a boat', 0],
      ['According to Acts 16, what happened when Paul and Silas prayed and sang at midnight in prison?', 'The chains fell off and doors opened', 'A storm ended', 'A meal appeared', 'A boat arrived', 0],
      ['What is biblical fasting?', 'Choosing hunger for a higher hunger', 'Starving oneself to manipulate God', 'A health diet', 'A public show', 0],
      ['How long did Jesus fast before His temptation?', '40 days', '1 day', '7 days', '12 days', 0],
      ['In Isaiah 58, the fast God chooses includes…', 'Loosing chains of injustice and sharing bread', 'Going without water', 'Public mourning only', 'Avoiding people', 0],
      ['What should accompany prayer according to Philippians 4:6?', 'Thanksgiving', 'Complaints', 'Proofs', 'Payments', 0],
      ['Which Psalm says, "I rise before dawn and cry for help"?', 'Psalm 119', 'Psalm 23', 'Psalm 1', 'Psalm 150', 0],
      ['Prayer that pleases God is offered…', 'In faith and according to His will', 'To impress others', 'Only in church', 'Loudly only', 0],
      ['Which apostle urged constant prayer?', 'Paul', 'Pilate', 'Herod', 'Judas', 0],
      ['Intercession is prayer for…', 'Others', 'Only yourself', 'Only the dead', 'Only leaders', 0],
      ['Which verse says "pray without ceasing"?', '1 Thessalonians 5:17', 'Genesis 1:1', 'Judges 5:31', 'Acts 1:8', 0],
      ['God\'s promise about prayer in 1 John 5:14 is…', 'He hears us when we ask according to His will', 'He always says yes to every wish', 'He is silent', 'He punishes quickly', 0],
      ['A prayer watch is best described as…', 'A set time devoted to focused prayer', 'A clock on the wall', 'A church meeting', 'A sleep schedule', 0],
      ['Which posture is mentioned in prayer in the Bible?', 'Standing, kneeling, sitting, lying down', 'Only standing', 'Only kneeling', 'Only lying down', 0],
      ['Corporate prayer differs from private prayer in that…', 'The church agrees together before God', 'It must be louder', 'It uses different words', 'It skips confession', 0],
      ['Humility in prayer means…', 'Agreeing with God about ourselves', 'Speaking long religious words', 'Adding fancy titles to God', 'Avoiding confession', 0]
    ],
    word: [
      ['What is the first step in the Bible study method taught in this academy?', 'Observation', 'Application', 'Debate', 'Memory', 0],
      ['In Psalm 119:105, God\'s Word is described as…', 'A lamp to our feet and a light to our path', 'A wall', 'A shadow', 'A noise', 0],
      ['A testimony should mainly point to…', 'Jesus and what He has done', 'Ourselves', 'A pastor only', 'Luck', 0],
      ['The Bible is inspired by…', 'God through the Holy Spirit', 'Church leaders only', 'Poets only', 'Kings only', 0],
      ['Meditating on Scripture means…', 'Chewing it over in the heart day and night', 'Memorising once', 'Forgetting quickly', 'Criticising freely', 0],
      ['Which Gospel begins with "In the beginning was the Word"?', 'John', 'Matthew', 'Mark', 'Luke', 0],
      ['How many books are in the New Testament?', '27', '39', '46', '66', 0],
      ['How many books are in the Old Testament?', '39', '27', '46', '66', 0],
      ['The parable of the sower is found in…', 'Matthew 13', 'John 3', 'Acts 2', 'Revelation 1', 0],
      ['The book of Psalms is best described as…', 'A collection of prayers and songs', 'A history book', 'A prophecy book', 'A gospel', 0],
      ['Which book records the early church\'s growth after Pentecost?', 'Acts', 'Genesis', 'Revelation', 'Esther', 0],
      ['A disciple\'s responsibility toward Scripture is to…', 'Read, understand, obey and share it', 'Display it without reading', 'Sell it', 'Hide it', 0],
      ['The Bereans were commended for…', 'Examining the Scriptures daily', 'Building temples', 'Avoiding apostles', 'Speaking in tongues', 0],
      ['Which verse says "Faith comes by hearing"?', 'Romans 10:17', 'Psalm 23', 'John 1:1', 'Acts 5:1', 0],
      ['Which Old Testament prophet confronted King Ahab?', 'Elijah', 'Elisha', 'Isaiah', 'Jeremiah', 0],
      ['Which book contains the vision of dry bones?', 'Ezekiel', 'Exodus', 'Ruth', 'Jonah', 0],
      ['The book of Proverbs is primarily a book of…', 'Wisdom sayings', 'History', 'Prophecy', 'Travel', 0],
      ['Scripture is profitable for doctrine, reproof, correction and…', 'Training in righteousness', 'Decorations', 'Dreams', 'Politics', 0]
    ],
    spirit: [
      ['Jesus called the Holy Spirit another…', 'Helper (Comforter)', 'Servant only', 'Angel', 'Accuser', 0],
      ['Which passage lists the fruit of the Spirit?', 'Galatians 5:22-23', 'Psalm 23', 'Acts 2', 'Revelation 22', 0],
      ['Spiritual gifts are given primarily to…', 'Build up the church', 'Impress others', 'Earn money', 'Replace love', 0],
      ['Who is the one who baptises believers in the Holy Spirit?', 'Jesus', 'A pastor only', 'The believer themselves', 'An angel', 0],
      ['The Spirit\'s role in John 16:13 is to…', 'Guide us into all truth', 'Hide truth', 'Confuse us', 'Speak only to prophets', 0],
      ['Which of these is fruit of the Spirit?', 'Patience', 'Gossip', 'Envy', 'Anger', 0],
      ['Which is NOT fruit of the Spirit?', 'Arrogance', 'Kindness', 'Gentleness', 'Self-control', 0],
      ['Which apostle wrote most about spiritual gifts?', 'Paul', 'Pilate', 'Judas', 'Herod', 0],
      ['Which chapter teaches that gifts must be exercised in love?', '1 Corinthians 13', '1 Samuel 17', 'Genesis 12', 'Acts 7', 0],
      ['A prophetic word should always be…', 'Tested by Scripture and confirmed by mature believers', 'Followed blindly', 'Forgotten', 'Sold', 0],
      ['Speaking in tongues in the assembly must be accompanied by…', 'Interpretation for edification', 'Loud music only', 'Silence', 'A vote', 0],
      ['The Spirit-filled life is marked by…', 'Christlike character and Spirit-led decisions', 'Emotional highs only', 'Public miracles only', 'Withdrawal', 0],
      ['How many gifts are listed in 1 Corinthians 12?', 'Nine or more across several lists', 'Exactly three', 'Exactly seven', 'Only one', 0],
      ['The Spirit\'s filling is…', 'An ongoing filling, not a one-time event', 'Only at baptism', 'Only for pastors', 'Automatic', 0],
      ['What does it mean to grieve the Spirit?', 'To live in known sin and unrepentance', 'To fast', 'To pray', 'To worship', 0],
      ['Walking by the Spirit means…', 'Living in step with His leading each day', 'Automatic perfection', 'Silence only', 'Quitting work', 0],
      ['The Spirit intercedes for us when we…', 'Do not know what to pray for', 'Are perfect', 'Sleep', 'Shout', 0],
      ['Galatians 5:22-23 lists how many qualities of the fruit?', 'Nine', 'Three', 'Twelve', 'Twenty', 0]
    ],
    character: [
      ['Philippians 4:6 tells us to replace anxiety with…', 'Prayer, supplication and thanksgiving', 'Ignore everything', 'Worry more', 'Keep silent', 0],
      ['Faithfulness in little things leads to…', 'Greater responsibility', 'Nothing important', 'Pride always', 'Secret sin', 0],
      ['Colossians 3:13 calls believers to…', 'Forgive as Christ forgave', 'Compete', 'Avoid one another', 'Judge only', 0],
      ['1 Corinthians 13 says the greatest virtue is…', 'Love', 'Knowledge', 'Faith alone', 'Power', 0],
      ['Humility involves…', 'Depending on God and esteeming others', 'Thinking less of yourself', 'Weakness only', 'Silence always', 0],
      ['Which verse says "Be anxious for nothing"?', 'Philippians 4:6', 'John 3:16', 'Psalm 150', 'Genesis 1:1', 0],
      ['A faithful steward uses money to…', 'Honour God and bless others', 'Hide it', 'Waste it', 'Hoard it', 0],
      ['Integrity means…', 'Consistency between private and public life', 'Hiding faults', 'Pretending', 'Avoiding tests', 0],
      ['Patience is best defined as…', 'The power to remain under pressure without retaliating', 'Avoiding people', 'Sleeping', 'Quitting', 0],
      ['Self-control is a fruit that involves…', 'Mastering one\'s desires by the Spirit', 'Extreme dieting', 'Punishment', 'Strict silence', 0],
      ['Proverbs 16:32 says…', 'He who is slow to anger is better than the mighty', 'Anger is good', 'Power wins', 'Patience is weakness', 0],
      ['Forgiveness is best described as…', 'Releasing the debt to God', 'Pretending harm did not happen', 'Forgetting everything', 'Demanding revenge', 0],
      ['Healthy relationships require…', 'Truth spoken in love', 'Avoidance', 'Silence', 'Perfection', 0],
      ['A godly friend is one who…', 'Speaks truth with love, even when it costs', 'Flatters only', 'Never corrects', 'Only agrees', 0],
      ['Generosity is best practised as…', 'Cheerful, planned and sacrificial giving', 'Compelled giving', 'Optional giving only', 'Anonymous bragging', 0],
      ['A clear conscience comes from…', 'Walking in the light and confessing sin quickly', 'Avoiding people', 'Perfectionism', 'Silence', 0],
      ['Peace that "passes all understanding" is promised in…', 'Philippians 4:7', 'Psalm 23:1', 'John 1:1', 'Acts 2:1', 0],
      ['Hope is essential to character because…', 'It anchors the soul during suffering', 'It replaces work', 'It avoids reality', 'It ignores trials', 0]
    ],
    mission: [
      ['The Great Commission in Matthew 28 calls believers to…', 'Make disciples of all nations', 'Build temples', 'Earn money', 'Stay silent', 0],
      ['The church is described as one body with…', 'Many members', 'No members', 'One member', 'Many buildings', 0],
      ['God loves what kind of giver?', 'A cheerful giver', 'A reluctant giver', 'A forced giver', 'A famous giver', 0],
      ['Sharing the gospel with others is called…', 'Evangelism', 'Entertainment', 'Business', 'Politics', 0],
      ['Jesus modelled servanthood by…', 'Coming to serve and give His life', 'Avoiding people', 'Demanding tribute', 'Hiding from crowds', 0],
      ['Which parable teaches responsibility for what God entrusts?', 'The talents (Matthew 25)', 'The lost sheep', 'The good Samaritan', 'The mustard seed', 0],
      ['A disciple-maker disciples others by…', 'Teaching them to obey all that Jesus commanded', 'Only preaching', 'Giving money', 'Avoiding follow-up', 0],
      ['Acts 1:8 promises power to…', 'Be Christ\'s witnesses to the ends of the earth', 'Build towers', 'Earn money', 'Stay safe', 0],
      ['Which widow\'s offering did Jesus praise?', 'The widow who gave two small coins', 'The widow who gave nothing', 'The widow who gave gold', 'The rich widow who gave nothing', 0],
      ['Stewardship of time means…', 'Using each season for God\'s glory', 'Avoiding rest', 'Staying busy', 'Hiding indoors', 0],
      ['A church that serves well is one that…', 'Loves God and neighbours practically', 'Only sings', 'Only studies', 'Only waits', 0],
      ['Hospitality as a ministry involves…', 'Welcoming strangers with grace', 'Selling goods', 'Avoiding guests', 'Charging entry', 0],
      ['A lifestyle of mission includes…', 'Daily obedience and willing witness', 'Once-a-year events only', 'Avoiding non-Christians', 'Secret faith', 0],
      ['Which verse says "Go therefore and make disciples"?', 'Matthew 28:19', 'Genesis 1:1', 'Psalm 23', 'Revelation 22', 0],
      ['Sharing faith is best done…', 'With grace, truth and respect', 'By arguing', 'By forcing', 'By hiding', 0],
      ['Jesus said the field is…', 'White for harvest', 'Empty', 'Far away', 'Closed', 0],
      ['Generosity honours God when it is…', 'Cheerful, sacrificial and regular', 'Secret only', 'Compelled', 'Rare', 0],
      ['Disciples are made by…', 'Baptising and teaching obedience', 'Only preaching', 'Avoiding follow-up', 'Charging fees', 0]
    ]
  };

  // Each lesson gets its own pool of 30 lesson-specific questions. The existing
  // LESSON_QUESTIONS dict in pd-academy-data.js holds the first 5; this map
  // extends each lesson with another 25 so every quiz can sample 10 unique
  // lesson questions per attempt.
  var EXTRA_LESSON_QUESTIONS = {
    l01: [
      ['Which book contains the verse "Therefore, if anyone is in Christ, the new creation has come"?', '2 Corinthians 5:17', 'Judges 4', 'Leviticus 1', 'Esther 2', 0],
      ['Before salvation, a person is spiritually…', 'Dead in trespasses and sins', 'Alive and full of joy', 'Already holy', 'Always correct', 0],
      ['Which apostle confessed that Jesus is the Christ?', 'Peter', 'Pilate', 'Herod', 'Judas', 0],
      ['What is the Bible\'s word for the "good news"?', 'The gospel', 'The law', 'A proverb', 'A parable', 0],
      ['True salvation always shows itself by…', 'Fruit in a changed life', 'Wealth', 'Instant perfection', 'Silence only', 0],
      ['The opposite of salvation is…', 'Condemnation and separation from God', 'Extra blessings', 'Perfect peace only', 'Constant joy', 0],
      ['God\'s work in salvation begins with…', 'His grace, not our effort', 'Our prayers alone', 'Our works', 'Our wealth', 0],
      ['Assurance of salvation is based on…', 'God\'s promise in His Word', 'Our emotions', 'Other people\'s opinions', 'Dreams', 0],
      ['What must accompany belief, according to Romans 10:9-10?', 'Confession with the mouth', 'Perfect church attendance', 'Wealth', 'Power', 0],
      ['A new believer\'s first act of obedience is often…', 'Baptism', 'Silence', 'Avoiding people', 'Retirement', 0],
      ['God adopts believers into His family as…', 'Children and heirs', 'Servants only', 'Strangers', 'Enemies', 0],
      ['The first disciples left everything to…', 'Follow Jesus', 'Build houses', 'Travel for fun', 'Sell goods', 0],
      ['Salvation is described as being "born again" by…', 'The Spirit and the Word', 'Human effort', 'Money', 'Education', 0],
      ['Titus 3:5 says we are saved by…', 'His mercy through the washing of rebirth', 'Our works', 'Our wealth', 'Our lineage', 0],
      ['Which of these describes the new birth?', 'A spiritual resurrection', 'A physical rebirth only', 'A new job', 'A new country', 0],
      ['Zacchaeus\'s salvation moment involved him…', 'Climbing a tree to see Jesus and repenting', 'Sleeping all day', 'Travelling abroad', 'Counting money', 0],
      ['The Philippian jailer asked, "What must I do to be saved?" The answer was…', 'Believe in the Lord Jesus', 'Build a temple', 'Give all his money', 'Fast forty days', 0],
      ['After meeting Christ, the saved person becomes…', 'A new creation', 'The same as before', 'Automatically rich', 'A judge', 0],
      ['Salvation does not just forgive, it also…', 'Empowers for new obedience', 'Gives instant perfection', 'Removes all trials', 'Guarantees wealth', 0],
      ['The thief on the cross showed faith by…', 'Confessing Jesus and asking to be remembered', 'Fighting soldiers', 'Stealing more', 'Running away', 0],
      ['A saved person can have…', 'Full assurance anchored in Christ', 'No hope', 'No forgiveness', 'No relationship', 0],
      ['Old Testament believers looked forward to Christ; New Testament believers look…', 'Back to the finished work of Christ', 'To future rituals', 'To angels', 'To wealth', 0],
      ['A safe response after salvation is to…', 'Be baptised and join a faithful church', 'Isolate yourself', 'Stop praying', 'Avoid believers', 0],
      ['Salvation includes forgiveness of…', 'Past, present and future sins through Christ', 'Only past sins', 'Only future sins', 'No sins', 0],
      ['Hebrews 7:25 says Christ is able to…', 'Save completely those who come to God through Him', 'Forget His people', 'Demand money', 'Sleep', 0]
    ],
    l02: [
      ['Which verse teaches that "Man shall not live by bread alone, but by every word that proceeds from the mouth of God"?', 'Matthew 4:4', 'Genesis 1:1', 'Acts 2:1', 'Revelation 22:21', 0],
      ['The Bible is described as…', 'God-breathed and useful for teaching', 'Optional reading', 'A collection of myths', 'A list of rules only', 0],
      ['In Psalm 119, the Word is hidden in the heart to…', 'Keep us from sinning against God', 'Show off memory', 'Win arguments', 'Display knowledge', 0],
      ['The Old Testament prophets wrote…', 'Words God gave them by the Spirit', 'Their own inventions', 'Only poetry', 'Only history', 0],
      ['The New Testament was written in…', 'Greek primarily', 'Latin only', 'Hebrew only', 'Aramaic only', 0],
      ['The Sermon on the Mount is recorded in…', 'Matthew 5-7', 'Mark 1', 'Acts 2', 'Revelation 1', 0],
      ['Which verse says, "Your word is a lamp to my feet"?', 'Psalm 119:105', 'John 3:16', '1 Corinthians 13', 'Acts 2:38', 0],
      ['Which parable teaches that the seed is the Word of God?', 'The sower', 'The lost coin', 'The pearl of great price', 'The talents', 0],
      ['A right attitude toward Scripture is…', 'Reading it prayerfully and humbly', 'Skipping difficult parts', 'Reading it like fiction', 'Reading it only for debates', 0],
      ['Why do Christians read the Old Testament?', 'It points to Christ and forms foundation', 'It is outdated and useless', 'Only for history lessons', 'Only for Jewish readers', 0],
      ['Which verse warns against adding to or subtracting from God\'s Word?', 'Revelation 22:18-19', 'Genesis 1:1', 'Judges 5:1', 'Acts 1:1', 0],
      ['Which Gospel is shortest and most action-packed?', 'Mark', 'Matthew', 'Luke', 'John', 0],
      ['Which Gospel focuses most on Jesus as the fulfilment of prophecy?', 'Matthew', 'Mark', 'Luke', 'John', 0],
      ['The book of Hebrews presents Jesus as…', 'Greater than angels, priests and sacrifices', 'Lesser than Moses', 'A judge only', 'A king only', 0],
      ['A helpful Bible-reading habit is to…', 'Read a chapter daily and journal a question or verse', 'Race to finish in one day', 'Read only at church', 'Read only favourite parts', 0],
      ['Which verse says, "Do not merely listen to the word, and so deceive yourselves. Do what it says"?', 'James 1:22', 'Genesis 1:1', 'Psalms 1:1', 'Acts 1:1', 0],
      ['Joshua 1:8 instructs believers to…', 'Meditate on the Book of the Law day and night', 'Avoid the law', 'Hide the law', 'Sell the law', 0],
      ['Which book records the early church\'s birth at Pentecost?', 'Acts', 'Genesis', 'Revelation', 'Esther', 0],
      ['Which book is a series of poetic love songs?', 'Song of Solomon', 'Leviticus', 'Nahum', 'Habakkuk', 0],
      ['A balanced Bible diet includes…', 'History, poetry, prophecy, letters and gospel', 'Only one genre', 'Only poetry', 'Only prophecy', 0],
      ['Which verse says "The fear of the LORD is the beginning of wisdom"?', 'Proverbs 9:10', 'John 3:16', 'Romans 8:28', 'Acts 2:38', 0],
      ['God\'s Word is described as sharper than…', 'Any two-edged sword', 'A feather', 'A soft pillow', 'A flower', 0],
      ['Reading Scripture in community helps us to…', 'Stay accountable and learn from others', 'Compete with each other', 'Show off knowledge', 'Avoid correction', 0],
      ['A child of God responds to Scripture with…', 'Obedience and worship', 'Argument only', 'Indifference', 'Negotiation', 0],
      ['The book of Romans explains…', 'Salvation by grace through faith', 'Only genealogies', 'Only end-times events', 'Only poetry', 0]
    ],
    l03: [
      ['Which book records Abraham\'s faith counted as righteousness?', 'Genesis 15:6', 'Exodus 20', 'Leviticus 1', 'Acts 2', 0],
      ['Hebrews 11 is often called…', 'The faith hall of fame', 'A psalm', 'A prophecy', 'A parable', 0],
      ['One example of faith in the hall of fame is…', 'Moses choosing to identify with God\'s people', 'Herod building a palace', 'Pilate washing his hands', 'Caesar conquering', 0],
      ['Faith grows stronger through…', 'Trials and obedience', 'Avoiding trials', 'Wealth', 'Fame', 0],
      ['Doubt is best handled by…', 'Returning to God\'s promises in prayer', 'Quitting church', 'Following feelings alone', 'Flee to isolation', 0],
      ['The Syrophoenician woman showed faith by…', 'Persisting and trusting Jesus\' mercy', 'Leaving immediately', 'Arguing angrily', 'Stealing bread', 0],
      ['Peter began to sink because he…', 'Looked at the storm instead of Jesus', 'Prayed too long', 'Was perfect', 'Slept', 0],
      ['Walking by faith means…', 'Trusting God even when we cannot see the way', 'Always being certain', 'Avoiding decisions', 'Following feelings only', 0],
      ['Genuine faith always expresses itself through…', 'Works of love and obedience', 'Words only', 'Wealth', 'Titles', 0],
      ['Which verse says, "I can do all things through Christ who strengthens me"?', 'Philippians 4:13', 'Genesis 1:1', 'Acts 2:1', 'Revelation 22', 0],
      ['The opposite of faith is…', 'Disbelief or trust in self only', 'Patience', 'Generosity', 'Humility', 0],
      ['Faith is the substance of things hoped for and the evidence of…', 'Things not seen', 'Things already seen', 'Things forgotten', 'Things avoided', 0],
      ['When faith fails, the Bible\'s remedy is to…', 'Return to God and trust His Word again', 'Panic and run', 'Blame others', 'Forget God', 0],
      ['Romans 12:3 says God has given each believer a measure of…', 'Faith', 'Money', 'Power', 'Talent', 0],
      ['Abraham waited how many years for Isaac?', 'About 25 years', 'One year', 'Ten years', 'A hundred years', 0],
      ['Hannah\'s prayer for a son teaches us…', 'Persistent faith pleases God', 'Complaining wins', 'Giving up is best', 'Silence is faith', 0],
      ['Which disciples asked Jesus to increase their faith?', 'The apostles in Luke 17', 'The Pharisees only', 'Herod only', 'Pontius Pilate', 0],
      ['Moses\' staff became a serpent in Pharaoh\'s court because of…', 'God\'s power at work through faith', 'Moses\' magic', 'Pharaoh\'s weakness', 'Egyptian idols', 0],
      ['Living by faith means trusting God with…', 'Our future', 'Our money only', 'Our image only', 'Our silence only', 0],
      ['Faith must be exercised with…', 'Patience and endurance', 'Complaint', 'Boredom', 'Self-pity', 0],
      ['The gospel call is "Repent and believe the…"', 'Gospel', 'Law', 'Tradition', 'Custom', 0],
      ['Faith is most visible in…', 'Everyday obedience, not only miracles', 'Miracles only', 'Titles only', 'Speeches only', 0],
      ['Which verse says, "Without faith it is impossible to please God"?', 'Hebrews 11:6', 'Psalm 23:1', 'John 1:1', 'Acts 2:38', 0],
      ['Spiritual growth is the result of…', 'Faith exercised in trials', 'Avoiding trials', 'Avoiding church', 'Following feelings only', 0],
      ['When faith meets trials, James 1 says to…', 'Count it all joy', 'Complain', 'Quit', 'Run away', 0]
    ],
    l04: [
      ['The Lord\'s Prayer begins with…', '"Our Father which art in heaven"', '"Hallowed be my name"', '"Glory be to me"', '"In the name of..."', 0],
      ['Which verse says, "Do not be anxious about anything, but in everything by prayer…"?', 'Philippians 4:6', 'Genesis 1:1', 'Acts 2:1', 'Revelation 22', 0],
      ['In the Lord\'s Prayer, "give us this day our daily…"', 'Bread', 'Wealth', 'Power', 'Wisdom', 0],
      ['In the Lord\'s Prayer, forgiveness is linked to…', 'Forgiving others', 'Ignoring others', 'Remembering debts', 'Avoiding enemies', 0],
      ['Jesus taught that prayer is best done…', 'In a private room with the door closed', 'On street corners for show', 'Only in temples', 'Only at night', 0],
      ['Which verse says, "Ask and it will be given to you; seek and you will find"?', 'Matthew 7:7', 'Psalm 1:1', 'Acts 2:1', 'Genesis 1:1', 0],
      ['The Lord\'s Prayer is found in…', 'Matthew 6 and Luke 11', 'Mark 1 and John 1', 'Acts 2 only', 'Revelation only', 0],
      ['The first request in the Lord\'s Prayer after "Father" is…', '"Hallowed be Thy name"', '"Give us bread"', '"Deliver us"', '"Forgive us"', 0],
      ['Jesus prayed before…', 'Major decisions and trials', 'Every meal only', 'Only at night', 'Only in public', 0],
      ['What should accompany our prayers, according to Colossians 4:2?', 'Watchfulness and thanksgiving', 'Complaints', 'Silence only', 'Argument', 0],
      ['The Lord\'s Prayer contains…', 'Six basic movements', 'Ten movements', 'Three movements', 'Twenty movements', 0],
      ['According to Jesus, God already knows our needs before we…', 'Ask Him', 'Earn money', 'Travel', 'Sleep', 0],
      ['True prayer includes…', 'Praise, confession, thanksgiving, petition, intercession and listening', 'Only petition', 'Only praise', 'Only confession', 0],
      ['James 5:16 says, "The prayer of a righteous person is powerful and…"', 'Effective', 'Hidden', 'Weak', 'Ignored', 0],
      ['The disciples were told to pray for…', 'Workers for the harvest', 'Power over Rome', 'Wealth', 'Quiet churches', 0],
      ['Which verse says, "Pray for those who persecute you"?', 'Matthew 5:44', 'Psalm 23', 'Acts 2:1', 'Genesis 1:1', 0],
      ['God\'s presence with Moses in the tabernacle models…', 'Intimate conversation in prayer', 'Loud music only', 'Public events only', 'Wealth', 0],
      ['Praying Scripture helps because…', 'It aligns our hearts with God\'s words', 'It makes prayer longer', 'It impresses people', 'It avoids confession', 0],
      ['Which verse says, "Your Father knows what you need before you ask Him"?', 'Matthew 6:8', 'Psalm 23', 'John 3:16', 'Acts 1:8', 0],
      ['A consistent prayer life is best built by…', 'Set times and a simple pattern', 'Fancy words only', 'Long hours only', 'Public display only', 0],
      ['What is one result of answered prayer?', 'Praise and deeper trust', 'Pride', 'Sloth', 'Self-righteousness', 0],
      ['Jesus warned against…', 'Praying to be seen by others', 'Praying privately', 'Praying with fasting', 'Praying in the Spirit', 0],
      ['The Father\'s willingness to give is compared to…', 'A loving parent giving good gifts', 'A judge punishing', 'A stranger ignoring', 'A king demanding', 0],
      ['Which chapter gives the Lord\'s Prayer most fully?', 'Matthew 6', 'Romans 8', 'Acts 2', 'Revelation 1', 0],
      ['Prayer that moves God is marked by…', 'Faith, humility and alignment with His will', 'Loud words', 'Length', 'Eloquence', 0]
    ],
    l05: [
      ['Which verse says, "Blessed are those who wash their robes, that they may have the right to the tree of life"?', 'Revelation 22:14', 'Genesis 1:1', 'Acts 2:1', 'John 1:1', 0],
      ['Night prayer is described as a time of…', 'Strategic watchfulness', 'Wasted effort', 'Loneliness only', 'Sleep', 0],
      ['Acts 16:25 records Paul and Silas praying and singing at…', 'Midnight', 'Sunrise', 'Sunset', 'Noon', 0],
      ['Which verse describes Jesus praying all night before choosing the apostles?', 'Luke 6:12', 'Mark 1:1', 'John 1:1', 'Acts 1:1', 0],
      ['A healthy approach to night prayer includes…', 'Wise boundaries, community and Scripture', 'Isolation only', 'Exhaustion always', 'Avoiding sleep completely', 0],
      ['Which Psalm says, "I meditate on you in the watches of the night"?', 'Psalm 63:6', 'Psalm 23', 'Psalm 1', 'Psalm 150', 0],
      ['The purpose of night prayer is…', 'Seeking God\'s face for breakthrough', 'Showing off endurance', 'Earning merit', 'Punishing self', 0],
      ['A helpful night prayer plan might include…', 'A short list of intercession and a Psalm', 'Only loud shouting', 'Only singing', 'Only fasting', 0],
      ['Jesus rose early in the morning to…', 'Pray in a solitary place', 'Work only', 'Eat only', 'Sleep more', 0],
      ['A night prayer group should agree on…', 'A short agenda, time and confidentiality', 'Loud competition', 'Long speeches', 'Avoiding the Bible', 0],
      ['Which verse says, "Be devoted to prayer, being watchful and thankful"?', 'Colossians 4:2', 'Psalm 1:1', 'Acts 2:1', 'Revelation 22', 0],
      ['How can night prayer strengthen daily life?', 'It anchors the heart before the day\'s noise', 'It ruins sleep', 'It replaces work', 'It harms witness', 0],
      ['Night prayer should be…', 'Spirit-led, not legalistic', 'A rigid rule for everyone', 'Punishment for sin', 'A public competition', 0],
      ['Intercession during night prayer may include…', 'Pleading for family, leaders and nations', 'Gossip', 'Complaint about leaders', 'Self-pity', 0],
      ['Which prophet prayed through the night for rain?', 'Elijah', 'Samuel', 'Isaiah', 'Jeremiah', 0],
      ['The Lord\'s invitation in Psalm 134 is to…', 'Bless the LORD in the watches of the night', 'Sleep more', 'Eat bread', 'Avoid God', 0],
      ['When kept in balance, night prayer brings…', 'Clarity and depth before God', 'Only weariness', 'Loneliness only', 'No fruit', 0],
      ['Which verse says, "He who watches for you will neither slumber nor sleep"?', 'Psalm 121:4', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A mature night prayer habit avoids…', 'Spiritual pride and neglect of family duties', 'Reading the Bible', 'Repentance', 'Worship', 0],
      ['Corporate night prayer should not…', 'Replace a believer\'s daily responsibilities', 'Be Spirit-led', 'Be Scripture-based', 'Be confidential', 0],
      ['Which chapter records Paul and Silas\' midnight worship?', 'Acts 16', 'Acts 2', 'Acts 7', 'Acts 13', 0],
      ['Night prayer can include…', 'Intercession, thanksgiving, repentance and quiet listening', 'Only loud shouting', 'Only singing', 'Only silence', 0],
      ['The result of consistent night prayer often includes…', 'Greater peace and clearer direction', 'Instant wealth', 'No trials', 'Easier life', 0],
      ['A watch of the night in Bible times could last…', 'A few hours in the dark', 'Only five minutes', 'Twelve hours', 'Only at midday', 0],
      ['Night prayer requires what kind of posture?', 'Watchful and humble dependence on God', 'Loud performance', 'Spiritual competition', 'Self-promotion', 0]
    ],
    l06: [
      ['Biblical fasting is always…', 'Voluntary, prayerful and Christ-centred', 'Forced on others', 'Only for prophets', 'Only for special days', 0],
      ['The Pharisees fasted how often in Jesus\' day?', 'Twice a week', 'Once a year', 'Once a month', 'Never', 0],
      ['Which verse warns against fasting with a sad face to be seen by others?', 'Matthew 6:16', 'Psalm 23', 'John 3:16', 'Acts 2:1', 0],
      ['Fasting in Acts 13 accompanied…', 'Worship and ministry commissioning', 'Wealth-building', 'Political campaigns', 'Avoiding God', 0],
      ['Fasting is designed to…', 'Sharpen spiritual sensitivity and humility', 'Earn God\'s favour', 'Replace obedience', 'Punish self', 0],
      ['Which verse says, "When you fast, do not look sombre… but anoint your head and wash your face"?', 'Matthew 6:17-18', 'Psalm 1:1', 'Acts 2:1', 'Revelation 22', 0],
      ['Fasting without prayer is…', 'A mere diet', 'Most powerful', 'A miracle', 'A requirement', 0],
      ['A partial fast might involve…', 'Skipping one meal or a specific food', 'No water ever', 'Wealth sharing only', 'Long sermons', 0],
      ['A full fast should only be done with…', 'Wise counsel and attention to health', 'Public competition', 'Hidden motive', 'Self-pity', 0],
      ['Which prophet fasted for forty days on Mount Horeb?', 'Elijah', 'Moses', 'Samuel', 'Isaiah', 0],
      ['Fasting that honours God produces…', 'Justice, mercy and generosity', 'Self-righteousness', 'Pride', 'Anger', 0],
      ['Which verse warns, "When you fast, do not be like the hypocrites"?', 'Matthew 6:16', 'Genesis 1:1', 'Acts 2:1', 'John 1:1', 0],
      ['Fasting is best when paired with…', 'Prayer and repentance', 'Complaint', 'Argument', 'Famous words', 0],
      ['A corporate fast is best called by…', 'Spiritual leaders with clear purpose', 'Anyone impulsively', 'Politicians', 'Social media', 0],
      ['Fasting helps us notice…', 'Our dependence on God over food', 'Wealth', 'Power', 'Titles', 0],
      ['When physically unable to fast food, one might…', 'Fast from media or comforts for a season', 'Pretend to fast', 'Boast about fasting', 'Avoid God', 0],
      ['Daniel\'s fast of choice was…', 'Vegetables and water', 'Rich meals', 'Long speeches', 'Nothing at all', 0],
      ['Esther called for a fast before…', 'Approaching the king on behalf of her people', 'Her wedding', 'Her travel', 'Her wealth', 0],
      ['A Spirit-led fast produces…', 'Fruit: peace, conviction, clarity, generosity', 'Merely hunger', 'Argument', 'Self-pity', 0],
      ['Which verse says, "Is this not the fast I choose: to loose the chains of injustice"?', 'Isaiah 58:6', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Fasting is not a substitute for…', 'Obedience and love', 'Prayer', 'Worship', 'Scripture', 0],
      ['After fasting, Jesus…', 'Ministered in the power of the Spirit', 'Avoided people', 'Went into hiding', 'Retired', 0],
      ['A successful fast is measured by…', 'Spiritual growth, not hunger endured', 'Loud testimony', 'Visible weight loss', 'Public praise', 0],
      ['The danger of fasting is…', 'Pride in spiritual achievement', 'Wealth', 'Power', 'Friendship', 0],
      ['Fasting can include prayer for…', 'Revival, guidance, healing and the lost', 'Vengeance on enemies', 'Personal promotion', 'Gossip', 0]
    ],
    l07: [
      ['The Inductive Bible Study method has how many basic steps?', 'Three: observe, interpret, apply', 'One: memorise', 'Ten', 'Twenty', 0],
      ['Which Psalm says, "I have hidden your word in my heart that I might not sin against you"?', 'Psalm 119:11', 'Psalm 23', 'Psalm 1', 'Psalm 150', 0],
      ['When interpreting a passage, you should consider…', 'Context, genre, audience and grammar', 'Only one verse in isolation', 'Personal feelings alone', 'Politics', 0],
      ['Application of Scripture should be…', 'Specific, measurable and accountable', 'Vague and open-ended', 'Hidden only', 'Silent only', 0],
      ['Which Gospel opens with a genealogy?', 'Matthew', 'Mark', 'Luke', 'John', 0],
      ['A helpful question in observation is…', 'What words or phrases repeat?', 'What makes me richest?', 'Who can I impress?', 'How do I win?', 0],
      ['A genre in the Bible is…', 'A type of writing such as narrative, poetry or letter', 'A music album', 'A modern story', 'A news genre', 0],
      ['Application is incomplete without…', 'Obedience and follow-through', 'Praise only', 'Reading only', 'Quoting only', 0],
      ['Which verse says, "All Scripture is God-breathed and is useful for teaching, rebuking, correcting and training in righteousness"?', '2 Timothy 3:16', 'Genesis 1:1', 'Acts 2:1', 'Psalm 1:1', 0],
      ['A good study group question is…', 'What does this teach about God and about me?', 'Who is the richest here?', 'What is my favourite colour?', 'How long is the sermon?', 0],
      ['Reading the Bible without application leads to…', 'Knowledge that puffs up', 'Instant holiness', 'Wealth', 'Power', 0],
      ['Application of James 1:22 includes…', 'Being doers of the word and not hearers only', 'Quoting only', 'Listening only', 'Avoiding people', 0],
      ['Which chapter records the Bereans testing the Scriptures daily?', 'Acts 17', 'Genesis 1', 'Acts 2', 'Revelation 1', 0],
      ['A useful first step in study is to…', 'Pray for the Holy Spirit\'s illumination', 'Skip to application', 'Argue with the text', 'Avoid context', 0],
      ['Comparing Scripture with Scripture helps us to…', 'Understand the whole counsel of God', 'Confuse the text', 'Win arguments', 'Avoid depth', 0],
      ['What does "hermeneutics" mean?', 'The science of biblical interpretation', 'A type of prayer', 'A genre of music', 'A place in Israel', 0],
      ['Which Gospel emphasises that Jesus is fully God?', 'John', 'Matthew', 'Mark', 'Luke', 0],
      ['Before applying, you must…', 'Understand the passage in context', 'Skip to action', 'Skip to feelings', 'Avoid prayer', 0],
      ['A common mistake is to…', 'Use one verse to build a whole theology', 'Read the whole Bible', 'Pray first', 'Study in community', 0],
      ['A balanced Bible diet includes…', 'Old and New Testaments, multiple genres', 'Only poetry', 'Only prophecy', 'Only one gospel', 0],
      ['The book of Proverbs is…', 'A collection of wisdom sayings', 'A prophecy', 'A gospel', 'A letter', 0],
      ['The book of Revelation is…', 'Apocalyptic literature with symbolic visions', 'A gospel', 'A psalm', 'A letter', 0],
      ['When studying prophecy, you should remember…', 'Some is fulfilled, some is yet to come', 'All is fully fulfilled', 'All is future', 'All is past', 0],
      ['The study method works best when practiced…', 'Regularly and prayerfully', 'Only at night', 'Only before exams', 'Only in church', 0],
      ['The goal of study is not knowledge alone, but…', 'Transformation in Christ', 'Winning debates', 'Showing off', 'Career gain', 0]
    ],
    l08: [
      ['God most clearly speaks today through…', 'His Word, the Bible', 'Random dreams', 'Coincidences only', 'Self-proclaimed prophets only', 0],
      ['Which verse says, "Your word is a lamp to my feet and a light to my path"?', 'Psalm 119:105', 'Psalm 23', 'John 3:16', 'Acts 2:1', 0],
      ['To test a claimed message from God, you should…', 'Compare it to Scripture', 'Follow it immediately', 'Share it without thinking', 'Ignore Scripture', 0],
      ['Which verse says, "Whether you turn to the right or to the left, your ears will hear a voice behind you, saying, This is the way; walk in it"?', 'Isaiah 30:21', 'Genesis 1:1', 'Acts 2:1', 'Revelation 22', 0],
      ['The Spirit\'s guidance often comes through…', 'A settled peace aligned with Scripture', 'Strong emotions alone', 'Coincidence alone', 'Other people\'s opinions only', 0],
      ['Wise counsel from mature believers…', 'Confirms and protects decisions', 'Always agrees with me', 'Should be ignored', 'Replaces Scripture', 0],
      ['Which verse says, "In all your ways acknowledge Him, and He will make your paths straight"?', 'Proverbs 3:6', 'Psalm 23', 'John 1:1', 'Acts 1:8', 0],
      ['God\'s guidance is best received when…', 'The heart is humble and the Word is open', 'You are proud', 'You ignore community', 'You demand a sign', 0],
      ['Open doors are a sign of God\'s leading but…', 'They must align with Scripture and fruit', 'Are the only sign needed', 'Are always from God', 'Never need testing', 0],
      ['Impressions from God will always agree with…', 'The whole counsel of Scripture', 'Personal preferences only', 'Cultural trends', 'Hidden agendas', 0],
      ['Which verse says, "The heart of the righteous studieth to answer"?', 'Proverbs 15:28', 'Genesis 1:1', 'Acts 2:1', 'John 1:1', 0],
      ['Peace is one test of a right decision, but…', 'Peace must be grounded in Scripture, not convenience', 'Peace is the only test', 'Peace is always proof', 'Peace is unreliable', 0],
      ['How does the Spirit guide us?', 'Through Scripture, peace, counsel and circumstances', 'Only through visions', 'Only through feelings', 'Only through signs', 0],
      ['Which verse says, "I will instruct you and teach you in the way you should go; I will counsel you with my loving eye on you"?', 'Psalm 32:8', 'Psalm 23', 'Psalm 1', 'Psalm 150', 0],
      ['The opposite of guidance is…', 'Confusion that comes from self-will', 'Always peace', 'Always clarity', 'Always joy', 0],
      ['A believer should never treat guidance as…', 'A replacement for Scripture', 'Helpful counsel', 'Confirmation', 'Comfort', 0],
      ['Which verse says, "Trust in the LORD with all your heart and lean not on your own understanding"?', 'Proverbs 3:5', 'Psalm 23', 'John 3:16', 'Acts 1:8', 0],
      ['The book of Acts shows guidance often coming through…', 'Prophetic words, circumstances and community', 'Lucky charms', 'Personal feelings only', 'Dreams only', 0],
      ['Which verse says, "If any of you lacks wisdom, let him ask of God…"?', 'James 1:5', 'Genesis 1:1', 'Acts 2:1', 'Revelation 22', 0],
      ['A mature believer listens for guidance through…', 'Scripture, Spirit, counsel, providence and peace', 'Only visions', 'Only feelings', 'Only people', 0],
      ['Which chapter records Philip\'s Spirit-led encounter with the Ethiopian?', 'Acts 8', 'Acts 2', 'Acts 7', 'Acts 13', 0],
      ['A good response to guidance is…', 'Faithful obedience step by step', 'Fear', 'Argument', 'Delay forever', 0],
      ['When guidance seems unclear, the believer should…', 'Continue in faithful obedience to what is clear', 'Panic', 'Quit praying', 'Blame God', 0],
      ['Which verse says, "He guides the humble in what is right and teaches them His way"?', 'Psalm 25:9', 'Psalm 23', 'Acts 1:8', 'Genesis 1:1', 0],
      ['God\'s guidance is most needed in…', 'Major decisions and daily faithfulness', 'Only crises', 'Only prayers', 'Only sermons', 0]
    ],
    l09: [
      ['Which verse says, "They overcame him by the blood of the Lamb and by the word of their testimony"?', 'Revelation 12:11', 'Genesis 1:1', 'Psalm 23', 'Acts 2:1', 0],
      ['A personal testimony should focus on…', 'What Jesus has done', 'Only past sins', 'Personal success', 'Other people\'s faults', 0],
      ['Mark 5:19 shows Jesus telling the healed man to…', 'Go home and tell what the Lord has done', 'Keep quiet', 'Leave town', 'Travel far', 0],
      ['A good length for a spoken testimony is…', 'Two to three minutes', 'Thirty minutes', 'One sentence only', 'A full sermon', 0],
      ['A clear testimony includes…', 'Before Christ, the meeting with Christ, and life after Christ', 'Only current blessings', 'Only past sorrows', 'Only doctrines', 0],
      ['The tone of a healthy testimony is…', 'Humble, honest and hope-filled', 'Proud', 'Angry', 'Vague', 0],
      ['Which verse says, "Always be ready to give a reason for the hope that you have"?', '1 Peter 3:15', 'Psalm 23', 'John 1:1', 'Acts 1:8', 0],
      ['Testimony paired with godly living produces…', 'Credible witness', 'Argument', 'Division', 'Confusion', 0],
      ['A testimony should avoid…', 'Exaggeration and bragging', 'Honesty', 'Humility', 'Scripture', 0],
      ['The greatest testimony is a life that…', 'Reflects Christ in everyday moments', 'Speaks only in church', 'Avoids people', 'Hides faith', 0],
      ['Which book records Paul\'s testimony before King Agrippa?', 'Acts 26', 'Genesis 1', 'Acts 2', 'Revelation 1', 0],
      ['Sharing a testimony should never be…', 'Coercive or manipulative', 'Respectful', 'Honest', 'Clear', 0],
      ['A testimony grows over time as we…', 'Walk with God daily', 'Avoid God', 'Sleep more', 'Avoid people', 0],
      ['Which verse says, "Let the redeemed of the LORD tell their story"?', 'Psalm 107:2', 'Psalm 23', 'Acts 1:8', 'John 1:1', 0],
      ['Sharing a testimony in church builds…', 'Faith in others', 'Argument', 'Confusion', 'Division', 0],
      ['When sharing, avoid…', 'Negative remarks about people who hurt you', 'Honesty', 'Hope', 'Love', 0],
      ['A small-group testimony time is best with…', 'Time limits and a safe environment', 'Unlimited time', 'Public shaming', 'Debate', 0],
      ['Which verse says, "Come and hear, all you who fear God, and I will tell what He has done for me"?', 'Psalm 66:16', 'Psalm 23', 'Acts 1:8', 'John 1:1', 0],
      ['A powerful testimony often includes…', 'Specific details that show God\'s hand', 'Vague generalities only', 'Exaggerated boasting', 'Sarcasm', 0],
      ['Peter\'s testimony in Acts 2 resulted in…', '3,000 people being added to the church', 'Argument only', 'Sleeping', 'Division', 0],
      ['Which chapter records the conversion of the Philippian jailer?', 'Acts 16', 'Acts 2', 'Acts 7', 'Acts 13', 0],
      ['A personal testimony is also a form of…', 'Worship and witness', 'Boasting', 'Hidden faith', 'Secret religion', 0],
      ['Which verse says, "Taste and see that the LORD is good"?', 'Psalm 34:8', 'Psalm 23', 'Acts 1:8', 'John 1:1', 0],
      ['In sharing your story, you should always…', 'Point to Jesus, not yourself', 'Take credit', 'Exaggerate', 'Argue', 0],
      ['The goal of testimony is that…', 'Others might come to know Christ', 'You become famous', 'You win arguments', 'You appear perfect', 0]
    ],
    l10: [
      ['The Holy Spirit is best described as…', 'A divine Person, equal with the Father and the Son', 'An impersonal force', 'An angel', 'A feeling', 0],
      ['Which verse says, "I will ask the Father, and He will give you another Helper, that He may be with you forever"?', 'John 14:16', 'Psalm 23', 'Acts 2:1', 'Genesis 1:1', 0],
      ['The Spirit\'s role includes…', 'Convicting, regenerating, indwelling, sealing and teaching', 'Only miracles', 'Only prophecy', 'Only tongues', 0],
      ['Which chapter describes the outpouring of the Spirit at Pentecost?', 'Acts 2', 'Genesis 1', 'Revelation 1', 'Acts 7', 0],
      ['The Spirit\'s fruit in a believer is…', 'Christlike character', 'Power only', 'Wealth', 'Fame', 0],
      ['Which verse says, "The Spirit of truth… will guide you into all truth"?', 'John 16:13', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['To be filled with the Spirit means…', 'Yielding daily control to His leading', 'Speaking in tongues always', 'Working miracles', 'Becoming perfect instantly', 0],
      ['The Spirit equips believers with…', 'Spiritual gifts for service', 'Money', 'Power over governments', 'Fame', 0],
      ['The Spirit intercedes for us when…', 'We do not know what to pray for', 'We are perfect', 'We sleep', 'We avoid prayer', 0],
      ['The Spirit\'s work includes illuminating…', 'Scripture so we understand truth', 'Politics', 'Business', 'Entertainment', 0],
      ['Which verse says, "You shall receive power when the Holy Spirit has come upon you"?', 'Acts 1:8', 'Psalm 23', 'John 3:16', 'Genesis 1:1', 0],
      ['The Spirit seals believers…', 'Until the day of redemption', 'Temporarily', 'For one year', 'When convenient', 0],
      ['The Spirit gives believers adoption as…', 'Children of God', 'Servants only', 'Strangers', 'Enemies', 0],
      ['Grieving the Spirit happens through…', 'Persistent sin and unrepentance', 'Prayer', 'Worship', 'Generosity', 0],
      ['Quenching the Spirit happens through…', 'Refusing to follow His prompting', 'Prayer', 'Worship', 'Faith', 0],
      ['Walking by the Spirit produces…', 'The fruit of the Spirit', 'Fleshly works', 'Wealth', 'Power', 0],
      ['The Spirit empowers witness by…', 'Giving boldness and clarity', 'Taking over our minds', 'Hiding us', 'Saving us from trials', 0],
      ['Which verse says, "The Spirit himself bears witness with our spirit that we are children of God"?', 'Romans 8:16', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['The Spirit gives gifts for…', 'The common good of the body', 'Self-promotion', 'Solitary use only', 'Earning money', 0],
      ['The Spirit is given to…', 'Every believer who trusts Christ', 'Only apostles', 'Only pastors', 'Only special people', 0],
      ['Which verse says, "Do not grieve the Holy Spirit of God, by whom you were sealed for the day of redemption"?', 'Ephesians 4:30', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['The Spirit and the Word always agree because…', 'The Spirit authored the Word', 'They are the same book', 'They contradict at times', 'They are unrelated', 0],
      ['The Spirit is a Person who…', 'Speaks, teaches, comforts, convicts and guides', 'Has no emotions', 'Is passive', 'Is optional', 0],
      ['A believer\'s relationship with the Spirit grows through…', 'Obedience, Scripture and prayer', 'Avoidance', 'Wealth', 'Fame', 0],
      ['The Spirit gives assurance of…', 'Salvation and eternal life', 'Wealth', 'Power', 'Titles', 0]
    ],
    l11: [
      ['Galatians 5:22-23 lists how many qualities of the fruit of the Spirit?', 'Nine', 'Three', 'Twelve', 'Twenty', 0],
      ['Which is a fruit of the Spirit?', 'Patience', 'Envy', 'Strife', 'Selfish ambition', 0],
      ['Which is NOT a fruit of the Spirit?', 'Arrogance', 'Gentleness', 'Faithfulness', 'Self-control', 0],
      ['The fruit of the Spirit is the result of…', 'Abiding in Christ', 'Self-effort alone', 'Politics', 'Fame', 0],
      ['"Love" in 1 Corinthians 13 is best described as…', 'Patient, kind and self-giving', 'Sentimental only', 'Optional', 'Romantic only', 0],
      ['"Joy" differs from happiness because…', 'Joy is rooted in Christ, not in circumstances', 'Joy depends on wealth', 'Joy is the same as happiness', 'Joy comes from parties', 0],
      ['"Peace" that passes understanding is given in…', 'Philippians 4:7', 'Psalm 23:1', 'Genesis 1:1', 'Acts 2:1', 0],
      ['"Patience" often shows in…', 'Slow, faithful endurance under trial', 'Quick temper', 'Complaint', 'Argument', 0],
      ['"Kindness" includes…', 'Going out of our way to bless others', 'Politeness only', 'Words only', 'Silence', 0],
      ['"Goodness" involves…', 'Doing what is right even when unseen', 'Wealth', 'Fame', 'Power', 0],
      ['"Faithfulness" is shown by…', 'Keeping promises and finishing well', 'Half-hearted effort', 'Breaking commitments', 'Avoiding duty', 0],
      ['"Gentleness" is not weakness but…', 'Strength under control', 'Sadness', 'Anger', 'Isolation', 0],
      ['"Self-control" relates to…', 'Spirit-led mastery of desires', 'Strict diets only', 'Punishment', 'Loneliness', 0],
      ['Which verse says, "The fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness"?', 'Galatians 5:22', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['The fruit of the Spirit is best grown in…', 'Community and accountability', 'Isolation only', 'Silence only', 'Wealth', 0],
      ['Which chapter is called the love chapter?', '1 Corinthians 13', 'Romans 8', 'Acts 2', 'Psalm 119', 0],
      ['Spiritual growth is more visible in…', 'Daily character than in spectacular gifts', 'Miracles only', 'Wealth', 'Titles', 0],
      ['Choosing to forgive is a demonstration of…', 'The fruit of the Spirit', 'Self-righteousness', 'Pride', 'Argument', 0],
      ['Which verse says, "Against such things there is no law"?', 'Galatians 5:23', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A person filled with the Spirit displays…', 'Christlike character and Spirit-led love', 'Constant anger', 'Argument', 'Selfishness', 0],
      ['Holiness is a sign of…', 'Spirit\'s transforming work', 'Self-effort alone', 'Avoiding all people', 'Strict rules', 0],
      ['Which chapter teaches "love is patient, love is kind"?', '1 Corinthians 13', 'Acts 2', 'Psalm 119', 'Genesis 1', 0],
      ['A believer\'s transformation is the work of…', 'The Spirit rooted in the Word', 'Politics', 'Self-effort alone', 'Money', 0],
      ['Fruit grows slowly because…', 'Character takes time and trials', 'God is slow', 'We are lazy', 'Bible is small', 0],
      ['A community of Spirit-filled believers becomes…', 'A place of love, joy and peace', 'A place of division', 'A place of pride', 'A place of fear', 0]
    ],
    l12: [
      ['Which verse says, "To each one the manifestation of the Spirit is given for the common good"?', '1 Corinthians 12:7', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Spiritual gifts are given by…', 'The Holy Spirit as He determines', 'Church committees only', 'Birth order', 'Personal ambition', 0],
      ['The greatest gift, according to 1 Corinthians 13, is…', 'Love', 'Tongues', 'Prophecy', 'Knowledge', 0],
      ['Speaking in tongues in public requires…', 'Interpretation for edification', 'Loud music', 'Voting', 'Silence', 0],
      ['Prophecy in the assembly should be…', 'Tested and weighed by mature believers', 'Followed blindly', 'Rejected always', 'Famous only', 0],
      ['Which verse says, "Earnestly desire the spiritual gifts, especially that you may prophesy"?', '1 Corinthians 14:1', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Gifts are for…', 'Building up the body of Christ', 'Self-promotion', 'Earning money', 'Personal glory', 0],
      ['Which verse says, "Having then gifts differing according to the grace that is given to us, let us use them"?', 'Romans 12:6', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A gift without love is…', 'Noisy and worthless', 'Powerful', 'Perfect', 'Enough', 0],
      ['Hospitality is best described as…', 'A spiritual gift of welcoming others', 'A business skill', 'A political talent', 'A wealth move', 0],
      ['Which verse says, "As each has received a gift, use it to serve one another, as good stewards of God\'s varied grace"?', '1 Peter 4:10', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A prophet\'s role is not only to predict but to…', 'Speak God\'s Word faithfully for the moment', 'Earn money', 'Argue', 'Be silent', 0],
      ['Which verse says, "Desire the sincere milk of the word, that you may grow"?', '1 Peter 2:2', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A teacher\'s gift should be exercised with…', 'Accuracy and humility', 'Ego', 'Argument', 'Pride', 0],
      ['A giving heart is a sign of…', 'Mature stewardship', 'Selfishness', 'Pride', 'Argument', 0],
      ['Mercy shown to those in need is a gift of…', 'Compassion', 'Argument', 'Power', 'Wealth', 0],
      ['Which chapter teaches that gifts differ but the Spirit is one?', '1 Corinthians 12', 'Acts 2', 'Psalm 119', 'Genesis 1', 0],
      ['Which verse says, "God has placed the members each one of them in the body, just as He desired"?', '1 Corinthians 12:18', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A Spirit-filled believer uses gifts to…', 'Serve the church and witness to the world', 'Compete', 'Dominate', 'Argue', 0],
      ['False gifts produce…', 'Division and pride', 'Unity', 'Edification', 'Fruit', 0],
      ['Which verse says, "Let all things be done for edification"?', '1 Corinthians 14:26', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Which verse says, "When you come together, each one has a psalm, a teaching, a tongue, a revelation, an interpretation"?', '1 Corinthians 14:26', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Discovering your gift often starts with…', 'Serving and receiving feedback', 'Avoiding service', 'Earning money', 'Titles', 0],
      ['A gift abused can…', 'Hurt the body of Christ', 'Build unity', 'Bring peace', 'Help others', 0],
      ['The best response to someone\'s gifting is…', 'Encouragement and gratitude', 'Envy', 'Argument', 'Silence', 0]
    ],
    l13: [
      ['Which verse says, "Do not be anxious about anything"?', 'Philippians 4:6', 'Psalm 23', 'Acts 2:1', 'Genesis 1:1', 0],
      ['Which verse says, "Casting all your care upon Him, for He cares for you"?', '1 Peter 5:7', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Which verse says, "Peace I leave with you; My peace I give to you"?', 'John 14:27', 'Psalm 23', 'Acts 2:1', 'Genesis 1:1', 0],
      ['One remedy for anxiety is to…', 'Pray with thanksgiving', 'Worry more', 'Argue', 'Avoid God', 0],
      ['Which verse says, "When the righteous cry for help, the LORD hears"?', 'Psalm 34:17', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Worry focuses on…', 'What may happen tomorrow', 'What God has already done', 'What is already past', 'What Scripture says', 0],
      ['A peaceful heart is rooted in…', 'Trust in God\'s character', 'Wealth', 'Circumstances', 'Fame', 0],
      ['Which verse says, "The LORD is my shepherd, I shall not want"?', 'Psalm 23:1', 'Psalm 1', 'Acts 2:1', 'John 1:1', 0],
      ['Which verse says, "Fear not, for I am with you; be not dismayed, for I am your God"?', 'Isaiah 41:10', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['"God has not given us a spirit of fear, but of power and love and a sound mind" is found in…', '2 Timothy 1:7', 'Psalm 23', 'Acts 2:1', 'Genesis 1:1', 0],
      ['An anxious thought should be replaced with…', 'A Scripture-based truth', 'A bigger worry', 'A debate', 'A complaint', 0],
      ['Which verse says, "The peace of God, which passes all understanding, will guard your hearts and minds"?', 'Philippians 4:7', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A healthy response to fear is to…', 'Pray, trust and act in faith', 'Panic', 'Run away', 'Argue', 0],
      ['Which verse says, "When I am afraid, I put my trust in You"?', 'Psalm 56:3', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['An anxious mind is best helped by…', 'A praying friend and Scripture meditation', 'A bigger house', 'Fame', 'Power', 0],
      ['Which verse says, "Commit your way to the LORD; trust in Him and He will do it"?', 'Psalm 37:5', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['An antidote to fear is to remember…', 'God\'s past faithfulness', 'Your own strength', 'Other people\'s failures', 'Tomorrow only', 0],
      ['Which verse says, "Be still, and know that I am God"?', 'Psalm 46:10', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Anxiety is often reduced by…', 'Bringing requests to God in prayer', 'Complaining', 'Blaming others', 'Worry more', 0],
      ['Which verse says, "There is no fear in love, but perfect love casts out fear"?', '1 John 4:18', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A mature believer responds to trials with…', 'Steady trust and prayer', 'Bitterness', 'Revenge', 'Self-pity', 0],
      ['A prayer partner can help reduce anxiety because…', 'Prayer brings God\'s peace and shared burden', 'They remove all problems', 'They take over your life', 'They argue for you', 0],
      ['Which verse says, "My grace is sufficient for you, for My strength is made perfect in weakness"?', '2 Corinthians 12:9', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Practising gratitude helps reduce anxiety because…', 'It shifts focus from fear to God\'s goodness', 'It avoids problems', 'It pretends life is perfect', 'It hides reality', 0],
      ['God\'s care for the sparrow reminds us that…', 'He cares even more for His children', 'We are random', 'We should not worry', 'Birds are more important', 0]
    ],
    l14: [
      ['Which verse says, "He who is faithful in what is least is faithful also in much"?', 'Luke 16:10', 'Psalm 23', 'Acts 2:1', 'Genesis 1:1', 0],
      ['Integrity is best described as…', 'Consistency between private and public life', 'Saying what people want', 'Hiding mistakes', 'Being perfect', 0],
      ['A steward is someone who…', 'Manages what belongs to another', 'Owns everything', 'Refuses responsibility', 'Avoids work', 0],
      ['Money is best viewed as a tool to…', 'Advance God\'s kingdom and bless others', 'Show off', 'Hoard', 'Compete', 0],
      ['Generosity should be…', 'Cheerful and planned', 'Reluctant', 'Compelled', 'Anonymous bragging', 0],
      ['Which verse says, "The generous soul will be made rich, and he who waters will also be watered himself"?', 'Proverbs 11:25', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A faithful steward is faithful in…', 'Little and much', 'Money only', 'Time only', 'Wealth only', 0],
      ['Which verse says, "It is required in stewards that one be found faithful"?', '1 Corinthians 4:2', 'Psalm 23', 'Acts 2:1', 'Genesis 1:1', 0],
      ['Stewardship of time includes…', 'Spending time in prayer, Word and relationships', 'Avoiding rest', 'Only work', 'Only fun', 0],
      ['Debt is best approached by…', 'Honesty, planning and counsel', 'Hiding', 'Avoiding payments', 'Borrowing more', 0],
      ['A generous person shows…', 'Faith in God\'s provision', 'Faith in money', 'Selfishness', 'Greed', 0],
      ['Which verse says, "Honour the LORD with your substance and with the firstfruits of all your increase"?', 'Proverbs 3:9', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Integrity in words includes…', 'Letting your yes be yes', 'Vague promises', 'Exaggeration', 'Flattery', 0],
      ['Tithing is best practised as…', 'Worship and obedience', 'A burden', 'A public show', 'A superstition', 0],
      ['A wise steward plans for the future by…', 'Saving, budgeting and giving', 'Hoarding', 'Borrowing', 'Gambling', 0],
      ['Which verse says, "Two are better than one… for if they fall, one will lift up his companion"?', 'Ecclesiastes 4:9-10', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Stewardship of relationships involves…', 'Forgiving, encouraging and serving', 'Controlling others', 'Avoiding people', 'Manipulation', 0],
      ['Generosity produces…', 'Joy and eternal reward', 'Envy', 'Argument', 'Selfishness', 0],
      ['A church that handles money well reflects…', 'Integrity in leadership', 'Power struggles', 'Wealth', 'Fame', 0],
      ['Which verse says, "Every man shall give as he is able, according to the blessing of the LORD your God which He has given you"?', 'Deuteronomy 16:17', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Laziness in stewardship leads to…', 'Loss', 'Wealth', 'Power', 'Fame', 0],
      ['Diligence at work is a form of stewardship when done…', 'As unto the Lord', 'For self only', 'For show', 'For pride', 0],
      ['A steward must give account to…', 'God', 'Self', 'Friends', 'Enemies', 0],
      ['Generosity may include…', 'Time, talent and treasure', 'Money only', 'Time only', 'Talent only', 0],
      ['A godly steward uses influence to…', 'Serve and bless others', 'Control people', 'Gain power', 'Build kingdoms', 0]
    ],
    l15: [
      ['Which verse says, "Bear with each other and forgive one another if any of you has a grievance against someone"?', 'Colossians 3:13', 'Psalm 23', 'Acts 2:1', 'Genesis 1:1', 0],
      ['Forgiveness is best described as…', 'Releasing the debt to God', 'Pretending harm did not happen', 'Forgetting everything', 'Demanding revenge', 0],
      ['Which verse says, "Forgive us our debts, as we also have forgiven our debtors"?', 'Matthew 6:12', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Forgiveness is commanded because…', 'Christ forgave us', 'It feels good only', 'It avoids pain', 'It proves strength', 0],
      ['Which verse says, "Be kind and compassionate to one another, forgiving each other, just as in Christ God forgave you"?', 'Ephesians 4:32', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Unforgiveness harms…', 'The one who refuses to forgive', 'Only the offender', 'Nobody', 'Wealth', 0],
      ['Reconciliation requires…', 'Repentance, forgiveness and time', 'Silence', 'Forgetting', 'Revenge', 0],
      ['Which verse says, "Do not let the sun go down while you are still angry"?', 'Ephesians 4:26', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Forgiving someone does not mean…', 'Trusting them blindly', 'Releasing the debt', 'Praying for them', 'Letting go of revenge', 0],
      ['Boundaries are important because…', 'They protect and rebuild trust over time', 'They punish offenders', 'They replace forgiveness', 'They avoid all contact', 0],
      ['Which verse says, "If your brother sins, rebuke him; and if he repents, forgive him"?', 'Luke 17:3', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A gracious reply is…', 'Soft, which turns away wrath', 'Harsh and loud', 'Sarcastic', 'Silent', 0],
      ['Healthy relationships require…', 'Truth and grace', 'Silence only', 'Avoidance', 'Perfection', 0],
      ['Which verse says, "A soft answer turns away wrath, but a harsh word stirs up anger"?', 'Proverbs 15:1', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Forgiveness frees us to…', 'Live fully in God\'s grace', 'Forget everything', 'Ignore pain', 'Pretend life is perfect', 0],
      ['A godly friend is one who…', 'Speaks truth with love', 'Flatters only', 'Never corrects', 'Only agrees', 0],
      ['Which verse says, "Faithful are the wounds of a friend, but the kisses of an enemy are deceitful"?', 'Proverbs 27:6', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Confession is a sign of…', 'Maturity and repentance', 'Weakness', 'Selfishness', 'Argument', 0],
      ['A church that practices forgiveness becomes…', 'A place of healing and hope', 'A place of division', 'A place of pride', 'A place of fear', 0],
      ['Restitution is appropriate when…', 'We have wronged someone and seek to make it right', 'We are angry', 'We want revenge', 'We argue', 0],
      ['Which verse says, "Live in harmony with one another"?', 'Romans 12:16', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Listening is a powerful expression of…', 'Love and humility', 'Selfishness', 'Argument', 'Power', 0],
      ['Gossip destroys…', 'Trust and unity', 'Wealth only', 'Buildings only', 'Time only', 0],
      ['Healthy relationships are built on…', 'Love, truth, forgiveness and patience', 'Power', 'Wealth', 'Fame', 0],
      ['Forgiving seventy times seven means…', 'Unlimited willingness to forgive', 'Forgive seven times only', 'Forgive seventy times only', 'Forgive once', 0]
    ],
    l16: [
      ['Which verse says, "Go therefore and make disciples of all the nations"?', 'Matthew 28:19', 'Psalm 23', 'Acts 2:1', 'Genesis 1:1', 0],
      ['Sharing the gospel is a command for…', 'All believers', 'Pastors only', 'Missionaries only', 'Scholars', 0],
      ['Which verse says, "How beautiful are the feet of those who preach the gospel of peace"?', 'Romans 10:15', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A simple way to share the gospel is…', 'Tell your testimony and the basic message of Christ', 'Argue with everyone', 'Use complex theology only', 'Stay silent', 0],
      ['Which verse says, "Always be ready to give a defence to anyone who asks you for the reason for the hope that is in you"?', '1 Peter 3:15', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['The gospel is summarised in 1 Corinthians 15 as…', 'Christ died, was buried, rose again, appeared to many', 'A list of laws', 'A parable', 'A psalm', 0],
      ['Evangelism should be done with…', 'Gentleness and respect', 'Argument', 'Force', 'Bribery', 0],
      ['Which verse says, "The fruit of the righteous is a tree of life, and he who wins souls is wise"?', 'Proverbs 11:30', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Discipleship begins with…', 'Baptism and continued teaching', 'Famous preaching only', 'Money', 'Power', 0],
      ['A lifestyle witness includes…', 'Integrity, kindness and generosity', 'Hidden faith', 'Argument', 'Pride', 0],
      ['Which verse says, "I planted, Apollos watered, but God gave the increase"?', '1 Corinthians 3:6', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Effective evangelism involves…', 'Prayer, presence, proclamation and power', 'Wealth', 'Titles', 'Power', 0],
      ['Listening is important in evangelism because…', 'It builds trust and shows respect', 'It avoids preaching', 'It delays sharing', 'It hides the gospel', 0],
      ['Which verse says, "Faith comes by hearing, and hearing by the word of God"?', 'Romans 10:17', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['The first disciples\' model of evangelism was…', 'Simple: tell what Jesus has done', 'Complex debates only', 'Religious rituals', 'Wealth sharing only', 0],
      ['Which verse says, "Those who sow in tears shall reap in joy"?', 'Psalm 126:5', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Resisting the urge to argue is part of…', 'Wise witness', 'Weakness', 'Argument', 'Pride', 0],
      ['Sharing your faith should always be…', 'Prayerful and Spirit-led', 'Compelled by force', 'Hidden', 'Argumentative', 0],
      ['Which verse says, "My house shall be called a house of prayer for all nations"?', 'Mark 11:17', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A healthy church sends missionaries because…', 'The gospel is for every nation and people group', 'It is fashionable', 'It is required by law', 'It is a show', 0],
      ['Holiness is essential for effective witness because…', 'It backs up the message', 'It earns merit', 'It avoids people', 'It hides sin', 0],
      ['A short gospel outline might include…', 'God loves, we are separated, Christ came, response invited', 'Only a list of rules', 'Only prophecies', 'Only miracles', 0],
      ['Which verse says, "The Lord is not slack concerning His promise, but is longsuffering toward us, not willing that any should perish"?', '2 Peter 3:9', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Asking good questions during witness shows…', 'Genuine interest and care', 'Manipulation', 'Argument', 'Pride', 0],
      ['Prayer for the lost should be…', 'Specific, persistent and faith-filled', 'Vague', 'Reluctant', 'Compelled', 0]
    ],
    l17: [
      ['Which verse says, "Even the Son of Man did not come to be served, but to serve, and to give His life a ransom for many"?', 'Mark 10:45', 'Psalm 23', 'Acts 2:1', 'Genesis 1:1', 0],
      ['Serving in the local church is…', 'A normal part of discipleship, not optional for the healthy', 'Only for pastors', 'Only for volunteers', 'A show', 0],
      ['Which verse says, "Now you are the body of Christ, and each one of you is a part of it"?', '1 Corinthians 12:27', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Every believer has been given a…', 'Spiritual gift to serve the body', 'Title', 'Wealth', 'Power', 0],
      ['Which verse says, "Each of you should use whatever gift you have received to serve others, as faithful stewards of God\'s grace"?', '1 Peter 4:10', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A faithful servant of Christ is marked by…', 'Humility, faithfulness and love', 'Pride', 'Argument', 'Power', 0],
      ['Which verse says, "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters"?', 'Colossians 3:23', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A serving team should have…', 'A clear vision, training and accountability', 'Wealth', 'Power', 'Fame', 0],
      ['Which verse says, "Do not neglect to do good and to share what you have, for such sacrifices are pleasing to God"?', 'Hebrews 13:16', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Worship teams serve the church by…', 'Leading the congregation in Christ-centred praise', 'Performing', 'Showing off', 'Hiding faith', 0],
      ['Which verse says, "God has placed the members each one of them in the body, just as He desired"?', '1 Corinthians 12:18', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Hospitality is a ministry that…', 'Welcomes strangers and saints alike', 'Charges entry', 'Avoids guests', 'Seeks wealth', 0],
      ['Tech and media teams serve by…', 'Removing distractions so the gospel can be heard', 'Showing off', 'Hiding truth', 'Being loud', 0],
      ['Children\'s ministry is most effective when it is…', 'Safe, Scripture-centred and loving', 'Strict only', 'Ignored', 'Hidden', 0],
      ['Prayer team members should…', 'Pray regularly and handle requests with care', 'Pretend', 'Argue', 'Hide requests', 0],
      ['A leader in the church serves by…', 'Laying down life and equipping the saints', 'Exercising power', 'Demanding tribute', 'Avoiding people', 0],
      ['Which verse says, "Let us not grow weary of doing good, for in due season we will reap, if we do not give up"?', 'Galatians 6:9', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Serving together builds…', 'Unity and Christlike character', 'Pride', 'Argument', 'Selfishness', 0],
      ['Which verse says, "Having gifts that differ according to the grace given to us, let us use them"?', 'Romans 12:6', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A healthy church body has…', 'Many members serving different functions', 'One member', 'No members', 'Hidden members', 0],
      ['Discipleship happens in community through…', 'Word, prayer, fellowship and serving', 'Money', 'Power', 'Fame', 0],
      ['A church without serving becomes…', 'A spectator event, not a body', 'A healthy body', 'A growing church', 'A witnessing church', 0],
      ['Which verse says, "Obey your leaders and submit to them, for they keep watch over your souls"?', 'Hebrews 13:17', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Training new disciples to serve is part of…', 'Multiplication', 'Argument', 'Selfishness', 'Power', 0],
      ['A serving mindset flows from…', 'Being filled with the Spirit and rooted in love', 'Pride', 'Argument', 'Selfishness', 0]
    ],
    l18: [
      ['Which verse says, "God loves a cheerful giver"?', '2 Corinthians 9:7', 'Psalm 23', 'Acts 2:1', 'Genesis 1:1', 0],
      ['Giving should first flow from…', 'A heart of worship', 'Guilt', 'Comparison', 'Show', 0],
      ['Which verse says, "Each one must give as he has decided in his heart, not reluctantly or under compulsion"?', '2 Corinthians 9:7', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Tithing is a biblical pattern of giving…', 'A tenth of income to the Lord', 'All income', 'Half', 'None', 0],
      ['Which verse says, "Honour the LORD with your substance and with the firstfruits of all your increase"?', 'Proverbs 3:9', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Generosity flows from…', 'Faith in God\'s provision', 'Fear of poverty', 'Desire for status', 'Anger', 0],
      ['Which verse says, "He who sows bountifully will also reap bountifully"?', '2 Corinthians 9:6', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['The widow\'s offering teaches that God values…', 'Sacrificial giving over amount', 'Only amount', 'Only public giving', 'Wealth', 0],
      ['Which verse says, "Where your treasure is, there your heart will be also"?', 'Matthew 6:21', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A cheerful giver reflects…', 'Trust in God\'s faithfulness', 'Selfishness', 'Pride', 'Argument', 0],
      ['Which verse says, "Give, and it will be given to you: good measure, pressed down, shaken together, running over"?', 'Luke 6:38', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Generosity can include…', 'Time, talent and treasure', 'Money only', 'Time only', 'Talent only', 0],
      ['Which verse says, "Do not lay up for yourselves treasures on earth, but lay up treasures in heaven"?', 'Matthew 6:19-20', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Giving to the poor is a sign of…', 'Genuine faith and compassion', 'Show', 'Pride', 'Argument', 0],
      ['Which verse says, "If anyone has the world\'s goods and sees his brother in need, yet closes his heart, how does God\'s love abide in him"?', '1 John 3:17', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['First-fruits giving honours God by…', 'Giving Him the first and best, not leftovers', 'Giving last', 'Giving nothing', 'Giving reluctantly', 0],
      ['A heart anchored in eternity gives with…', 'Open hands and joy', 'Gripped hands', 'Fear', 'Argument', 0],
      ['Which verse says, "Remember the Lord your God, for it is He who gives you power to get wealth"?', 'Deuteronomy 8:18', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['Generosity includes…', 'Sharing with those who cannot repay', 'Public flaunting', 'Conditional gifts only', 'Wealth hoarding', 0],
      ['Which verse says, "A generous person will prosper; whoever refreshes others will be refreshed"?', 'Proverbs 11:25', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A couple\'s giving plan is best made…', 'Together in prayer and unity', 'In secret only', 'Under pressure', 'In conflict', 0],
      ['Generous giving produces…', 'Eternal reward and present joy', 'Instant perfection', 'No trials', 'No tests', 0],
      ['Which verse says, "Command them to do good, to be rich in good works, to be generous and ready to share"?', '1 Timothy 6:18', 'Psalm 23', 'Acts 2:1', 'John 1:1', 0],
      ['A cheerful giver often experiences…', 'Joy, peace and trust in God', 'Resentment', 'Greed', 'Argument', 0],
      ['Generosity beyond tithing is a sign of…', 'Mature stewardship and gospel love', 'Show', 'Status', 'Argument', 0]
    ]
  };

  // Build the extended question pool. Existing entries in pd-academy-data.js's
  // LESSON_QUESTIONS dict hold 5 questions each; we now stack the additional
  // 25 above so each lesson ends up with 30. The total track bank is
  // expanded from 6 to 18 per track. The renderer samples 10 per attempt.
  DATA.LESSON_QUESTION_POOL = {};
  DATA.lessons.forEach(function (lesson) {
    var pool = [];
    if (lesson.quizId && window.PD_ACADEMY.DATA.quizzes) {
      var quiz = window.PD_ACADEMY.DATA.quizzes.filter(function (q) { return q.id === lesson.quizId; })[0];
      if (quiz && quiz.questions && quiz.questions.length) pool = pool.concat(quiz.questions);
    }
    var extra = EXTRA_LESSON_QUESTIONS[lesson.id];
    if (extra && extra.length) pool = pool.concat(extra);
    // De-duplicate by prompt text to be safe
    var seen = {};
    var unique = [];
    pool.forEach(function (q) {
      var key = (q[0] || '').trim().toLowerCase();
      if (key && !seen[key]) { seen[key] = true; unique.push(q); }
    });
    DATA.LESSON_QUESTION_POOL[lesson.id] = unique;
  });

  // Publish the per-lesson topics so the quiz flow can draw questions ONLY
  // from the topic just studied — the requirement that quizzes never mix
  // unrelated topics. Each topic carries its curated pool plus the expanded
  // bank authored above, deduplicated by prompt text.
  DATA.TOPIC_QUESTION_POOL = {};
  Object.keys(EXTRA_LESSON_QUESTIONS).forEach(function (lessonId) {
    var base = (DATA.lessonQuestions && DATA.lessonQuestions[lessonId]) || [];
    var seen = {};
    var pool = [];
    function push(q) {
      if (!q) return;
      var key = (q[0] || '').trim().toLowerCase();
      if (key && !seen[key]) { seen[key] = true; pool.push(q); }
    }
    base.forEach(push);
    (EXTRA_LESSON_QUESTIONS[lessonId] || []).forEach(push);
    DATA.TOPIC_QUESTION_POOL[lessonId] = pool;
  });

  // Extend each quiz's question list. The existing seeded list is kept as the
  // head of the pool; the bank per track is then added so each quiz has 30
  // question candidates. The renderer will sample 10 per attempt.
  DATA.TRACK_QUESTION_POOL = TRACK_BANK;
  DATA.lessons.forEach(function (lesson) {
    var quiz = window.PD_ACADEMY.DATA.quizzes.filter(function (q) { return q.id === lesson.quizId; })[0];
    if (!quiz) return;
    var trackPool = TRACK_BANK[lesson.trackId] || [];
    var extras = DATA.LESSON_QUESTION_POOL[lesson.id] || [];
    var combined = [];
    var seenP = {};
    function push(q) {
      if (!q) return;
      var key = (q[0] || '').trim().toLowerCase();
      if (key && !seenP[key]) { seenP[key] = true; combined.push(q); }
    }
    (trackPool || []).forEach(push);
    (extras || []).forEach(push);
    // Replace the existing quiz.questions with the full bank so attempts can
    // sample across 30 lesson questions plus the track-level questions
    // already included in the head list.
    quiz.questions = combined;
    quiz.bankSize = combined.length;
  });
})();
