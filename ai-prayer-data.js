/*
 * Prayer Dome — Prayer Assistant knowledge base
 * ------------------------------------------------------------------
 * Curated topical library of scriptures, prayer points and encouragement.
 * All scripture text is King James Version (public domain).
 *
 * Runs entirely in the browser: no API key, no backend, no per-request cost,
 * and it keeps working offline once the service worker has cached it.
 *
 * To add a topic, append an object to PD_TOPICS. `match` holds the words and
 * phrases the matcher scores against — include natural phrasings people
 * actually type ("I can't sleep", "my marriage is falling apart"), not just
 * single keywords.
 */

const PD_TOPICS = [
  {
    id: 'fear',
    title: 'Fear & Anxiety',
    icon: 'fa-shield-halved',
    colour: '#3b82f6',
    match: ['fear', 'afraid', 'scared', 'terrified', 'anxiety', 'anxious', 'worry', 'worried',
            'panic', 'nervous', 'dread', 'fearful', 'overwhelmed', 'cant sleep', "can't sleep",
            'insomnia', 'restless', 'stress', 'stressed', 'tense', 'on edge', 'what if'],
    opening: 'Fear is loud, but it is not the final word over your life. God has not handed you a spirit of fear — and He is not asking you to be brave on your own strength.',
    verses: [
      { ref: 'Isaiah 41:10', text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.' },
      { ref: '2 Timothy 1:7', text: 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.' },
      { ref: 'Philippians 4:6-7', text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.' },
      { ref: 'Psalm 34:4', text: 'I sought the LORD, and he heard me, and delivered me from all my fears.' },
      { ref: '1 Peter 5:7', text: 'Casting all your care upon him; for he careth for you.' },
      { ref: 'Psalm 56:3', text: 'What time I am afraid, I will trust in thee.' }
    ],
    points: [
      'Name the fear out loud before God — He is not shocked by it, and what you name loses its grip.',
      'Ask the Holy Spirit to replace the spirit of fear with power, love and a sound mind.',
      'Hand over the specific outcome you are trying to control, and ask for peace that guards your heart and mind.',
      'Pray for rest — that your sleep would be sweet and your thoughts would quiet down.',
      'Thank God in advance for how He will show up, before you can see it.'
    ],
    prayer: 'Father, I come to You with the fear I have been carrying. You said You have not given me a spirit of fear, so I refuse it in Jesus\' name. Strengthen me, help me, and uphold me with Your right hand. Let Your peace — the peace that passes understanding — guard my heart and my mind right now. I choose to trust You with what I cannot control. Amen.',
    encouragement: 'You do not have to feel fearless to be walking in faith. Faith is simply bringing the fear to God instead of feeding it. He is holding you.'
  },
  {
    id: 'grief',
    title: 'Grief & Loss',
    icon: 'fa-dove',
    colour: '#8b5cf6',
    match: ['grief', 'grieving', 'died', 'death', 'lost my', 'passed away', 'funeral', 'mourning',
            'mourn', 'bereaved', 'bereavement', 'miss him', 'miss her', 'miss them', 'widow',
            'widower', 'miscarriage', 'lost a child', 'heartbroken', 'loss'],
    opening: 'There is no timetable for grief, and God never asks you to rush it. He is close to you in this — not at a distance waiting for you to recover.',
    verses: [
      { ref: 'Psalm 34:18', text: 'The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.' },
      { ref: 'Matthew 5:4', text: 'Blessed are they that mourn: for they shall be comforted.' },
      { ref: 'Revelation 21:4', text: 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.' },
      { ref: 'Psalm 147:3', text: 'He healeth the broken in heart, and bindeth up their wounds.' },
      { ref: '2 Corinthians 1:3-4', text: 'Blessed be God... the Father of mercies, and the God of all comfort; who comforteth us in all our tribulation.' },
      { ref: 'John 11:35', text: 'Jesus wept.' }
    ],
    points: [
      'Tell God honestly what you are feeling — grief, anger, confusion. He can hold all of it.',
      'Ask for the comfort of the Holy Spirit, the Comforter Jesus promised.',
      'Pray for the moments that ambush you — the empty chair, the anniversary, the familiar song.',
      'Ask God to send people who will sit with you rather than explain your loss away.',
      'Pray for grace to get through today only. Not the whole road — just today.'
    ],
    prayer: 'Father of all comfort, my heart is broken and You know it. I do not have the words, so I bring You my tears instead. Draw near to me the way You promised to draw near to the broken-hearted. Bind up this wound in Your time and in Your way. Hold me together on the days I cannot hold myself together. And thank You that a day is coming when You will wipe away every tear. Amen.',
    encouragement: 'Jesus wept at a graveside even though He knew resurrection was moments away. Your tears are not a failure of faith — they are love with nowhere to go.'
  },
  {
    id: 'provision',
    title: 'Provision & Finances',
    icon: 'fa-wheat-awn',
    colour: '#d4af37',
    match: ['money', 'financial', 'finances', 'provision', 'provide', 'broke', 'debt', 'rent',
            'bills', 'poverty', 'poor', 'job', 'unemployed', 'jobless', 'employment', 'salary',
            'business', 'income', 'school fees', 'fees', 'need money', 'struggling financially',
            'cant afford', "can't afford", 'lack', 'food'],
    opening: 'God is not distant from your practical needs. The same God who counts the hairs on your head knows about the bill that is due.',
    verses: [
      { ref: 'Philippians 4:19', text: 'But my God shall supply all your need according to his riches in glory by Christ Jesus.' },
      { ref: 'Matthew 6:31-33', text: 'Therefore take no thought, saying, What shall we eat? ... But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.' },
      { ref: 'Psalm 37:25', text: 'I have been young, and now am old; yet have I not seen the righteous forsaken, nor his seed begging bread.' },
      { ref: 'Deuteronomy 8:18', text: 'But thou shalt remember the LORD thy God: for it is he that giveth thee power to get wealth.' },
      { ref: 'Psalm 23:1', text: 'The LORD is my shepherd; I shall not want.' },
      { ref: 'Luke 6:38', text: 'Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over.' }
    ],
    points: [
      'Bring the exact figure and the exact deadline to God — be specific, not vague.',
      'Ask for open doors: jobs, contracts, customers, favour with the right people.',
      'Pray for wisdom in managing what you already have.',
      'Renounce panic and the pressure to compromise your integrity for money.',
      'Ask God to make you a channel of provision to someone else, even in your own lack.'
    ],
    prayer: 'Lord, You are Jehovah Jireh, my provider. You know exactly what I owe and exactly what I need. I bring it to You honestly and I ask You to supply according to Your riches in glory, not according to my bank balance. Open doors no man can shut. Give me wisdom with what is already in my hands. Keep me from panic and from compromise. I seek Your kingdom first and I trust You to add the rest. Amen.',
    encouragement: 'Provision often arrives as an opportunity rather than a miracle cheque. Stay alert — the answer may knock on the door looking like ordinary work.'
  },
  {
    id: 'healing',
    title: 'Healing & Sickness',
    icon: 'fa-heart-pulse',
    colour: '#ef4444',
    match: ['heal', 'healing', 'sick', 'sickness', 'illness', 'ill', 'disease', 'cancer', 'pain',
            'hospital', 'surgery', 'diagnosis', 'diagnosed', 'doctor', 'recovery', 'body', 'health',
            'unwell', 'chronic', 'infection', 'operation', 'treatment', 'not well'],
    opening: 'By His stripes you were healed. Bring your body to God as boldly as you bring your soul — He made both.',
    verses: [
      { ref: 'Isaiah 53:5', text: 'But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed.' },
      { ref: 'Jeremiah 30:17', text: 'For I will restore health unto thee, and I will heal thee of thy wounds, saith the LORD.' },
      { ref: 'James 5:14-15', text: 'Is any sick among you? let him call for the elders of the church; and let them pray over him... and the prayer of faith shall save the sick, and the Lord shall raise him up.' },
      { ref: 'Psalm 103:2-3', text: 'Bless the LORD, O my soul, and forget not all his benefits: who forgiveth all thine iniquities; who healeth all thy diseases.' },
      { ref: 'Exodus 15:26', text: 'I am the LORD that healeth thee.' },
      { ref: 'Matthew 8:16-17', text: 'And he cast out the spirits with his word, and healed all that were sick.' }
    ],
    points: [
      'Speak healing over the specific part of the body that is affected.',
      'Pray for the doctors, nurses and every hand involved in the treatment.',
      'Ask for strength and peace for the day-to-day of being unwell, not only for the cure.',
      'Pray against fear of the diagnosis — fear weakens the body further.',
      'Ask God for wisdom about treatment, rest, diet and next steps.'
    ],
    prayer: 'Lord, You are Jehovah Rapha, the God who heals. I bring this body before You — You formed it and You know every cell of it. I speak Your healing over it in Jesus\' name. Guide the hands of every doctor and nurse. Give me strength for each day and peace that steadies me. Whatever the road looks like, be my healer and my keeper. Amen.',
    encouragement: 'Praying for healing and following medical advice are not competing acts of faith. God works through both. Keep praying, and keep your appointments.'
  },
  {
    id: 'family',
    title: 'Family & Home',
    icon: 'fa-house-chimney-heart',
    colour: '#22c55e',
    match: ['family', 'my children', 'my child', 'son', 'daughter', 'kids', 'parents', 'mother',
            'father', 'mom', 'dad', 'brother', 'sister', 'home', 'household', 'relatives',
            'pray for my family', 'my son', 'my daughter', 'teenager'],
    opening: 'Your family is not a project you have to fix alone. You can stand in the gap for every name under your roof.',
    verses: [
      { ref: 'Joshua 24:15', text: 'But as for me and my house, we will serve the LORD.' },
      { ref: 'Acts 16:31', text: 'Believe on the Lord Jesus Christ, and thou shalt be saved, and thy house.' },
      { ref: 'Proverbs 22:6', text: 'Train up a child in the way he should go: and when he is old, he will not depart from it.' },
      { ref: 'Isaiah 54:13', text: 'And all thy children shall be taught of the LORD; and great shall be the peace of thy children.' },
      { ref: 'Psalm 127:1', text: 'Except the LORD build the house, they labour in vain that build it.' },
      { ref: '3 John 1:2', text: 'Beloved, I wish above all things that thou mayest prosper and be in health, even as thy soul prospereth.' }
    ],
    points: [
      'Call each family member by name before God.',
      'Pray for peace in the home — that strife, silence and bitterness would break.',
      'Ask for protection over every coming and going.',
      'Pray for the children: their faith, friendships, choices and future.',
      'Ask God to make you the kind of presence in your home that reflects Him.'
    ],
    prayer: 'Father, I bring my family before You by name. Build this house — because if You do not build it, we labour in vain. Let peace rule where there has been tension. Protect every going out and coming in. Teach my children Yourself, and let great be their peace. Make me patient, kind and steady at home. As for me and my house, we will serve the Lord. Amen.',
    encouragement: 'You may be the first person in your family to pray like this. That is not a small thing — one praying member can change a bloodline.'
  },
  {
    id: 'marriage',
    title: 'Marriage & Relationships',
    icon: 'fa-ring',
    colour: '#ec4899',
    match: ['marriage', 'married', 'husband', 'wife', 'spouse', 'divorce', 'separated', 'affair',
            'unfaithful', 'my relationship', 'boyfriend', 'girlfriend', 'engaged', 'fiance',
            'life partner', 'single', 'lonely in my marriage', 'falling apart', 'we argue',
            'love life', 'looking for a wife', 'looking for a husband'],
    opening: 'God cares about the covenant you are in and the person you will become inside it. Bring the whole relationship to Him — the good and the raw.',
    verses: [
      { ref: 'Ecclesiastes 4:12', text: 'And if one prevail against him, two shall withstand him; and a threefold cord is not quickly broken.' },
      { ref: '1 Corinthians 13:4-7', text: 'Charity suffereth long, and is kind... beareth all things, believeth all things, hopeth all things, endureth all things.' },
      { ref: 'Ephesians 4:32', text: 'And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ\'s sake hath forgiven you.' },
      { ref: 'Mark 10:9', text: 'What therefore God hath joined together, let not man put asunder.' },
      { ref: 'Proverbs 18:22', text: 'Whoso findeth a wife findeth a good thing, and obtaineth favour of the LORD.' },
      { ref: 'Colossians 3:14', text: 'And above all these things put on charity, which is the bond of perfectness.' }
    ],
    points: [
      'Pray for your own heart first — softness, humility, and the willingness to go first.',
      'Ask God to restore honest communication where words have become weapons or gone silent.',
      'Pray against every third party, interference and influence working to divide.',
      'Ask for forgiveness to flow both ways, and for old wounds to actually close.',
      'Pray for friendship to be rebuilt, not just peace to be kept.'
    ],
    prayer: 'Lord, You are the third strand in this cord and I need You holding it. Soften my heart before I ask You to soften anyone else\'s. Restore honest, kind communication between us. Break every influence working to divide what You have joined. Teach us to forgive the way You forgive us. Rebuild not just our peace but our friendship. Amen.',
    encouragement: 'Praying for your marriage instead of only complaining about it is already a shift in the right direction. Keep going — and where there is abuse or danger, get real help; that is wisdom, not faithlessness.'
  },
  {
    id: 'guidance',
    title: 'Direction & Decisions',
    icon: 'fa-compass',
    colour: '#0ea5e9',
    match: ['direction', 'guidance', 'guide', 'decision', 'decide', 'confused', 'lost', 'purpose',
            'calling', 'career', 'which way', 'what should i do', 'dont know what', "don't know what",
            'future', 'choice', 'crossroads', 'move', 'relocate', 'course', 'study', 'university'],
    opening: 'God is not hiding His will from you to test how clever you are. He leads those who are willing to be led.',
    verses: [
      { ref: 'Proverbs 3:5-6', text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.' },
      { ref: 'Psalm 32:8', text: 'I will instruct thee and teach thee in the way which thou shalt go: I will guide thee with mine eye.' },
      { ref: 'James 1:5', text: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.' },
      { ref: 'Isaiah 30:21', text: 'And thine ears shall hear a word behind thee, saying, This is the way, walk ye in it.' },
      { ref: 'Psalm 119:105', text: 'Thy word is a lamp unto my feet, and a light unto my path.' },
      { ref: 'Jeremiah 29:11', text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.' }
    ],
    points: [
      'Lay the actual options before God, and be honest about which one you are already leaning toward.',
      'Ask for wisdom — He gives it freely and without scolding you for needing it.',
      'Pray for peace to settle on the right path and unease to mark the wrong one.',
      'Ask God to close doors firmly if they are not His will, even doors you want.',
      'Pray for godly counsel from people who will tell you the truth.'
    ],
    prayer: 'Father, I am at a crossroads and I do not want to lean on my own understanding. I lay every option before You. Give me the wisdom You promised to give freely. Let Your peace rest on the right way, and let me hear that word behind me saying, "This is the way, walk in it." Shut the doors that are not Yours, even the ones I want. I trust You to direct my path. Amen.',
    encouragement: 'Guidance usually comes one step at a time, not as a full map. Take the step you can see — the next one tends to appear from there.'
  },
  {
    id: 'forgiveness',
    title: 'Forgiveness & Guilt',
    icon: 'fa-hands-holding-circle',
    colour: '#8b5cf6',
    match: ['forgive', 'forgiveness', 'guilt', 'guilty', 'shame', 'ashamed', 'sin', 'sinned',
            'mistake', 'regret', 'condemned', 'condemnation', 'unworthy', 'dirty', 'failed god',
            'bitter', 'bitterness', 'hurt me', 'betrayed', 'cant forgive', "can't forgive",
            'resentment', 'angry at'],
    opening: 'Whether you need to receive forgiveness or release it, both are found at the same cross.',
    verses: [
      { ref: '1 John 1:9', text: 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.' },
      { ref: 'Psalm 103:12', text: 'As far as the east is from the west, so far hath he removed our transgressions from us.' },
      { ref: 'Romans 8:1', text: 'There is therefore now no condemnation to them which are in Christ Jesus.' },
      { ref: 'Isaiah 1:18', text: 'Though your sins be as scarlet, they shall be as white as snow.' },
      { ref: 'Matthew 6:14', text: 'For if ye forgive men their trespasses, your heavenly Father will also forgive you.' },
      { ref: 'Colossians 3:13', text: 'Forbearing one another, and forgiving one another... even as Christ forgave you, so also do ye.' }
    ],
    points: [
      'Confess plainly — no minimising and no excessive self-punishment. Just the truth.',
      'Receive the forgiveness rather than negotiating for it. It is already purchased.',
      'Name the person you are struggling to forgive, and say honestly what they did.',
      'Ask God for the willingness to forgive, if you do not yet have the ability.',
      'Break agreement with shame — conviction leads you to God, shame drives you from Him.'
    ],
    prayer: 'Father, I confess what I have done and I am not going to dress it up. You said if I confess, You are faithful and just to forgive and to cleanse me — so I receive that now instead of arguing with it. And where I am holding something against someone else, I ask You for the willingness to release it. Take the bitterness out of my heart before it takes root. There is no condemnation for me in Christ. Amen.',
    encouragement: 'Forgiving someone is not saying it did not matter. It is handing the debt to God so you stop paying interest on it.'
  },
  {
    id: 'depression',
    title: 'Depression & Despair',
    icon: 'fa-cloud-sun',
    colour: '#64748b',
    match: ['depression', 'depressed', 'hopeless', 'no hope', 'despair', 'give up', 'giving up',
            'empty', 'numb', 'worthless', 'pointless', 'no point', 'darkness', 'tired of life',
            'sad', 'sadness', 'cant go on', "can't go on", 'exhausted', 'burnt out', 'burnout',
            'suicidal', 'end it all', 'kill myself', 'no reason to live'],
    crisis: true,
    opening: 'What you are carrying is heavy and it is real. God is not disappointed in you for struggling — He is near, especially now.',
    verses: [
      { ref: 'Psalm 42:11', text: 'Why art thou cast down, O my soul? and why art thou disquieted within me? hope thou in God: for I shall yet praise him, who is the health of my countenance, and my God.' },
      { ref: 'Psalm 40:1-2', text: 'He brought me up also out of an horrible pit, out of the miry clay, and set my feet upon a rock, and established my goings.' },
      { ref: 'Isaiah 61:3', text: 'To give unto them beauty for ashes, the oil of joy for mourning, the garment of praise for the spirit of heaviness.' },
      { ref: 'Matthew 11:28', text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.' },
      { ref: 'Psalm 34:18', text: 'The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.' },
      { ref: 'Lamentations 3:22-23', text: 'It is of the LORD\'s mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.' }
    ],
    points: [
      'Say the honest thing to God, even if it is "I do not want to be here." The Psalms are full of that language.',
      'Ask for the garment of praise in exchange for the spirit of heaviness.',
      'Pray for one small mercy for today — not the whole recovery.',
      'Ask God to send one safe person you can tell the truth to.',
      'Pray for rest, and for the willingness to accept help.'
    ],
    prayer: 'Lord, I am worn down and I do not have much left. I am not going to pretend in front of You. You said You are near the broken-hearted, so be near to me now. Lift me out of this pit and set my feet on solid ground. Give me beauty for ashes and the oil of joy for this mourning. Send me help, send me people, and hold me together until morning comes. Your mercies are new every morning — I am waiting on that. Amen.',
    encouragement: 'Please do not carry this alone. Tell a pastor, a doctor or someone you trust today — reaching for help is an act of faith, not a lack of it. If you are thinking of harming yourself, contact your local emergency service or a crisis line right now.'
  },
  {
    id: 'strength',
    title: 'Strength & Endurance',
    icon: 'fa-mountain-sun',
    colour: '#f59e0b',
    match: ['strength', 'strong', 'weak', 'weary', 'tired', 'endure', 'endurance', 'persevere',
            'keep going', 'struggling', 'hard season', 'difficult', 'trials', 'trial', 'pressure',
            'cant take it', "can't take it", 'too much', 'breaking point'],
    opening: 'You were never meant to run this on your own reserves. His strength shows up best exactly where yours runs out.',
    verses: [
      { ref: 'Isaiah 40:31', text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.' },
      { ref: 'Philippians 4:13', text: 'I can do all things through Christ which strengtheneth me.' },
      { ref: '2 Corinthians 12:9', text: 'My grace is sufficient for thee: for my strength is made perfect in weakness.' },
      { ref: 'Nehemiah 8:10', text: 'The joy of the LORD is your strength.' },
      { ref: 'Galatians 6:9', text: 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.' },
      { ref: 'Psalm 46:1', text: 'God is our refuge and strength, a very present help in trouble.' }
    ],
    points: [
      'Admit to God exactly where you have run out. Weakness is where His strength is made perfect.',
      'Ask for renewed strength for today\'s portion, not the whole journey.',
      'Pray against weariness in doing good — that you would not quit just before the harvest.',
      'Ask for the joy of the Lord, because that joy is literally your strength.',
      'Pray for people to help carry what you were not built to carry alone.'
    ],
    prayer: 'Lord, I am tired and I am not going to pretend otherwise. You said those who wait on You renew their strength — so I am waiting on You now. Your grace is sufficient for me and Your strength is made perfect in my weakness. Give me what I need for today. Let me not grow weary in doing good, because in due season I will reap if I do not faint. Be my refuge and my strength. Amen.',
    encouragement: 'Endurance is not the absence of exhaustion. It is showing up one more day. You have made it through every hard day so far — that record is unbroken.'
  },
  {
    id: 'protection',
    title: 'Protection & Safety',
    icon: 'fa-shield-heart',
    colour: '#0d9488',
    match: ['protection', 'protect', 'safety', 'safe', 'danger', 'dangerous', 'attack', 'enemies',
            'enemy', 'witchcraft', 'evil', 'accident', 'travel', 'journey', 'journeys',
            'spiritual attack', 'demonic', 'oppression', 'threat', 'harm', 'violence'],
    opening: 'You dwell in the secret place of the Most High. That is not poetry — it is your actual address.',
    verses: [
      { ref: 'Psalm 91:1-2', text: 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.' },
      { ref: 'Isaiah 54:17', text: 'No weapon that is formed against thee shall prosper; and every tongue that shall rise against thee in judgment thou shalt condemn.' },
      { ref: 'Psalm 121:7-8', text: 'The LORD shall preserve thee from all evil: he shall preserve thy soul. The LORD shall preserve thy going out and thy coming in.' },
      { ref: '2 Thessalonians 3:3', text: 'But the Lord is faithful, who shall stablish you, and keep you from evil.' },
      { ref: 'Psalm 34:7', text: 'The angel of the LORD encampeth round about them that fear him, and delivereth them.' },
      { ref: 'Proverbs 18:10', text: 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe.' }
    ],
    points: [
      'Cover yourself, your household and your property in the blood of Jesus.',
      'Declare that no weapon formed against you shall prosper.',
      'Pray specifically over travel, work, and every going out and coming in.',
      'Ask for discernment to recognise danger early and avoid it.',
      'Pray for those who wish you harm — that God would deal with them and change them.'
    ],
    prayer: 'Father, I take my place in the secret place of the Most High and abide under Your shadow. You are my refuge and my fortress. I declare that no weapon formed against me shall prosper. Preserve my going out and my coming in. Let Your angels encamp around me and everyone in my household. Give me discernment to see danger before it reaches me. The name of the Lord is my strong tower and I run into it. Amen.',
    encouragement: 'Praying for protection is not fear — it is the sensible act of a person who knows where their safety comes from.'
  },
  {
    id: 'thanksgiving',
    title: 'Thanksgiving & Praise',
    icon: 'fa-hands-clapping',
    colour: '#22c55e',
    match: ['thank', 'thanks', 'thanksgiving', 'grateful', 'gratitude', 'praise', 'worship',
            'testimony', 'answered', 'god did it', 'breakthrough', 'celebrate', 'happy', 'joy',
            'blessed', 'good news'],
    opening: 'Thanksgiving is not just good manners — it is warfare. It shifts your eyes from what is missing to who is faithful.',
    verses: [
      { ref: 'Psalm 100:4', text: 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.' },
      { ref: '1 Thessalonians 5:18', text: 'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.' },
      { ref: 'Psalm 103:1-2', text: 'Bless the LORD, O my soul: and all that is within me, bless his holy name. Bless the LORD, O my soul, and forget not all his benefits.' },
      { ref: 'Psalm 34:1', text: 'I will bless the LORD at all times: his praise shall continually be in my mouth.' },
      { ref: 'James 1:17', text: 'Every good gift and every perfect gift is from above, and cometh down from the Father of lights.' },
      { ref: 'Psalm 107:1', text: 'O give thanks unto the LORD, for he is good: for his mercy endureth for ever.' }
    ],
    points: [
      'Name three specific things God has done recently — specifics, not generalities.',
      'Thank Him for the prayers He answered with "no" that you now understand.',
      'Bless His name for who He is, not only for what He has given.',
      'Share the testimony — your story is someone else\'s evidence.',
      'Ask that gratitude would become your default posture, not just your reaction to good news.'
    ],
    prayer: 'Lord, I enter Your gates with thanksgiving and Your courts with praise. Thank You for what You have done — the things I asked for and the things I never thought to ask for. Bless Your holy name with everything in me. Let me not forget Your benefits. Make gratitude my default and not just my reaction. You are good and Your mercy endures forever. Amen.',
    encouragement: 'Write the testimony down somewhere. Future-you is going to need the reminder on a harder day.'
  },
  {
    id: 'faith',
    title: 'Faith & Doubt',
    icon: 'fa-seedling',
    colour: '#15803d',
    match: ['faith', 'doubt', 'doubting', 'unbelief', 'believe', 'trust god', 'is god real',
            'where is god', 'god silent', 'unanswered', 'backslid', 'backslidden', 'far from god',
            'spiritual dryness', 'dry', 'lukewarm', 'lost my faith'],
    opening: 'Doubt is not the opposite of faith — indifference is. The fact that you are wrestling means you have not let go.',
    verses: [
      { ref: 'Mark 9:24', text: 'Lord, I believe; help thou mine unbelief.' },
      { ref: 'Hebrews 11:1', text: 'Now faith is the substance of things hoped for, the evidence of things not seen.' },
      { ref: 'Romans 10:17', text: 'So then faith cometh by hearing, and hearing by the word of God.' },
      { ref: 'Matthew 17:20', text: 'If ye have faith as a grain of mustard seed... nothing shall be impossible unto you.' },
      { ref: 'Isaiah 55:8-9', text: 'For my thoughts are not your thoughts, neither are your ways my ways, saith the LORD.' },
      { ref: 'Jeremiah 29:13', text: 'And ye shall seek me, and find me, when ye shall search for me with all your heart.' }
    ],
    points: [
      'Bring the doubt to God rather than away from Him — He can handle the questions.',
      'Pray the honest prayer of Mark 9: "Lord I believe, help my unbelief."',
      'Ask for faith to be built through the Word — faith comes by hearing.',
      'Remember and rehearse what God has already done in your life.',
      'Ask for one fresh encounter with Him, not just more information about Him.'
    ],
    prayer: 'Lord, I believe — help my unbelief. I am bringing my questions to You instead of running from You with them. Build my faith through Your Word. Remind me of what You have already done that I have started to forget. Your ways are higher than mine, and I do not need to understand everything to trust You. Meet me afresh. I am seeking You with my whole heart, and You promised I would find You. Amen.',
    encouragement: 'Some of the strongest believers you know have been exactly where you are. Faith that has survived doubt tends to be the kind that holds.'
  },
  {
    id: 'salvation',
    title: 'Salvation & New Life',
    icon: 'fa-cross',
    colour: '#b45309',
    match: ['salvation', 'saved', 'born again', 'give my life', 'accept jesus', 'become a christian',
            'repent', 'repentance', 'start over', 'new life', 'how do i get saved', 'unsaved',
            'my friend is not saved', 'lead someone to christ'],
    opening: 'This is the simplest and biggest prayer there is. God is not making you qualify — He is inviting you home.',
    verses: [
      { ref: 'Romans 10:9', text: 'That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.' },
      { ref: 'John 3:16', text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
      { ref: '2 Corinthians 5:17', text: 'Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.' },
      { ref: 'Ephesians 2:8-9', text: 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: not of works, lest any man should boast.' },
      { ref: 'Revelation 3:20', text: 'Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him.' },
      { ref: 'John 1:12', text: 'But as many as received him, to them gave he power to become the sons of God.' }
    ],
    points: [
      'Admit you need a saviour — that is the whole entry requirement.',
      'Believe that Jesus died and rose again for you specifically.',
      'Confess Him as Lord out loud. Words matter.',
      'Ask for a new heart and a clean start.',
      'Tell one person, and find a church family to grow in.'
    ],
    prayer: 'Lord Jesus, I believe You are the Son of God, that You died for me and that God raised You from the dead. I have lived my own way and I need You. Forgive me and wash me clean. I confess You as my Lord and I open the door of my life to You. Make me new — old things passed away, all things become new. Thank You for receiving me. From today, I am Yours. Amen.',
    encouragement: 'If you prayed that and meant it, heaven is celebrating over you right now. Tell someone at Prayer Dome — we would love to walk this out with you.'
  },
  {
    id: 'work',
    title: 'Work & Study',
    icon: 'fa-briefcase',
    colour: '#6366f1',
    match: ['work', 'workplace', 'boss', 'colleague', 'promotion', 'interview', 'exam', 'exams',
            'test', 'school', 'studies', 'studying', 'student', 'results', 'graduation', 'thesis',
            'project', 'deadline', 'performance', 'fired', 'retrenched', 'laid off'],
    opening: 'Your work and your study are not separate from your walk with God. He is Lord of the ordinary Tuesday too.',
    verses: [
      { ref: 'Colossians 3:23', text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.' },
      { ref: 'Proverbs 22:29', text: 'Seest thou a man diligent in his business? he shall stand before kings.' },
      { ref: 'Daniel 1:17', text: 'God gave them knowledge and skill in all learning and wisdom.' },
      { ref: 'Psalm 90:17', text: 'And let the beauty of the LORD our God be upon us: and establish thou the work of our hands upon us.' },
      { ref: 'Joshua 1:8', text: 'Thou shalt meditate therein day and night... for then thou shalt make thy way prosperous, and then thou shalt have good success.' },
      { ref: 'Proverbs 16:3', text: 'Commit thy works unto the LORD, and thy thoughts shall be established.' }
    ],
    points: [
      'Commit the specific task, exam or interview to God by name.',
      'Ask for knowledge, skill, recall and clarity of mind.',
      'Pray for favour with those who make decisions about you.',
      'Pray for integrity under pressure — that you will not cut corners.',
      'Ask God to establish the work of your hands so it lasts.'
    ],
    prayer: 'Lord, I commit this work to You. Give me knowledge, skill and understanding the way You gave it to Daniel. Steady my mind and sharpen my recall. Grant me favour with those who decide. Keep me honest when it would be easier not to be. Let me work heartily as unto You and not unto men. Establish the work of my hands. Amen.',
    encouragement: 'Pray hard and prepare hard. Faith and diligence are teammates, not rivals.'
  },
  {
    id: 'addiction',
    title: 'Addiction & Freedom',
    icon: 'fa-unlock',
    colour: '#dc2626',
    match: ['addiction', 'addicted', 'alcohol', 'drinking', 'drunk', 'drugs', 'smoking',
            'pornography', 'porn', 'lust', 'gambling', 'habit', 'bondage', 'struggle with',
            'cant stop', "can't stop", 'relapse', 'temptation', 'tempted', 'chains'],
    opening: 'Whom the Son sets free is free indeed. This battle is not proof that you are beyond help — it is the ground where grace does its work.',
    verses: [
      { ref: 'John 8:36', text: 'If the Son therefore shall make you free, ye shall be free indeed.' },
      { ref: '1 Corinthians 10:13', text: 'There hath no temptation taken you but such as is common to man: but God is faithful, who will not suffer you to be tempted above that ye are able; but will with the temptation also make a way to escape.' },
      { ref: '2 Corinthians 5:17', text: 'Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.' },
      { ref: 'Romans 6:14', text: 'For sin shall not have dominion over you: for ye are not under the law, but under grace.' },
      { ref: 'Galatians 5:1', text: 'Stand fast therefore in the liberty wherewith Christ hath made us free.' },
      { ref: 'James 5:16', text: 'Confess your faults one to another, and pray one for another, that ye may be healed.' }
    ],
    points: [
      'Confess it honestly — secrecy is what keeps the cycle alive.',
      'Ask God to break the dominion of this thing over you in Jesus\' name.',
      'Pray for the way of escape He promised, and the alertness to take it.',
      'Ask for one accountability partner you can be fully honest with.',
      'Pray for the triggers — the times, places and feelings that set it off.'
    ],
    prayer: 'Father, I am bringing this into the light instead of hiding it. I confess it to You honestly. Sin shall not have dominion over me because I am under grace. Break these chains in Jesus\' name. When temptation comes, show me the way of escape and give me the strength to actually take it. Send me someone I can be accountable to. Whom the Son sets free is free indeed — set me free and help me stand. Amen.',
    encouragement: 'Freedom is usually a road, not a switch. A relapse does not cancel your progress — get back up, tell someone, and keep walking. Consider speaking to a pastor or counsellor as part of the answer.'
  },
  {
    id: 'church',
    title: 'Church & Ministry',
    icon: 'fa-church',
    colour: '#15803d',
    match: ['church', 'ministry', 'pastor', 'revival', 'congregation', 'serve', 'serving',
            'volunteer', 'church leaders', 'leadership', 'my calling', 'preach', 'worship team',
            'cell group', 'outreach', 'missions', 'evangelism', 'souls'],
    opening: 'Praying for the church is praying for the body you belong to. Your intercession holds up more than you can see.',
    verses: [
      { ref: 'Matthew 16:18', text: 'Upon this rock I will build my church; and the gates of hell shall not prevail against it.' },
      { ref: 'Acts 2:42', text: 'And they continued stedfastly in the apostles\' doctrine and fellowship, and in breaking of bread, and in prayers.' },
      { ref: 'Ephesians 4:12', text: 'For the perfecting of the saints, for the work of the ministry, for the edifying of the body of Christ.' },
      { ref: 'Psalm 133:1', text: 'Behold, how good and how pleasant it is for brethren to dwell together in unity!' },
      { ref: 'Matthew 9:37-38', text: 'The harvest truly is plenteous, but the labourers are few; pray ye therefore the Lord of the harvest, that he will send forth labourers.' },
      { ref: 'Hebrews 10:25', text: 'Not forsaking the assembling of ourselves together... but exhorting one another.' }
    ],
    points: [
      'Pray for your pastors and leaders — their strength, integrity and families.',
      'Ask for unity, and for gossip and division to find no soil.',
      'Pray for the lost to be reached and for labourers to be sent.',
      'Ask God to show you where you fit and how to serve.',
      'Pray for genuine revival, not just good attendance.'
    ],
    prayer: 'Lord, I pray for Your church. Strengthen our pastors and leaders — protect their families, guard their integrity and renew their joy. Let unity mark us and let division find no soil among us. The harvest is plenteous but the labourers are few — send labourers, and make me one of them. Show me where I fit and let me serve faithfully. Build Your church, and let the gates of hell not prevail against it. Amen.',
    encouragement: 'Every healthy church is standing on the prayers of people nobody applauds. That is holy work.'
  },
  {
    id: 'nation',
    title: 'Nation & Leaders',
    icon: 'fa-globe',
    colour: '#0891b2',
    match: ['nation', 'country', 'government', 'president', 'leaders', 'leaders of', 'politics', 'election',
            'peace in', 'war', 'corruption', 'economy', 'zambia', 'africa', 'world', 'society',
            'community', 'city'],
    opening: 'Righteousness exalts a nation. Praying for your country is one of the most practical things a believer can do.',
    verses: [
      { ref: '2 Chronicles 7:14', text: 'If my people, which are called by my name, shall humble themselves, and pray, and seek my face, and turn from their wicked ways; then will I hear from heaven, and will forgive their sin, and will heal their land.' },
      { ref: '1 Timothy 2:1-2', text: 'I exhort therefore, that, first of all, supplications, prayers, intercessions... be made for all men; for kings, and for all that are in authority; that we may lead a quiet and peaceable life.' },
      { ref: 'Proverbs 14:34', text: 'Righteousness exalteth a nation: but sin is a reproach to any people.' },
      { ref: 'Psalm 33:12', text: 'Blessed is the nation whose God is the LORD.' },
      { ref: 'Jeremiah 29:7', text: 'And seek the peace of the city whither I have caused you to be carried away captive, and pray unto the LORD for it.' },
      { ref: 'Isaiah 1:17', text: 'Learn to do well; seek judgment, relieve the oppressed, judge the fatherless, plead for the widow.' }
    ],
    points: [
      'Pray for those in authority by name and by office.',
      'Ask for wisdom, integrity and the fear of God among leaders.',
      'Pray against corruption, violence and injustice.',
      'Intercede for the poor, the widow, the orphan and the oppressed.',
      'Pray for the peace of your city and for revival across your nation.'
    ],
    prayer: 'Father, I lift up my nation to You. I pray for those in authority — grant them wisdom, integrity and the fear of God. Expose and uproot corruption. Defend the poor, the widow and the fatherless. Let righteousness exalt this nation. If Your people humble themselves and pray and seek Your face, You said You would heal our land — so I humble myself and I pray. Bring peace to our city and revival to our people. Amen.',
    encouragement: 'Nations change slowly and then suddenly. Keep praying — history is full of turnarounds that started in prayer rooms.'
  },
  {
    id: 'general',
    title: 'General Prayer',
    icon: 'fa-hands-praying',
    colour: '#15803d',
    match: [],
    opening: 'Whatever you are carrying right now, you are welcome to bring it just as it is. God is not waiting for you to word it perfectly.',
    verses: [
      { ref: 'Jeremiah 33:3', text: 'Call unto me, and I will answer thee, and shew thee great and mighty things, which thou knowest not.' },
      { ref: 'Matthew 7:7', text: 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.' },
      { ref: 'Philippians 4:6-7', text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.' },
      { ref: 'Hebrews 4:16', text: 'Let us therefore come boldly unto the throne of grace, that we may obtain mercy, and find grace to help in time of need.' },
      { ref: 'Romans 8:26', text: 'The Spirit also helpeth our infirmities: for we know not what we should pray for as we ought: but the Spirit itself maketh intercession for us.' },
      { ref: '1 John 5:14', text: 'And this is the confidence that we have in him, that, if we ask any thing according to his will, he heareth us.' }
    ],
    points: [
      'Start by simply telling God what is actually on your mind.',
      'Ask Him for what you need plainly — He invites you to ask.',
      'Thank Him for something, even if it is small.',
      'Ask the Holy Spirit to pray through you where you have no words.',
      'Sit quietly for a moment and let Him speak too.'
    ],
    prayer: 'Father, I come to You just as I am. You said to call on You and You would answer and show me great and mighty things I do not know. So I am calling. Where I do not have the words, let Your Spirit intercede for me. I come boldly to Your throne of grace to find mercy and grace to help in this time of need. Thank You for hearing me. Amen.',
    encouragement: 'You have just done the most important thing — you came. Keep the conversation going through the day.'
  }
];

/*
 * Matcher
 * -------
 * Scores each topic against the user's text. Deliberately simple and
 * transparent: exact phrase hits score highest, whole-word hits next,
 * partial stem hits last. Returns topics sorted by score.
 */
function pdMatchTopics(input) {
  const text = ' ' + String(input || '').toLowerCase().replace(/[^\w\s']/g, ' ').replace(/\s+/g, ' ') + ' ';
  const scored = [];

  PD_TOPICS.forEach(topic => {
    if (!topic.match.length) return; // 'general' is the fallback only
    let score = 0;
    const hits = [];

    topic.match.forEach(term => {
      const t = term.toLowerCase();
      if (t.includes(' ')) {
        // Multi-word phrase — strongest signal of intent.
        if (text.includes(' ' + t + ' ') || text.includes(' ' + t)) {
          score += 6;
          hits.push(term);
        }
      } else {
        const whole = new RegExp('\\s' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s');
        const stem = new RegExp('\\s' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w{0,3}\\s');
        if (whole.test(text)) {
          score += 4;
          hits.push(term);
        } else if (t.length > 4 && stem.test(text)) {
          score += 2;
          hits.push(term);
        }
      }
    });

    if (score > 0) scored.push({ topic, score, hits });
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/* Returns { primary, related[], crisis } for a free-text request. */
function pdBuildResponse(input) {
  const scored = pdMatchTopics(input);
  const fallback = PD_TOPICS.find(t => t.id === 'general');

  if (!scored.length) {
    return { primary: fallback, related: [], crisis: false, matched: false };
  }

  const primary = scored[0].topic;
  const related = scored.slice(1, 3).map(s => s.topic);
  const crisis = scored.some(s => s.topic.crisis && s.score >= 4);

  return { primary, related, crisis, matched: true };
}

/* Deterministic "verse of the moment" so repeat visits feel fresh but stable. */
function pdPickVerses(topic, count) {
  const verses = topic.verses.slice();
  const seed = Math.floor(Date.now() / 60000); // rotates each minute
  const start = seed % verses.length;
  const out = [];
  for (let i = 0; i < Math.min(count, verses.length); i++) {
    out.push(verses[(start + i) % verses.length]);
  }
  return out;
}

if (typeof window !== 'undefined') {
  window.PD_TOPICS = PD_TOPICS;
  window.pdMatchTopics = pdMatchTopics;
  window.pdBuildResponse = pdBuildResponse;
  window.pdPickVerses = pdPickVerses;
}
