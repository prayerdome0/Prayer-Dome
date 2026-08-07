/*
 * Prayer Dome — Sermon & Bible Story library
 * ===========================================================================
 * Each entry is written to be *read aloud*. The `story` array is a list of
 * paragraphs; the Sermons page speaks them one at a time and highlights the
 * paragraph currently being narrated, so a member can follow along, pause,
 * and pick up where they left off.
 *
 * Writing guidance for new entries
 *   • Keep paragraphs to 2–4 sentences. Speech synthesis handles short
 *     paragraphs far more naturally, and it makes the highlight useful.
 *   • Avoid abbreviations and numerals the synthesiser will mangle —
 *     write "chapter three" rather than "ch. 3".
 *   • `minutes` is an estimate used for the reading-time badge.
 *
 * Admin-posted sermons from Firestore are merged with this list at runtime by
 * sermons.html; these bundled ones are the always-available baseline so the
 * page is never empty.
 * ===========================================================================
 */

const PD_SERMONS = [
  {
    id: 'prodigal-son',
    title: 'The Father Who Ran',
    subtitle: 'The parable of the prodigal son',
    series: 'Stories Jesus Told',
    speaker: 'Prayer Dome Ministry Team',
    scripture: 'Luke 15:11-32',
    topics: ['forgiveness', 'family', 'salvation'],
    image: '/assets/sermons/sermon-prodigal.jpg',
    tint: 'dawn',
    minutes: 6,
    featured: true,
    summary: 'A son takes his inheritance, wastes everything, and comes home expecting to be a servant. What he meets on the road changes how we understand God forever.',
    keyVerse: 'But when he was yet a great way off, his father saw him, and had compassion, and ran, and fell on his neck, and kissed him. — Luke 15:20',
    story: [
      'There was a man who had two sons. The younger one came to him one day and said something that should have broken the household in two. Father, give me my share of the inheritance now.',
      'Understand what that request meant. In that culture, you received your inheritance when your father died. To ask for it early was to say, I wish you were already gone. I want what you have, but I do not want you.',
      'And here is the first surprise of the story. The father does not argue. He does not disown him. He divides his living between them and lets the boy go. Love that cannot be refused is not love at all, and God will not force any of us to stay.',
      'The son gathered everything together and travelled into a far country. And there he wasted his substance with riotous living. The money went quickly, the way money does when it was never earned.',
      'Then a mighty famine arose in that land, and he began to be in want. The friends who had gathered around his money were not there when the money was gone. He ended up in a field feeding pigs, and he would gladly have eaten what the pigs were eating, and no man gave him anything.',
      'And then comes the sentence the whole story turns on. He came to himself. In the pig field, with nothing left, he finally saw clearly. How many hired servants of my father have bread enough and to spare, and I perish with hunger.',
      'So he made a plan. I will arise and go to my father, and I will say to him, Father, I have sinned against heaven and before you, and I am no more worthy to be called your son. Make me as one of your hired servants.',
      'Notice that he was not coming home confident. He was coming home rehearsing. He had a speech prepared because he did not believe he would be received as a son. He hoped only to be allowed near the house as a labourer.',
      'And he arose and came to his father. But when he was yet a great way off, his father saw him.',
      'Stop there. He saw him a great way off. That means the father had been watching the road. Every single day, looking down that road, hoping. The son had never for one moment been forgotten.',
      'And the father had compassion, and ran, and fell on his neck, and kissed him. An older man in that culture did not run. Running meant lifting your robe, exposing your legs, losing your dignity in front of the whole village. The father did not care. He spent his dignity to reach his son first.',
      'The son began his speech. Father, I have sinned against heaven and in your sight, and am no more worthy to be called your son. But he never got to the part about being a hired servant. The father interrupted him.',
      'Bring forth the best robe and put it on him. Put a ring on his hand and shoes on his feet. Bring the fatted calf and kill it, and let us eat and be merry. For this my son was dead, and is alive again. He was lost, and is found.',
      'The robe covered the shame of the journey. The ring restored his authority in the family. The shoes marked him as a son and not a slave, because slaves in that house went barefoot. Every single thing the father gave him said the same thing. You are not staff here. You are my child.',
      'There is an older brother in this story too, and we must not skip him. He was in the field, and when he heard the music he was angry and would not go in. Lo, these many years do I serve you, he said, and you never gave me a party.',
      'Do you hear it? He said serve. He had lived in his father\'s house for years and still thought of himself as an employee. It is possible to never leave home and still be far away.',
      'And the father went out to him too. He went out to the son in the far country and he went out to the son in the field. He pleads with them both. Son, you are ever with me, and all that I have is yours.',
      'The story ends without telling us whether the older brother came in. Jesus leaves it open on purpose, because he was telling this to religious people who were grumbling that he ate with sinners. The ending was theirs to write.',
      'And it is ours to write too. Wherever you are today — in the far country having wasted what you were given, or in the field having served for years without ever feeling like a child — the father is already coming out to meet you.',
      'You do not have to finish your speech. He has been watching the road.'
    ],
    prayer: 'Father, thank You that You have been watching the road for me. I stop rehearsing my speech and I simply come. Cover me with Your robe, restore what I have wasted, and let me live as a child in Your house and not as a servant. In Jesus\' name, Amen.',
    reflection: [
      'Which son are you more like today — the one in the far country, or the one in the field?',
      'What have you been rehearsing before God that you can simply stop saying?',
      'Who is there in your life that you need to run toward?'
    ]
  },

  {
    id: 'david-goliath',
    title: 'The Giant Was the Smaller Problem',
    subtitle: 'David and Goliath',
    series: 'Faith Under Fire',
    speaker: 'Prayer Dome Ministry Team',
    scripture: '1 Samuel 17',
    topics: ['fear', 'courage', 'strength'],
    image: '/assets/sermons/sermon-david.jpg',
    tint: 'ocean',
    minutes: 6,
    featured: true,
    summary: 'An army of trained soldiers stood frozen for forty days. A shepherd boy delivering bread ended it in an afternoon. The difference was not size — it was what each of them was measuring.',
    keyVerse: 'Thou comest to me with a sword, and with a spear, and with a shield: but I come to thee in the name of the LORD of hosts. — 1 Samuel 17:45',
    story: [
      'Two armies faced each other across the valley of Elah. Israel on one hill, the Philistines on the other, and a valley between them that neither would cross.',
      'And out of the Philistine camp came a champion named Goliath of Gath, whose height was six cubits and a span. Nearly ten feet tall. His coat of armour alone weighed as much as a grown man.',
      'Every morning and every evening for forty days he came out and shouted the same challenge. Choose you a man, and let him come down to me. If he be able to fight with me and kill me, then will we be your servants.',
      'And when Saul and all Israel heard those words, they were dismayed and greatly afraid. Forty days. Eighty times he came out. And nobody moved.',
      'Now David was the youngest of eight brothers, and he was not a soldier. His father Jesse sent him to the camp with bread and cheese, simply to check on his older brothers and bring back word.',
      'So he arrived carrying groceries into a war zone. And while he was talking with his brothers, Goliath came out and made his speech again, and David watched every soldier in Israel run away from him and be sore afraid.',
      'And David said something that nobody else in that valley had said in forty days. Who is this uncircumcised Philistine, that he should defy the armies of the living God?',
      'Listen to the difference. Every soldier there was measuring Goliath against themselves, and they came up short every time. David measured Goliath against God, and the giant became small.',
      'The problem in that valley was never Goliath\'s height. It was that an entire army had forgotten who they belonged to.',
      'His oldest brother Eliab heard him and was furious. Why did you come down here? With whom have you left those few sheep in the wilderness? I know your pride and the naughtiness of your heart.',
      'That is worth noticing. The first opposition David faced was not from the giant. It was from his own family, and it came before he had done anything at all. Sometimes the people closest to you will be the last to see what God is doing in you.',
      'Word reached Saul, and he sent for David. And David said to Saul, Let no man\'s heart fail because of him. Your servant will go and fight with this Philistine.',
      'Saul said, You are not able. You are but a youth, and he a man of war from his youth.',
      'And David answered with the most important thing in the whole chapter. Your servant kept his father\'s sheep, and there came a lion and a bear and took a lamb out of the flock. And I went out after him and smote him and delivered it out of his mouth.',
      'Nobody had seen the lion. Nobody had seen the bear. Those fights happened in the wilderness with no audience and no applause. But they were where David learned that God delivers.',
      'The LORD that delivered me out of the paw of the lion and out of the paw of the bear, he will deliver me out of the hand of this Philistine.',
      'Your private victories are your public credentials. What God did for you when nobody was watching is exactly what qualifies you now.',
      'Saul tried to dress him in the royal armour, and David could not even walk in it. He took it off. I cannot go with these, for I have not proved them.',
      'Do not let anyone else\'s armour slow you down. God is not asking you to fight like somebody else. He is asking you to fight with what He has already proved in your own hand.',
      'So David took his staff and chose five smooth stones out of the brook and drew near to the Philistine. And Goliath looked at him and disdained him, for he was but a youth, and ruddy, and of a fair countenance.',
      'And Goliath cursed him by his gods and said, Come to me, and I will give your flesh to the fowls of the air.',
      'Then David said the words that ended forty days of fear. You come to me with a sword and with a spear and with a shield. But I come to you in the name of the LORD of hosts, the God of the armies of Israel, whom you have defied.',
      'And it came to pass, when the Philistine arose and came and drew nigh to meet David, that David hasted and ran toward the army to meet the Philistine.',
      'He ran toward it. He did not wait to be attacked. When you know whose name you carry, you stop letting the thing that frightens you set the timing.',
      'And David put his hand in his bag and took out a stone and slang it, and smote the Philistine in his forehead, and he fell upon his face to the earth.',
      'One stone. Forty days of paralysis ended in a single afternoon, by the one person there who was not measuring the giant against himself.',
      'Whatever is shouting at you across your valley this morning — the diagnosis, the debt, the door that will not open — it has a height, and God has no height. Bring the God who handled your lion and your bear.',
      'And then run toward it.'
    ],
    prayer: 'Lord of hosts, I have been measuring my giant against myself and coming up short. Today I measure it against You. Remind me of every lion and bear You already delivered me from, and let me walk out in what You have proved in my own hand, not somebody else\'s armour. I come in Your name. Amen.',
    reflection: [
      'What is your Goliath shouting at you every morning?',
      'Name one private victory God gave you that nobody else saw. What does it qualify you for now?',
      'Whose armour have you been trying to wear?'
    ]
  },

  {
    id: 'calming-the-storm',
    title: 'He Was in the Boat the Whole Time',
    subtitle: 'Jesus calms the storm',
    series: 'Faith Under Fire',
    speaker: 'Prayer Dome Ministry Team',
    scripture: 'Mark 4:35-41',
    topics: ['fear', 'peace', 'faith'],
    image: '/assets/sermons/sermon-storm.jpg',
    tint: 'ocean',
    minutes: 5,
    featured: true,
    summary: 'Experienced fishermen were certain they were about to drown. The one person on board who was not afraid was asleep at the back of the boat.',
    keyVerse: 'And he arose, and rebuked the wind, and said unto the sea, Peace, be still. And the wind ceased, and there was a great calm. — Mark 4:39',
    story: [
      'The same day, when the evening was come, Jesus said to his disciples, Let us pass over unto the other side.',
      'Hold on to that sentence, because everything in this story hangs on it. He did not say, let us go out into the middle and drown. He said, let us pass over to the other side. The destination was announced before the storm arrived.',
      'And when they had sent away the multitude, they took him even as he was in the ship. And there were also with him other little ships.',
      'And there arose a great storm of wind, and the waves beat into the ship, so that it was now full.',
      'Remember who was on board. Peter, Andrew, James and John were commercial fishermen. This was their lake. They had worked it their whole lives and knew its moods. When men like that say the boat is going down, the boat is going down.',
      'And he was in the hinder part of the ship, asleep on a pillow.',
      'That detail is almost funny, and it is also the heart of the passage. The waves that were terrifying professional sailors were not enough to wake him. What was a crisis to them was not a crisis to him.',
      'And they awake him and say unto him, Master, do you not care that we perish?',
      'That is not a polite request. That is an accusation. And it is the exact question fear always puts in our mouths. Not, are You able — but, do You even care?',
      'If we are honest, most of us have prayed that prayer. God, can You not see this? Are You asleep? Does any of this matter to You?',
      'And he arose, and rebuked the wind, and said unto the sea, Peace, be still.',
      'Two words. He did not need to bail water or grab an oar or shout instructions. He spoke to the storm the way you speak to something that answers to you.',
      'And the wind ceased, and there was a great calm.',
      'Not a gradual easing. The text says a great calm, immediately. The same water that was swallowing the boat went flat and silent in a moment.',
      'And he said unto them, Why are ye so fearful? How is it that ye have no faith?',
      'That question can sound harsh until you remember what he had told them at the start. Let us pass over to the other side. They had his word for the destination, and the storm made them forget it.',
      'That is what storms do. They do not usually destroy us. They make us forget what God already said.',
      'And they feared exceedingly, and said one to another, What manner of man is this, that even the wind and the sea obey him?',
      'Notice they were more afraid after the storm stopped than while it was raging. Fear of the storm is normal. Awe at the One who commands it is the beginning of wisdom.',
      'Here is what I want you to carry out of this. Jesus being asleep was never the same as Jesus being absent. He was in the boat the entire time. The storm did not catch him off guard, and it did not change the destination.',
      'You may be in a season where heaven seems quiet and your boat is filling with water. His silence is not indifference. He is not asleep because he does not care. He is at rest because he already knows how this ends.',
      'And whatever he told you before the wind came up is still true after it dies down. You are going to the other side.'
    ],
    prayer: 'Lord Jesus, my boat is filling and heaven has felt quiet. Forgive me for reading Your silence as Your absence. Remind me of what You said before the storm came, and speak Your peace over the wind that is frightening me tonight. I trust You to bring me to the other side. Amen.',
    reflection: [
      'What did God tell you before this storm started that you have stopped repeating to yourself?',
      'Where have you mistaken God\'s silence for God\'s absence?',
      'What would change today if you truly believed the destination was already settled?'
    ]
  },

  {
    id: 'daniel-lions',
    title: 'The Window He Refused to Close',
    subtitle: 'Daniel in the lions\' den',
    series: 'Faith Under Fire',
    speaker: 'Prayer Dome Ministry Team',
    scripture: 'Daniel 6',
    topics: ['prayer', 'courage', 'protection'],
    image: '/assets/sermons/sermon-daniel.jpg',
    tint: 'horizon',
    minutes: 5,
    featured: false,
    summary: 'A law was written specifically to trap one praying man. He read it, went home, and opened his window anyway.',
    keyVerse: 'Now when Daniel knew that the writing was signed, he went into his house; and his windows being open toward Jerusalem, he kneeled upon his knees three times a day, and prayed. — Daniel 6:10',
    story: [
      'Daniel was an old man by this point. He had been carried away from Jerusalem as a teenager and had served under one empire after another, and now under Darius the Mede he had risen to be first among the presidents of the kingdom.',
      'And the king thought to set him over the whole realm. Which is exactly where the trouble started.',
      'The other officials went looking for something to use against him. Then these presidents and princes sought to find occasion against Daniel concerning the kingdom, but they could find none occasion nor fault, because he was faithful.',
      'Think about that. They audited a man\'s entire public career and found nothing. What a thing to have said about you.',
      'So they concluded, We shall not find any occasion against this Daniel, except we find it against him concerning the law of his God.',
      'They could not make him corrupt, so they made his faithfulness illegal. They went to the king and flattered him into signing a decree that for thirty days no one could petition any god or man except the king, on penalty of being cast into the den of lions.',
      'Darius signed it, because it sounded like an honour. According to the law of the Medes and Persians, it could not be changed, not even by the king who wrote it.',
      'Now when Daniel knew that the writing was signed, he went into his house.',
      'And here is the sentence that has carried believers through prison cells and hospital wards for thousands of years. His windows being open toward Jerusalem, he kneeled upon his knees three times a day and prayed and gave thanks before his God, as he did aforetime.',
      'As he did aforetime. That is the whole point. He did not pray louder to make a protest, and he did not pray quieter to stay safe. He did exactly what he had always done.',
      'He could have closed the window. Nobody would have called it a denial. He could have prayed in his heart, in a back room, for thirty days. It was only thirty days.',
      'But Daniel understood that the small compromise you make to survive a season becomes the shape of the rest of your life.',
      'And notice the text says he gave thanks. Faced with a law designed to kill him, the old man knelt and thanked God. That is not stubbornness. That is a man whose habits were built long before the crisis arrived.',
      'They caught him, of course. That was always the plan. And the king was displeased with himself and laboured till the going down of the sun to deliver him, but the law could not be changed.',
      'So they brought Daniel and cast him into the den of lions. And the king said to him, Your God whom you serve continually, he will deliver you.',
      'Then a stone was brought and laid upon the mouth of the den. And the king went to his palace and passed the night fasting, and his sleep went from him.',
      'Here is a strange and beautiful detail. The king could not sleep. Daniel, in the den, presumably could. The man in danger had peace, and the man on the throne had none.',
      'Then the king arose very early in the morning and went in haste unto the den, and cried with a lamentable voice, O Daniel, servant of the living God, is your God able to deliver you from the lions?',
      'Then said Daniel unto the king, O king, live for ever. My God hath sent his angel, and hath shut the lions\' mouths, that they have not hurt me.',
      'God did not stop him being thrown in. Read that again, because it matters. The den still happened. The stone was still rolled over the entrance. God\'s deliverance was not the absence of the lions. It was His presence among them.',
      'Sometimes God keeps us from the fire. Sometimes He keeps us in it. Both are deliverance, and only one of them changes the people watching.',
      'Because the story does not end with Daniel walking out. It ends with Darius writing to every people, nation and language in his empire, that in every dominion of my kingdom men tremble and fear before the God of Daniel.',
      'One old man refused to close one window, and an empire heard about it.',
      'You may be facing a season where being faithful is going to cost you something real. A job, a friendship, a promotion, standing in your family.',
      'Open the window anyway. Kneel where you have always knelt. And give thanks, as you did aforetime.'
    ],
    prayer: 'Faithful God, give me the courage not to close the window. Where I have been quietly compromising to keep the peace, forgive me and restore my habits of prayer. If You keep me from the den, I will thank You. If You meet me inside it, I will thank You still. Amen.',
    reflection: [
      'Is there a window you have quietly closed to avoid trouble?',
      'What spiritual habit do you have "aforetime" that would hold you up in a crisis?',
      'Where might God be asking you to be delivered *in* something rather than *from* it?'
    ]
  },

  {
    id: 'esther-such-a-time',
    title: 'For Such a Time as This',
    subtitle: 'Esther before the king',
    series: 'Ordinary People, Eternal Moments',
    speaker: 'Prayer Dome Ministry Team',
    scripture: 'Esther 4',
    topics: ['courage', 'nation', 'purpose'],
    image: '/assets/sermons/sermon-esther.jpg',
    tint: 'gold',
    minutes: 5,
    featured: false,
    summary: 'An orphan girl became a queen, and then discovered that the crown was never the point.',
    keyVerse: 'Who knoweth whether thou art come to the kingdom for such a time as this? — Esther 4:14',
    story: [
      'Esther was an orphan. Her cousin Mordecai had raised her as his own daughter after her father and mother died. She was a Jewish girl in a foreign empire, a member of a conquered people living far from home.',
      'And through a chain of events she never engineered, she became queen of Persia. She had not campaigned for it. She had been taken into the palace.',
      'Nobody in the court knew she was Jewish. Mordecai had told her not to say, and she had not.',
      'Then a man named Haman rose to power, and Mordecai would not bow to him. Haman was so enraged that he decided killing one man was not enough. He went to the king and secured a decree to destroy all the Jews, young and old, little children and women, in one day.',
      'When Mordecai learned of it, he tore his clothes and put on sackcloth with ashes and went out into the midst of the city and cried with a loud and a bitter cry.',
      'Word reached Esther inside the palace, and she sent clothes out to him, which he refused. Then Mordecai sent her a copy of the decree and a message. Go in unto the king and make supplication for your people.',
      'And Esther sent back the honest answer of a frightened woman. All the king\'s servants know that whosoever shall come unto the king into the inner court who is not called, there is one law of his to put him to death, except such to whom the king shall hold out the golden sceptre.',
      'And then she added the detail that tells you everything about her situation. I have not been called to come in unto the king these thirty days.',
      'She was the queen and she had not been summoned in a month. Her position was real, and it was fragile. Going uninvited could cost her life, and she had no assurance the king even wanted to see her.',
      'Then Mordecai sent back the reply that has been quoted in every generation since.',
      'Think not with thyself that thou shalt escape in the king\'s house more than all the Jews. For if thou altogether holdest thy peace at this time, then shall there enlargement and deliverance arise to the Jews from another place; but thou and thy father\'s house shall be destroyed.',
      'And who knoweth whether thou art come to the kingdom for such a time as this?',
      'There are three things in that message, and we usually only quote the last one.',
      'The first is: your position will not protect you. Esther might have thought the palace walls made her safe. Mordecai told her plainly that they did not.',
      'The second is: God does not need you. Deliverance will arise from another place. That is a humbling thing to hear. God\'s purpose is not waiting on your courage. It will be accomplished with you or without you.',
      'And the third is the invitation. Who knows whether you have come to the kingdom for such a time as this. Not, you were made queen so you could be comfortable. Not, God blessed you so you could enjoy it. But: what if everything you have been given was for this exact moment, and this moment is now?',
      'Esther\'s answer is one of the bravest sentences in scripture. Go, gather together all the Jews that are present in Shushan, and fast ye for me, and neither eat nor drink three days, night or day. I also and my maidens will fast likewise.',
      'Notice what she did first. Before she moved, she called a fast. Courage without prayer is just nerve, and nerve runs out.',
      'And so will I go in unto the king, which is not according to the law. And if I perish, I perish.',
      'That is not fatalism. That is a woman who has counted the cost, prayed it through, and decided that obedience matters more than survival.',
      'She went. The king held out the golden sceptre. Her people were spared, and the empire never forgot it.',
      'Here is the question this story leaves in your hands. What has God placed you near? What room do you have access to that other people do not? What influence, what job, what family, what platform, however small it looks to you?',
      'It was never given to you just so you could be comfortable in it.',
      'Who knows whether you have come to the kingdom for such a time as this.'
    ],
    prayer: 'Lord, thank You for the place You have put me in. Forgive me for treating it as a shelter instead of an assignment. Show me who You have positioned me to speak for, and give me the courage to move — after I have prayed, and not before. If I perish, I perish. Amen.',
    reflection: [
      'What room, relationship or position do you have access to that others do not?',
      'Who might God have positioned you to speak up for?',
      'What are you praying through before you act — or are you relying on nerve alone?'
    ]
  },

  {
    id: 'good-samaritan',
    title: 'Who Is My Neighbour?',
    subtitle: 'The parable of the good Samaritan',
    series: 'Stories Jesus Told',
    speaker: 'Prayer Dome Ministry Team',
    scripture: 'Luke 10:25-37',
    topics: ['love', 'church', 'mission'],
    image: '/assets/sermons/sermon-samaritan.jpg',
    tint: 'dawn',
    minutes: 5,
    featured: false,
    summary: 'A lawyer asked a question designed to limit his responsibility. Jesus answered with a story that removed the limit entirely.',
    keyVerse: 'Go, and do thou likewise. — Luke 10:37',
    story: [
      'A certain lawyer stood up and tempted him, saying, Master, what shall I do to inherit eternal life?',
      'Jesus turned the question around. What is written in the law? How do you read it?',
      'And the man answered well. You shall love the Lord your God with all your heart and with all your soul and with all your strength and with all your mind, and your neighbour as yourself.',
      'And Jesus said, You have answered right. This do, and you shall live.',
      'But he, willing to justify himself, said unto Jesus, And who is my neighbour?',
      'Willing to justify himself. That is the key. He was not asking so he could love more people. He was asking so he could know where the boundary was — who was inside his obligation and who he could walk past with a clear conscience.',
      'We all ask that question in some form. How much is enough? Where does my responsibility end?',
      'And Jesus answered with a story.',
      'A certain man went down from Jerusalem to Jericho and fell among thieves, which stripped him of his raiment and wounded him and departed, leaving him half dead.',
      'That road was real and notorious. Seventeen miles of steep descent through rocky country, full of places for robbers to hide. Everybody listening knew that road.',
      'And by chance there came down a certain priest that way, and when he saw him, he passed by on the other side.',
      'And likewise a Levite, when he was at the place, came and looked on him, and passed by on the other side.',
      'These were not villains. These were the religious professionals, the men who served in the temple. And they both saw him. The text is careful about that. They looked, and then they crossed the road.',
      'There were probably good reasons. Ceremonial law made a priest unclean if he touched a corpse, and from a distance the man may have looked dead. There was a service to get to, a duty to perform, and the robbers might still be nearby.',
      'That is how it usually works. We rarely refuse to help. We just have a reason.',
      'But a certain Samaritan, as he journeyed, came where he was. And when he saw him, he had compassion on him.',
      'Understand who Jesus just put in the story. Jews and Samaritans had despised each other for centuries. They disagreed about worship, about the temple, about ancestry. To a Jewish audience, Samaritan was very close to enemy.',
      'The hero of the story is the one person nobody listening would have wanted help from.',
      'And went to him and bound up his wounds, pouring in oil and wine, and set him on his own beast and brought him to an inn and took care of him.',
      'Look at the cost. His oil and his wine, which were expensive. His own animal, which meant he now walked. His time, because he stayed the night.',
      'And on the morrow, when he departed, he took out two pence and gave them to the host and said, Take care of him, and whatsoever you spend more, when I come again I will repay you.',
      'He wrote an open cheque for a stranger he would probably never see again. He was not being generous with a budget. He was being generous with his whole self.',
      'Then Jesus asked his question. Which now of these three, do you think, was neighbour unto him that fell among the thieves?',
      'And notice that he changed the question. The lawyer asked, who is my neighbour — meaning, who qualifies for my love? Jesus asked, who acted like a neighbour — meaning, what kind of person are you going to be?',
      'The lawyer could not even say the word Samaritan. He said, He that shewed mercy on him.',
      'Then said Jesus unto him, Go, and do thou likewise.',
      'The question of who deserves your love is the wrong question. There is no boundary line to find. There is only the person in front of you, and what you decide to do about them.',
      'Somebody is lying on your road this week. You will have a reason to cross over. Go and do likewise instead.'
    ],
    prayer: 'Lord, I have crossed to the other side of the road with good reasons in my pocket. Give me the eyes to see the person in front of me and the compassion to stop, even when it costs me time and money I had planned for something else. Make me a neighbour. Amen.',
    reflection: [
      'Who have you seen and crossed the road from recently?',
      'What "good reason" do you most often use to avoid getting involved?',
      'Who is the person you would least like to receive help from — and what does that reveal?'
    ]
  },

  {
    id: 'abundant-life',
    title: 'The Abundant Life Jesus Promised',
    subtitle: 'What it really means to have life to the full',
    series: 'Foundations of Faith',
    speaker: 'Pastor Zacheus Simbaya',
    scripture: 'John 10:10',
    topics: ['abundant life', 'purpose', 'blessing', 'zambia'],
    image: '/assets/sermons/sermon-abundant.jpg',
    tint: 'gold',
    minutes: 4,
    featured: true,
    summary: 'Jesus said He came to give life, and life to the full. But what does that actually look like on a Tuesday morning in Zambia?',
    keyVerse: 'The thief cometh not, but for to steal, and to kill, and to destroy: I am come that they might have life, and that they might have it more abundantly. — John 10:10',
    story: [
      'Jesus did not come to make bad people good. He came to make dead people live. There is a difference, and it is a big difference.',
      'A person who is good with some bad habits can improve. A person who is dead in trespasses and sins cannot improve — they need resurrection.',
      'And this is what the world around us does not understand. It thinks Christianity is a list of things you stop doing. It is not. It is the beginning of a life you were not living before.',
      'In our Zambia branch, many of you come to Prayer Dome carrying real burdens. It is evening, it is dark, the sun has set, and the rent is still due, and the child is sick, and the business is slow, and the marriage is tired.',
      'When we open our hearts to Jesus, He restores our peace and gives us strength to overcome every obstacle in abundant grace.'
    ],
    prayer: 'Lord, I receive the abundant life Jesus came to give me. Not money in my account — peace in my heart. Not just good days — a purpose that outlasts my problems. Make me alive today. Amen.',
    reflection: [
      'What area of your life feels most "bare" right now?',
      'Jesus has been in your situation before. What would change if you believed that today?'
    ]
  },

  {
    id: 'zambia-prayer-warrior',
    title: 'Prayer Changes the atmosphere in Zambia',
    subtitle: 'Why we pray at night — the Zambia story',
    series: 'Prayer Fundamentals',
    speaker: 'Pastor Zacheus Simbaya',
    scripture: 'Psalm 91:1-2',
    topics: ['prayer', 'zambia', 'night service', 'intercession'],
    image: '/assets/sermons/sermon-prayer.jpg',
    tint: 'dawn',
    minutes: 5,
    featured: false,
    summary: 'Every night in Lusaka and beyond, Prayer Dome Zambia gathers to pray. Here is why it matters and how to join.',
    keyVerse: 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust. — Psalm 91:1-2',
    story: [
      'There is a difference between praying in the morning when you are fresh and everyone is watching — and praying at night when you are tired, the house is quiet, and only God receives the effort.',
      'In our Zambia night prayer gathers, believers intercede not just for personal breakthroughs, but for the healing of communities and families.',
      'Night prayer trains our spirits to remain watchful. While others sleep, intercessors stand upon the watchtower to declare protection over their homes.',
      'When you pray consistently, the spiritual atmosphere around your house changes. Depression lifts, fear vanishes, and divine peace takes over.',
      'Do not underestimate the power of a quiet prayer spoken in faith. God sees in secret and He rewards openly.'
    ],
    prayer: 'Father, teach me to pray at night when the world is asleep and my only audience is You. Let my prayers be a covering over my family, my church, and my nation. Zambia, be covered in prayer. Amen.',
    reflection: [
      'What time do you pray when no one is watching?',
      'Who in your family needs a prayer covering tonight?'
    ]
  }
];

