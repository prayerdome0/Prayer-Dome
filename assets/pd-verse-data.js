/*!
 * Prayer Dome — Daily Verse Library
 * ---------------------------------------------------------------------------
 * Four Scripture sets, one for each moment of the day. The same file is used by
 * the app, by the service worker (importScripts) and by the Android home-screen
 * widget generator, so a member sees the same verse everywhere.
 *
 * Translation: King James Version (public domain).
 */
(function (root) {
    'use strict';

    var SLOTS = [
        { id: 'morning',   label: 'Morning Verse',   icon: '🌅', defaultTime: '06:30', greeting: 'Good morning' },
        { id: 'midday',    label: 'Midday Verse',    icon: '☀️', defaultTime: '12:00', greeting: 'Grace for midday' },
        { id: 'afternoon', label: 'Afternoon Verse', icon: '🌤️', defaultTime: '15:30', greeting: 'Strength this afternoon' },
        { id: 'evening',   label: 'Evening Verse',   icon: '🌙', defaultTime: '20:00', greeting: 'Rest well tonight' }
    ];

    var VERSES = {
        morning: [
            { ref: 'Lamentations 3:22-23', text: 'It is of the LORD\u2019S mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.' },
            { ref: 'Psalm 5:3', text: 'My voice shalt thou hear in the morning, O LORD; in the morning will I direct my prayer unto thee, and will look up.' },
            { ref: 'Psalm 143:8', text: 'Cause me to hear thy lovingkindness in the morning; for in thee do I trust: cause me to know the way wherein I should walk; for I lift up my soul unto thee.' },
            { ref: 'Psalm 118:24', text: 'This is the day which the LORD hath made; we will rejoice and be glad in it.' },
            { ref: 'Isaiah 40:31', text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.' },
            { ref: 'Psalm 90:14', text: 'O satisfy us early with thy mercy; that we may rejoice and be glad all our days.' },
            { ref: 'Proverbs 3:5-6', text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.' },
            { ref: 'Mark 1:35', text: 'And in the morning, rising up a great while before day, he went out, and departed into a solitary place, and there prayed.' },
            { ref: 'Psalm 59:16', text: 'But I will sing of thy power; yea, I will sing aloud of thy mercy in the morning: for thou hast been my defence and refuge in the day of my trouble.' },
            { ref: 'Joshua 1:9', text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.' },
            { ref: 'Philippians 4:13', text: 'I can do all things through Christ which strengtheneth me.' },
            { ref: 'Psalm 37:5', text: 'Commit thy way unto the LORD; trust also in him; and he shall bring it to pass.' },
            { ref: 'Isaiah 41:10', text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.' },
            { ref: 'Jeremiah 29:11', text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.' },
            { ref: 'Matthew 6:33', text: 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.' },
            { ref: 'Psalm 63:1', text: 'O God, thou art my God; early will I seek thee: my soul thirsteth for thee, my flesh longeth for thee in a dry and thirsty land, where no water is.' },
            { ref: 'Deuteronomy 31:6', text: 'Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.' },
            { ref: 'Psalm 19:14', text: 'Let the words of my mouth, and the meditation of my heart, be acceptable in thy sight, O LORD, my strength, and my redeemer.' },
            { ref: '2 Corinthians 5:17', text: 'Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.' },
            { ref: 'Psalm 121:1-2', text: 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.' }
        ],
        midday: [
            { ref: 'Matthew 11:28', text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.' },
            { ref: 'Psalm 46:1', text: 'God is our refuge and strength, a very present help in trouble.' },
            { ref: 'Isaiah 26:3', text: 'Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee.' },
            { ref: 'Colossians 3:23', text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.' },
            { ref: 'Psalm 55:22', text: 'Cast thy burden upon the LORD, and he shall sustain thee: he shall never suffer the righteous to be moved.' },
            { ref: '1 Peter 5:7', text: 'Casting all your care upon him; for he careth for you.' },
            { ref: 'Nehemiah 8:10', text: 'Neither be ye sorry; for the joy of the LORD is your strength.' },
            { ref: 'Psalm 27:1', text: 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?' },
            { ref: 'Galatians 6:9', text: 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.' },
            { ref: '2 Corinthians 12:9', text: 'My grace is sufficient for thee: for my strength is made perfect in weakness.' },
            { ref: 'Psalm 34:8', text: 'O taste and see that the LORD is good: blessed is the man that trusteth in him.' },
            { ref: 'Romans 8:28', text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },
            { ref: 'Proverbs 16:3', text: 'Commit thy works unto the LORD, and thy thoughts shall be established.' },
            { ref: 'Psalm 119:105', text: 'Thy word is a lamp unto my feet, and a light unto my path.' },
            { ref: 'Hebrews 4:16', text: 'Let us therefore come boldly unto the throne of grace, that we may obtain mercy, and find grace to help in time of need.' },
            { ref: 'James 1:5', text: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.' },
            { ref: 'Philippians 4:19', text: 'But my God shall supply all your need according to his riches in glory by Christ Jesus.' },
            { ref: 'Psalm 145:18', text: 'The LORD is nigh unto all them that call upon him, to all that call upon him in truth.' },
            { ref: 'Isaiah 43:2', text: 'When thou passest through the waters, I will be with thee; and through the rivers, they shall not overflow thee.' },
            { ref: 'Matthew 5:16', text: 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.' }
        ],
        afternoon: [
            { ref: 'Psalm 23:1-3', text: 'The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.' },
            { ref: 'John 14:27', text: 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.' },
            { ref: 'Philippians 4:6-7', text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.' },
            { ref: 'Psalm 138:8', text: 'The LORD will perfect that which concerneth me: thy mercy, O LORD, endureth for ever.' },
            { ref: 'Romans 15:13', text: 'Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.' },
            { ref: 'Psalm 62:5-6', text: 'My soul, wait thou only upon God; for my expectation is from him. He only is my rock and my salvation: he is my defence; I shall not be moved.' },
            { ref: 'Isaiah 30:15', text: 'In returning and rest shall ye be saved; in quietness and in confidence shall be your strength.' },
            { ref: '2 Timothy 1:7', text: 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.' },
            { ref: 'Psalm 31:24', text: 'Be of good courage, and he shall strengthen your heart, all ye that hope in the LORD.' },
            { ref: 'Hebrews 13:5', text: 'I will never leave thee, nor forsake thee.' },
            { ref: 'Psalm 73:26', text: 'My flesh and my heart faileth: but God is the strength of my heart, and my portion for ever.' },
            { ref: 'Isaiah 55:11', text: 'So shall my word be that goeth forth out of my mouth: it shall not return unto me void.' },
            { ref: 'Ephesians 3:20', text: 'Now unto him that is able to do exceeding abundantly above all that we ask or think, according to the power that worketh in us.' },
            { ref: 'Psalm 91:1-2', text: 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.' },
            { ref: 'John 15:5', text: 'I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.' },
            { ref: 'Psalm 32:8', text: 'I will instruct thee and teach thee in the way which thou shalt go: I will guide thee with mine eye.' },
            { ref: 'Micah 6:8', text: 'He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?' },
            { ref: 'Psalm 103:2-3', text: 'Bless the LORD, O my soul, and forget not all his benefits: Who forgiveth all thine iniquities; who healeth all thy diseases.' },
            { ref: 'Romans 12:12', text: 'Rejoicing in hope; patient in tribulation; continuing instant in prayer.' },
            { ref: 'Psalm 46:10', text: 'Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.' }
        ],
        evening: [
            { ref: 'Psalm 4:8', text: 'I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety.' },
            { ref: 'Psalm 127:2', text: 'For so he giveth his beloved sleep.' },
            { ref: 'Proverbs 3:24', text: 'When thou liest down, thou shalt not be afraid: yea, thou shalt lie down, and thy sleep shall be sweet.' },
            { ref: 'Psalm 63:6', text: 'When I remember thee upon my bed, and meditate on thee in the night watches.' },
            { ref: 'Matthew 11:29', text: 'Take my yoke upon you, and learn of me; for I am meek and lowly in heart: and ye shall find rest unto your souls.' },
            { ref: 'Psalm 3:5', text: 'I laid me down and slept; I awaked; for the LORD sustained me.' },
            { ref: 'Psalm 141:2', text: 'Let my prayer be set forth before thee as incense; and the lifting up of my hands as the evening sacrifice.' },
            { ref: 'Psalm 42:8', text: 'Yet the LORD will command his lovingkindness in the daytime, and in the night his song shall be with me, and my prayer unto the God of my life.' },
            { ref: '1 Thessalonians 5:17-18', text: 'Pray without ceasing. In every thing give thanks: for this is the will of God in Christ Jesus concerning you.' },
            { ref: 'Psalm 34:1', text: 'I will bless the LORD at all times: his praise shall continually be in my mouth.' },
            { ref: 'Psalm 136:1', text: 'O give thanks unto the LORD; for he is good: for his mercy endureth for ever.' },
            { ref: 'Ephesians 4:26', text: 'Let not the sun go down upon your wrath.' },
            { ref: 'Psalm 16:7-8', text: 'I will bless the LORD, who hath given me counsel: my reins also instruct me in the night seasons. I have set the LORD always before me.' },
            { ref: 'Isaiah 26:9', text: 'With my soul have I desired thee in the night; yea, with my spirit within me will I seek thee early.' },
            { ref: 'Psalm 77:6', text: 'I call to remembrance my song in the night: I commune with mine own heart: and my spirit made diligent search.' },
            { ref: 'Numbers 6:24-26', text: 'The LORD bless thee, and keep thee: The LORD make his face shine upon thee, and be gracious unto thee: The LORD lift up his countenance upon thee, and give thee peace.' },
            { ref: 'Psalm 30:5', text: 'Weeping may endure for a night, but joy cometh in the morning.' },
            { ref: 'John 3:16', text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' },
            { ref: 'Psalm 139:9-10', text: 'If I take the wings of the morning, and dwell in the uttermost parts of the sea; Even there shall thy hand lead me, and thy right hand shall hold me.' },
            { ref: 'Zephaniah 3:17', text: 'The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing.' }
        ]
    };

    function dayIndex(date) {
        var d = date || new Date();
        var start = new Date(d.getFullYear(), 0, 0);
        return Math.floor((d - start) / 86400000);
    }

    /** Deterministic verse for a slot on a given day — same for every device. */
    function verseFor(slotId, date) {
        var pool = VERSES[slotId] || VERSES.morning;
        var slotIndex = Math.max(0, SLOTS.map(function (s) { return s.id; }).indexOf(slotId));
        var index = (dayIndex(date) * SLOTS.length + slotIndex) % pool.length;
        var verse = pool[index];
        var slot = SLOTS[slotIndex];
        return {
            slot: slotId,
            slotLabel: slot.label,
            icon: slot.icon,
            greeting: slot.greeting,
            reference: verse.ref,
            text: verse.text,
            translation: 'KJV'
        };
    }

    var API = {
        SLOTS: SLOTS,
        VERSES: VERSES,
        verseFor: verseFor,
        dayIndex: dayIndex,
        slot: function (id) {
            for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].id === id) return SLOTS[i];
            return SLOTS[0];
        },
        /** Which slot are we in right now (used by widgets and catch-up sends)? */
        currentSlot: function (date) {
            var h = (date || new Date()).getHours();
            if (h < 11) return 'morning';
            if (h < 14) return 'midday';
            if (h < 18) return 'afternoon';
            return 'evening';
        }
    };

    root.PD_VERSES = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : this);
