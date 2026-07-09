const fs = require("fs");
const https = require("https");

const candidates = [
  ["손흥민", "Son Heung-min"],
  ["김연아", "Yuna Kim"],
  ["유재석", "Yoo Jae-suk"],
  ["봉준호", "Bong Joon Ho"],
  ["박지성", "Park Ji-sung"],
  ["싸이", "Psy"],
  ["이정재", "Lee Jung-jae"],
  ["정호연", "Jung Ho-yeon"],
  ["강호동", "Kang Ho-dong"],
  ["김종국", "Kim Jong-kook"],
  ["송중기", "Song Joong-ki"],
  ["박찬욱", "Park Chan-wook"],
  ["이순신", "Yi Sun-sin"],
  ["마이클 조던", "Michael Jordan"],
  ["리오넬 메시", "Lionel Messi"],
  ["크리스티아누 호날두", "Cristiano Ronaldo"],
  ["르브론 제임스", "LeBron James"],
  ["우사인 볼트", "Usain Bolt"],
  ["버락 오바마", "Barack Obama"],
  ["도널드 트럼프", "Donald Trump"],
  ["일론 머스크", "Elon Musk"],
  ["빌 게이츠", "Bill Gates"],
  ["스티브 잡스", "Steve Jobs"],
  ["알베르트 아인슈타인", "Albert Einstein"],
  ["마릴린 먼로", "Marilyn Monroe"],
  ["찰리 채플린", "Charlie Chaplin"],
  ["테일러 스위프트", "Taylor Swift"],
  ["비욘세", "Beyoncé"],
  ["마이클 잭슨", "Michael Jackson"],
  ["성룡", "Jackie Chan"],
  ["제프 베이조스", "Jeff Bezos"],
  ["마크 저커버그", "Mark Zuckerberg"],
  ["워런 버핏", "Warren Buffett"],
  ["팀 쿡", "Tim Cook"],
  ["젠슨 황", "Jensen Huang"],
  ["순다르 피차이", "Sundar Pichai"],
  ["사티아 나델라", "Satya Nadella"],
  ["잭 마", "Jack Ma"],
  ["리처드 브랜슨", "Richard Branson"],
  ["오프라 윈프리", "Oprah Winfrey"],
  ["넬슨 만델라", "Nelson Mandela"],
  ["마하트마 간디", "Mahatma Gandhi"],
  ["윈스턴 처칠", "Winston Churchill"],
  ["조 바이든", "Joe Biden"],
  ["힐러리 클린턴", "Hillary Clinton"],
  ["앙겔라 메르켈", "Angela Merkel"],
  ["에마뉘엘 마크롱", "Emmanuel Macron"],
  ["저스틴 트뤼도", "Justin Trudeau"],
  ["시진핑", "Xi Jinping"],
  ["블라디미르 푸틴", "Vladimir Putin"],
  ["볼로디미르 젤렌스키", "Volodymyr Zelenskyy"],
  ["마거릿 대처", "Margaret Thatcher"],
  ["존 F. 케네디", "John F. Kennedy"],
  ["에이브러햄 링컨", "Abraham Lincoln"],
  ["코비 브라이언트", "Kobe Bryant"],
  ["타이거 우즈", "Tiger Woods"],
  ["세리나 윌리엄스", "Serena Williams"],
  ["로저 페더러", "Roger Federer"],
  ["라파엘 나달", "Rafael Nadal"],
  ["노바크 조코비치", "Novak Djokovic"],
  ["네이마르", "Neymar"],
  ["킬리안 음바페", "Kylian Mbappé"],
  ["스테판 커리", "Stephen Curry"],
  ["샤킬 오닐", "Shaquille O'Neal"],
  ["톰 브래디", "Tom Brady"],
  ["무하마드 알리", "Muhammad Ali"],
  ["마이크 타이슨", "Mike Tyson"],
  ["박세리", "Pak Se-ri"],
  ["스즈키 이치로", "Ichiro Suzuki"],
  ["오타니 쇼헤이", "Shohei Ohtani"],
  ["레오나르도 디카프리오", "Leonardo DiCaprio"],
  ["브래드 피트", "Brad Pitt"],
  ["톰 크루즈", "Tom Cruise"],
  ["윌 스미스", "Will Smith"],
  ["로버트 다우니 주니어", "Robert Downey Jr."],
  ["드웨인 존슨", "Dwayne Johnson"],
  ["엠마 왓슨", "Emma Watson"],
  ["안젤리나 졸리", "Angelina Jolie"],
  ["스칼릿 조핸슨", "Scarlett Johansson"],
  ["메릴 스트립", "Meryl Streep"],
  ["아델", "Adele"],
  ["에드 시런", "Ed Sheeran"],
  ["브루노 마스", "Bruno Mars"],
  ["저스틴 비버", "Justin Bieber"],
  ["레이디 가가", "Lady Gaga"],
  ["리아나", "Rihanna"],
  ["아리아나 그란데", "Ariana Grande"],
  ["셀레나 고메즈", "Selena Gomez"],
  ["마돈나", "Madonna"],
  ["엘비스 프레슬리", "Elvis Presley"],
  ["마틴 루터 킹 주니어", "Martin Luther King Jr."],
  ["스티븐 호킹", "Stephen Hawking"],
  ["마리 퀴리", "Marie Curie"],
  ["아이작 뉴턴", "Isaac Newton"],
  ["찰스 다윈", "Charles Darwin"],
  ["니콜라 테슬라", "Nikola Tesla"],
  ["토머스 에디슨", "Thomas Edison"],
  ["레오나르도 다 빈치", "Leonardo da Vinci"],
  ["빈센트 반 고흐", "Vincent van Gogh"],
  ["파블로 피카소", "Pablo Picasso"],
];

function fetchBatch(batch) {
  return new Promise((resolve, reject) => {
    const titles = batch.map((person) => encodeURIComponent(person[1])).join("|");
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&pithumbsize=900&redirects=1&titles=" +
      titles;

    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "PeopleQuizBuilder/1.0 (local family quiz; contact: local)",
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            const pages = Object.values(JSON.parse(body).query.pages);
            resolve(
              batch.map(([name, title]) => {
                const page =
                  pages.find((item) => item.title === title) ||
                  pages.find((item) => item.title?.toLowerCase() === title.toLowerCase()) ||
                  pages.find((item) => item.pageid && !item.missing && item.title);

                return {
                  name,
                  image: page?.thumbnail?.source || null,
                };
              }),
            );
          });
        },
      )
      .on("error", reject);
  });
}

async function main() {
  let results = [];
  for (let i = 0; i < candidates.length; i += 45) {
    results = results.concat(await fetchBatch(candidates.slice(i, i + 45)));
  }

  const people = results.filter((person) => person.image).slice(0, 100);
  if (people.length !== 100) {
    throw new Error(`Expected 100 people with images, got ${people.length}`);
  }

  fs.writeFileSync("public/people.json", `${JSON.stringify(people, null, 2)}\n`, "utf8");
  console.log(`Updated public/people.json with ${people.length} people.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
