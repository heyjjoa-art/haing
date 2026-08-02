// Unit 15 기본 단어 데이터 (본문 "The Lucky Knife" 기준)
// 매주 사진을 새로 업로드하면 이 값 대신 업로드된 데이터가 사용됨 (js/data-store.js 참고)
// definition: 영영 설명 (책 Word List 원문)
// meaningKo: 영영 설명을 기반으로 압축한 한 단어(또는 짧은 어구) 한글 뜻
// emoji: 단어를 그림으로 표현한 이모지 힌트 (단어 학습 1단계용)
var DEFAULT_WORDS_DATA = [
  { word: "absorb", pos: "v.", definition: "To absorb a liquid means to take it inside.", meaningKo: "흡수하다", emoji: "🧽" },
  { word: "boss", pos: "n.", definition: "A boss is a person in charge of other people at work.", meaningKo: "상사", emoji: "🧑‍💼" },
  { word: "charitable", pos: "adj.", definition: "A charitable organization aims to help people.", meaningKo: "자선의", emoji: "🎗️" },
  { word: "committee", pos: "n.", definition: "A committee is a group of people who meet together to make decisions.", meaningKo: "위원회", emoji: "👥" },
  { word: "contract", pos: "n.", definition: "A contract is a written agreement between two people.", meaningKo: "계약서", emoji: "📝" },
  { word: "crew", pos: "n.", definition: "A crew is a group of workers.", meaningKo: "작업팀", emoji: "👷" },
  { word: "devote", pos: "v.", definition: "To devote time to something means to spend a lot of time doing it.", meaningKo: "전념하다", emoji: "🙏" },
  { word: "dig", pos: "v.", definition: "To dig is to make a hole in the ground.", meaningKo: "파다", emoji: "⛏️" },
  { word: "dine", pos: "v.", definition: "To dine means to eat dinner.", meaningKo: "식사하다", emoji: "🍽️" },
  { word: "donate", pos: "v.", definition: "To donate is to give something to a charity or organization.", meaningKo: "기부하다", emoji: "🎁" },
  { word: "double", pos: "adj.", definition: "Double means twice as much or twice as many.", meaningKo: "두 배의", emoji: "✌️" },
  { word: "flavor", pos: "n.", definition: "A flavor is the taste of food or drinks.", meaningKo: "맛", emoji: "🍦" },
  { word: "foundation", pos: "n.", definition: "A foundation is a group that provides money for research.", meaningKo: "재단", emoji: "🏛️" },
  { word: "generation", pos: "n.", definition: "A generation is a group of people who live at the same time.", meaningKo: "세대", emoji: "👨‍👩‍👧‍👦" },
  { word: "handle", pos: "n.", definition: "A handle is the part of an object people hold while using it.", meaningKo: "손잡이", emoji: "🪣" },
  { word: "layer", pos: "n.", definition: "A layer covers over something or is one of several pieces lying on top of each other.", meaningKo: "층", emoji: "🍰" },
  { word: "mud", pos: "n.", definition: "Mud is soft, wet dirt.", meaningKo: "진흙", emoji: "🟤" },
  { word: "smooth", pos: "adj.", definition: "A smooth thing has no bumps or rough parts.", meaningKo: "매끄러운", emoji: "🧈" },
  { word: "soil", pos: "n.", definition: "Soil is the top layer of land on the Earth.", meaningKo: "흙", emoji: "🌱" },
  { word: "unique", pos: "adj.", definition: "A unique person or thing is not like others.", meaningKo: "독특한", emoji: "🦄" }
];

var DEFAULT_STORY_TITLE = "The Lucky Knife";

var DEFAULT_STORY_PARAGRAPHS = [
  "Last year, I had a unique chance to work with my uncle, who has devoted his life to studying past generations. I was part of a crew of students he had hired. We signed a contract to work with him. He was the boss. We lived far from the nearest town, and we dined on what we could find. Some of the things we ate had an unusual flavor.",
  "We had been there about a month and still hadn't found anything. One day, I began to dig in the soil. The layers of soil got wetter. Soon, I was digging in the mud. My shovel began to get very heavy. It felt like it had doubled in weight because the ground had absorbed such a lot of water.",
  "Finally, I saw something in the mud. It was an old knife! The handle felt smooth in my hand. I lifted it up so I could see it better. There was writing on it.",
  "\"It says, 'it will bring good luck,'\" my uncle said with a smile.",
  "The next day, we found many more things. There were pots and tools. My uncle donated all of the things to a special committee of a charitable foundation. Many newspapers wrote stories about it. It seemed the knife really did bring good luck!"
];

var DEFAULT_STORY_PHOTO = "assets/pages/unit15-story.jpg";

// 본문 내용과 어울리는 삽화(무료 이미지, Unsplash). 발굴 현장에서 다 같이 무언가를 찾는 장면.
var DEFAULT_STORY_IMAGE = "https://images.unsplash.com/photo-1730809019029-ecfdb9bb1934?w=1200&q=80";
