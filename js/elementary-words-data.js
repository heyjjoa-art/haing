// 초등 필수 영단어 800개 데이터. 스토리북 본문이 없는 "단어 전용" 학습용이라
// 20개씩 끊어서 초등1, 초등2, ... 식으로 자동 구분한다(진짜 유닛처럼 로컬/클라우드에
// 업로드하는 게 아니라, 이 파일에 고정으로 들어있는 값을 그대로 쓴다).
// 지금은 사진 9장(001~105번)까지만 반영했고, 나머지는 사진을 더 받으면 이 배열
// 뒤에 이어 붙이면 된다 - 20개를 채울 때마다 다음 초등 단계가 자동으로 생긴다.
// definition: 영영 설명(단어 학습 2단계에서 먼저 들려주는 힌트, 정답 단어 자체는 안 넣는다)
// meaningKo: 교재의 한글 뜻
// emoji: 단어를 그림으로 표현한 이모지 힌트(단어 학습 1단계용)
var ELEMENTARY_WORD_POOL = [
  { word: "look", pos: "v.", meaningKo: "보다, ~해 보이다", definition: "To look means to turn your eyes to see something.", emoji: "👀" },
  { word: "see", pos: "v.", meaningKo: "보다, 알다", definition: "To see means to notice something with your eyes.", emoji: "👁️" },
  { word: "watch", pos: "v.", meaningKo: "보다, 지켜보다", definition: "To watch means to look at something carefully for a while.", emoji: "📺" },
  { word: "sound", pos: "n.", meaningKo: "소리", definition: "A sound is something you can hear.", emoji: "🔊" },
  { word: "voice", pos: "n.", meaningKo: "목소리", definition: "A voice is the sound a person makes when they speak or sing.", emoji: "🗣️" },
  { word: "hear", pos: "v.", meaningKo: "(귀에) 들리다", definition: "To hear means to notice a sound with your ears.", emoji: "👂" },
  { word: "listen", pos: "v.", meaningKo: "(귀 기울여) 듣다", definition: "To listen means to pay close attention to a sound.", emoji: "🎧" },
  { word: "smell", pos: "v.", meaningKo: "냄새가 나다, 냄새를 맡다", definition: "To smell means to notice something with your nose.", emoji: "👃" },
  { word: "touch", pos: "v.", meaningKo: "만지다", definition: "To touch means to put your hand or fingers on something.", emoji: "✋" },
  { word: "taste", pos: "v.", meaningKo: "맛이 ~하다", definition: "To taste means to notice the flavor of food with your tongue.", emoji: "👅" },
  { word: "sour", pos: "adj.", meaningKo: "(맛이) 신", definition: "Something sour tastes sharp, like a lemon.", emoji: "🍋" },
  { word: "wake", pos: "v.", meaningKo: "일어나다, 깨다", definition: "To wake means to stop sleeping.", emoji: "⏰" },
  { word: "body", pos: "n.", meaningKo: "몸", definition: "Your body is the whole physical part of you.", emoji: "🧍" },
  { word: "head", pos: "n.", meaningKo: "머리", definition: "Your head is the top part of your body, above your neck.", emoji: "🗿" },
  { word: "hair", pos: "n.", meaningKo: "머리카락, 털", definition: "Hair is the soft strands that grow on your head.", emoji: "💇" },
  { word: "neck", pos: "n.", meaningKo: "목", definition: "Your neck connects your head to your body.", emoji: "🧣" },
  { word: "face", pos: "n.", meaningKo: "얼굴", definition: "Your face is the front part of your head.", emoji: "😐" },
  { word: "ear", pos: "n.", meaningKo: "귀", definition: "An ear is the body part you use to hear.", emoji: "👂" },
  { word: "eye", pos: "n.", meaningKo: "눈", definition: "An eye is the body part you use to see.", emoji: "👁️" },
  { word: "nose", pos: "n.", meaningKo: "코", definition: "A nose is the body part you use to smell and breathe.", emoji: "👃" },
  { word: "hand", pos: "n.", meaningKo: "손", definition: "A hand is the body part at the end of your arm.", emoji: "✋" },
  { word: "finger", pos: "n.", meaningKo: "손가락", definition: "A finger is one of the five parts at the end of your hand.", emoji: "☝️" },
  { word: "mouth", pos: "n.", meaningKo: "입", definition: "A mouth is the body part you use to eat and speak.", emoji: "👄" },
  { word: "lip", pos: "n.", meaningKo: "입술", definition: "A lip is the soft edge of your mouth.", emoji: "💋" },
  { word: "tooth", pos: "n.", meaningKo: "이, 치아", definition: "A tooth is one of the hard white parts in your mouth.", emoji: "🦷" },
  { word: "arm", pos: "n.", meaningKo: "팔", definition: "An arm is the body part between your shoulder and your hand.", emoji: "💪" },
  { word: "leg", pos: "n.", meaningKo: "다리", definition: "A leg is the body part you use to stand and walk.", emoji: "🦵" },
  { word: "foot", pos: "n.", meaningKo: "발", definition: "A foot is the body part at the end of your leg.", emoji: "🦶" },
  { word: "bone", pos: "n.", meaningKo: "뼈", definition: "A bone is one of the hard parts inside your body.", emoji: "🦴" },
  { word: "skin", pos: "n.", meaningKo: "피부", definition: "Skin is the soft outer layer that covers your body.", emoji: "🧴" },
  { word: "blood", pos: "n.", meaningKo: "피, 혈액", definition: "Blood is the red liquid that moves inside your body.", emoji: "🩸" },
  { word: "brain", pos: "n.", meaningKo: "뇌, 두뇌", definition: "Your brain is the body part inside your head that helps you think.", emoji: "🧠" },
  { word: "heart", pos: "n.", meaningKo: "심장, 마음", definition: "Your heart is the body part inside your chest that pumps blood.", emoji: "🫀" },
  { word: "gesture", pos: "n.", meaningKo: "몸짓", definition: "A gesture is a movement you make with your hands or body to show a meaning.", emoji: "🤷" },
  { word: "sit", pos: "v.", meaningKo: "앉다", definition: "To sit means to rest your body down on a chair or the ground.", emoji: "🪑" },
  { word: "stand", pos: "v.", meaningKo: "서다", definition: "To stand means to be on your feet with your body upright.", emoji: "🧍‍♂️" },
  { word: "go", pos: "v.", meaningKo: "가다", definition: "To go means to move from one place toward another.", emoji: "🚶" },
  { word: "stay", pos: "v.", meaningKo: "(계속) 있다, 머무르다", definition: "To stay means to remain in the same place.", emoji: "🏠" },
  { word: "visit", pos: "v.", meaningKo: "찾아가다", definition: "To visit means to go see a person or place for a while.", emoji: "🚪" },
  { word: "wait", pos: "v.", meaningKo: "기다리다", definition: "To wait means to stay in one place until something happens.", emoji: "⏳" },
  { word: "make", pos: "v.", meaningKo: "만들다", definition: "To make means to create something with your hands or mind.", emoji: "🪄" },
  { word: "pick", pos: "v.", meaningKo: "고르다, 뽑다", definition: "To pick means to choose one thing out of many.", emoji: "🤏" },
  { word: "push", pos: "v.", meaningKo: "밀다", definition: "To push means to press something to move it away from you.", emoji: "🫷" },
  { word: "put", pos: "v.", meaningKo: "두다, 넣다", definition: "To put means to place something somewhere.", emoji: "📥" },
  { word: "sick", pos: "adj.", meaningKo: "아픈", definition: "When you are sick, your body does not feel well.", emoji: "🤒" },
  { word: "fever", pos: "n.", meaningKo: "열", definition: "A fever is when your body becomes hotter than normal because you are ill.", emoji: "🌡️" },
  { word: "care", pos: "n.", meaningKo: "돌봄, 보살핌", definition: "Care means looking after someone kindly.", emoji: "🤱" },
  { word: "wash", pos: "v.", meaningKo: "씻다", definition: "To wash means to clean something with water.", emoji: "🧼" },
  { word: "bath", pos: "n.", meaningKo: "목욕", definition: "A bath is when you wash your whole body in water.", emoji: "🛁" },
  { word: "clean", pos: "adj.", meaningKo: "깨끗한", definition: "Something clean has no dirt or mess on it.", emoji: "✨" },
  { word: "dirty", pos: "adj.", meaningKo: "더러운", definition: "Something dirty is not clean and has dirt on it.", emoji: "🟫" },
  { word: "safe", pos: "adj.", meaningKo: "안전한", definition: "Something safe will not hurt you.", emoji: "🦺" },
  { word: "dangerous", pos: "adj.", meaningKo: "위험한", definition: "Something dangerous could hurt you.", emoji: "⚠️" },
  { word: "accident", pos: "n.", meaningKo: "사고", definition: "An accident is something bad that happens by surprise.", emoji: "🚨" },
  { word: "break", pos: "v.", meaningKo: "부수다", definition: "To break means to make something come apart into pieces.", emoji: "💥" },
  { word: "save", pos: "v.", meaningKo: "구하다", definition: "To save means to keep someone or something safe from danger.", emoji: "🛟" },
  { word: "help", pos: "v.", meaningKo: "돕다", definition: "To help means to make something easier for someone else.", emoji: "🤲" },
  { word: "do", pos: "v.", meaningKo: "하다", definition: "To do means to carry out an action.", emoji: "✅" },
  { word: "call", pos: "v.", meaningKo: "부르다", definition: "To call means to say something loudly to get someone's attention.", emoji: "📞" },
  { word: "meet", pos: "v.", meaningKo: "만나다", definition: "To meet means to see and talk with someone in person.", emoji: "🤝" },
  { word: "give", pos: "v.", meaningKo: "주다", definition: "To give means to hand something to another person.", emoji: "🎁" },
  { word: "cover", pos: "v.", meaningKo: "가리다, 덮다", definition: "To cover means to put something over another thing.", emoji: "🙈" },
  { word: "fill", pos: "v.", meaningKo: "채우다", definition: "To fill means to make something full.", emoji: "🥤" },
  { word: "take", pos: "v.", meaningKo: "가지고 가다", definition: "To take means to carry something with you.", emoji: "👜" },
  { word: "hang", pos: "v.", meaningKo: "걸다", definition: "To hang means to attach something so it stays up without falling.", emoji: "🧥" },
  { word: "change", pos: "v.", meaningKo: "바꾸다", definition: "To change means to make something different.", emoji: "🔁" },
  { word: "find", pos: "v.", meaningKo: "찾다", definition: "To find means to discover something you were looking for.", emoji: "🔍" },
  { word: "turn", pos: "v.", meaningKo: "돌다", definition: "To turn means to move in a circle or a new direction.", emoji: "🌀" },
  { word: "use", pos: "v.", meaningKo: "쓰다, 사용하다", definition: "To use means to do something with a tool or object for a purpose.", emoji: "🛠️" },
  { word: "must", pos: "v.", meaningKo: "(강조) ~해야 한다", definition: "You use must to say that something is very necessary to do.", emoji: "❗" },
  { word: "keep", pos: "v.", meaningKo: "유지하다, 지키다", definition: "To keep means to continue having or doing something.", emoji: "🔐" },
  { word: "begin", pos: "v.", meaningKo: "시작하다", definition: "To begin means to start doing something.", emoji: "▶️" },
  { word: "finish", pos: "v.", meaningKo: "끝내다", definition: "To finish means to complete something you were doing.", emoji: "🏁" },
  { word: "should", pos: "v.", meaningKo: "(권유) ~해야 한다", definition: "You use should to give advice about what is a good idea to do.", emoji: "💭" },
  { word: "get", pos: "v.", meaningKo: "받다", definition: "To get means to receive or obtain something.", emoji: "🙌" },
  { word: "guide", pos: "n.", meaningKo: "(여행) 가이드, 안내인", definition: "A guide is a person who shows other people around a place.", emoji: "🧭" },
  { word: "have", pos: "v.", meaningKo: "가지고 있다", definition: "To have means to own or hold something.", emoji: "🎒" },
  { word: "control", pos: "v.", meaningKo: "조절하다", definition: "To control means to make something work the way you want.", emoji: "🎮" },
  { word: "ready", pos: "adj.", meaningKo: "준비된", definition: "When you are ready, you can start doing something right away.", emoji: "🙆" },
  { word: "habit", pos: "n.", meaningKo: "습관", definition: "A habit is something you do often, almost without thinking.", emoji: "📅" },
  { word: "noisy", pos: "adj.", meaningKo: "시끄러운", definition: "Something noisy makes a lot of loud sound.", emoji: "📢" },
  { word: "nice", pos: "adj.", meaningKo: "멋진", definition: "Something nice is pleasant or looks good.", emoji: "😌" },
  { word: "fun", pos: "adj.", meaningKo: "즐거운, 재미있는", definition: "Something fun makes you feel happy and enjoy yourself.", emoji: "🥳" },
  { word: "scared", pos: "adj.", meaningKo: "겁먹은", definition: "When you feel scared, you are afraid of something.", emoji: "😱" },
  { word: "joy", pos: "n.", meaningKo: "기쁨", definition: "Joy is a strong feeling of happiness.", emoji: "😁" },
  { word: "angry", pos: "adj.", meaningKo: "화난", definition: "When you feel angry, you feel strong displeasure about something.", emoji: "😠" },
  { word: "mad", pos: "adj.", meaningKo: "(몹시) 화난", definition: "When you feel mad, you feel very angry.", emoji: "😡" },
  { word: "glad", pos: "adj.", meaningKo: "기쁜", definition: "When you feel glad, you feel happy about something.", emoji: "😄" },
  { word: "sorry", pos: "adj.", meaningKo: "미안한, 안된", definition: "When you feel sorry, you feel bad about something you did or that happened.", emoji: "😔" },
  { word: "great", pos: "adj.", meaningKo: "훌륭한", definition: "Something great is very good or excellent.", emoji: "👏" },
  { word: "happy", pos: "adj.", meaningKo: "행복한", definition: "When you feel happy, you feel good and pleased.", emoji: "😃" },
  { word: "sad", pos: "adj.", meaningKo: "슬픈", definition: "When you feel sad, you feel unhappy.", emoji: "😢" },
  { word: "fine", pos: "adj.", meaningKo: "괜찮은, 좋은", definition: "When something is fine, it is okay or good.", emoji: "👌" },
  { word: "feel", pos: "v.", meaningKo: "느끼다", definition: "To feel means to notice an emotion or a sensation.", emoji: "💓" },
  { word: "enjoy", pos: "v.", meaningKo: "즐기다", definition: "To enjoy means to get pleasure from something.", emoji: "🎶" },
  { word: "cry", pos: "v.", meaningKo: "울다, 외치다", definition: "To cry means to have tears fall from your eyes, often when you are sad.", emoji: "😭" },
  { word: "smile", pos: "v.", meaningKo: "미소 짓다, 웃다", definition: "To smile means to move your mouth to show you are happy.", emoji: "😊" },
  { word: "thank", pos: "v.", meaningKo: "감사하다", definition: "To thank means to tell someone you are grateful for something.", emoji: "🙏" },
  { word: "congratulate", pos: "v.", meaningKo: "축하하다", definition: "To congratulate means to tell someone you are happy about their success.", emoji: "🎉" },
  { word: "welcome", pos: "v.", meaningKo: "환영하다", definition: "To welcome means to greet someone warmly when they arrive.", emoji: "👋" },
  { word: "like", pos: "v.", meaningKo: "좋아하다", definition: "To like means to enjoy or feel good about something.", emoji: "👍" },
  { word: "favorite", pos: "adj.", meaningKo: "가장 좋아하는", definition: "Your favorite thing is the one you like best of all.", emoji: "⭐" },
  { word: "miss", pos: "v.", meaningKo: "그리워하다", definition: "To miss means to feel sad because someone or something is not with you.", emoji: "🥺" },
  { word: "worry", pos: "v.", meaningKo: "걱정하다", definition: "To worry means to feel nervous about something that might happen.", emoji: "😟" },
  { word: "love", pos: "v.", meaningKo: "사랑하다", definition: "To love means to care about someone or something very deeply.", emoji: "❤️" }
];

var ELEMENTARY_LEVEL_SIZE = 20;

// 20개씩 끊어서 초등1, 초등2...로 나눈다. ELEMENTARY_WORD_POOL 뒤에 단어를 더 추가하면
// 자동으로 다음 단계(초등7...)가 생긴다 - 마지막 묶음이 20개가 안 채워져도 그대로
// 부분 단계로 보여준다(예: 지금의 초등6 = 101~105번, 5개).
var ELEMENTARY_WORD_LEVELS = (function () {
  var levels = {};
  for (var i = 0; i < ELEMENTARY_WORD_POOL.length; i += ELEMENTARY_LEVEL_SIZE) {
    var levelNum = Math.floor(i / ELEMENTARY_LEVEL_SIZE) + 1;
    levels["초등" + levelNum] = ELEMENTARY_WORD_POOL.slice(i, i + ELEMENTARY_LEVEL_SIZE);
  }
  return levels;
})();

var ELEMENTARY_LEVEL_KEYS = Object.keys(ELEMENTARY_WORD_LEVELS);