/* ==========================================================================
 * Helpers
 * ======================================================================== */

/** One sermon by id. */
function pdSermon(id) {
  return PD_SERMONS.find(function (s) { return s.id === id; }) || null;
}

/** Sermons tagged with a topic. */
function pdSermonsByTopic(topic) {
  return PD_SERMONS.filter(function (s) {
    return (s.topics || []).indexOf(topic) !== -1;
  });
}

/** Every distinct series, in the order they first appear. */
function pdSermonSeries() {
  var seen = [];
  PD_SERMONS.forEach(function (s) {
    if (s.series && seen.indexOf(s.series) === -1) seen.push(s.series);
  });
  return seen;
}

/** Free-text search over title, summary, scripture and series. */
function pdSearchSermons(query) {
  var q = String(query || '').trim().toLowerCase();
  if (!q) return PD_SERMONS.slice();
  return PD_SERMONS.filter(function (s) {
    return [s.title, s.subtitle, s.summary, s.scripture, s.series, s.speaker]
      .concat(s.topics || [])
      .join(' ')
      .toLowerCase()
      .indexOf(q) !== -1;
  });
}

/** Rough word count of the narration, used for the reading-time badge. */
function pdSermonWordCount(sermon) {
  if (!sermon || !sermon.story) return 0;
  return sermon.story.join(' ').trim().split(/\s+/).filter(Boolean).length;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PD_SERMONS: PD_SERMONS,
    pdSermon: pdSermon,
    pdSermonsByTopic: pdSermonsByTopic,
    pdSermonSeries: pdSermonSeries,
    pdSearchSermons: pdSearchSermons,
    pdSermonWordCount: pdSermonWordCount
  };
}
