# 종합게임패키지

아이폰은 진행자 화면, 갤럭시탭은 참가자 화면으로 쓰는 실시간 종합게임 웹앱입니다.

포함된 게임:

- 인물퀴즈
- 몸으로 말해요
- 줄줄이 말해요
- 골든벨
- 캐치마인드

## 노트북 없이 쓰는 방식

노트북 없이 쓰려면 이 폴더의 `public` 안에 있는 파일들을 웹사이트로 배포하고, Firebase Realtime Database를 연결하면 됩니다.

접속 주소는 이렇게 씁니다.

- 아이폰 진행자 화면: `https://내사이트주소/host.html?room=family`
- 갤럭시탭 참가자 화면: `https://내사이트주소/screen.html?room=family`

`room` 값이 같은 기기끼리만 같은 문제를 봅니다. 아이폰에서 `다음 문제`를 누르면 갤럭시탭 화면도 같이 바뀝니다.

## Firebase 연결

1. Firebase 콘솔에서 새 프로젝트를 만듭니다.
2. Realtime Database를 만들고, 테스트 모드로 시작합니다.
3. 웹 앱을 추가해서 Firebase 설정값을 복사합니다.
4. `public/firebase-config.js`에 설정값을 붙여넣고 `firebaseEnabled`를 `true`로 바꿉니다.

```js
export const firebaseEnabled = true;

export const firebaseConfig = {
  apiKey: "복사한 값",
  authDomain: "복사한 값",
  databaseURL: "복사한 값",
  projectId: "복사한 값",
  storageBucket: "복사한 값",
  messagingSenderId: "복사한 값",
  appId: "복사한 값",
};
```

## 로컬에서 테스트

## 문제 꾸러미

인물퀴즈는 기본으로 쉬운 인물 100명이 들어 있습니다. 사진은 위키미디어 이미지 웹링크로 연결되어 있어서 따로 사진 파일을 넣지 않아도 됩니다.

인물을 바꾸려면 `public/people.json`에서 이름과 사진 경로를 수정합니다.

예시:

```json
{
  "name": "손흥민",
  "image": "https://example.com/son.jpg"
}
```

내 사진 파일을 직접 넣고 싶으면 사진 파일을 `public/images` 폴더에 넣고, 경로를 `/images/son.jpg`처럼 쓰면 됩니다.

몸으로 말해요, 줄줄이 말해요, 골든벨, 캐치마인드 문제 꾸러미는 `public/game-data.js`에서 수정합니다.

## 노트북으로 로컬 실행도 가능

```powershell
node server.js
```

이 방식은 노트북/PC가 있을 때만 필요합니다.
