# 씬짜오베트남 CRM

## 챗봇 API (`/api/chat`)

씬짜오베트남 광고 안내 AI 챗봇 백엔드 (Vercel Serverless Function).  
모델: `gpt-4o-mini` | 언어: 한국어

### 환경변수 설정

**로컬 개발**

프로젝트 루트에 `.env.local` 파일 생성 후 아래 내용 추가:

```
OPENAI_API_KEY=sk-...your-openai-api-key-here...
```

> `.env.local.example` 파일을 복사해서 사용하세요.

**Vercel 배포**

Vercel Dashboard → [프로젝트] → Settings → Environment Variables  
`OPENAI_API_KEY` = `sk-...your-key...` (Production / Preview / Development 모두 체크)

---

### 로컬 테스트 방법

```bash
# 1. 의존성 설치
npm install

# 2. Vercel CLI 설치 (최초 1회)
npm install -g vercel

# 3. 로컬 개발 서버 실행 (React + Serverless Function 동시)
vercel dev
```

**curl 테스트 예시:**

```bash
# 일반 질문
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"어떤 패키지가 있나요?"}]}'

# 추천 포함 응답 확인
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"레스토랑인데 예산 1000달러 정도로 6개월 광고하고 싶어요"}]}'
```

**응답 예시:**

```json
{
  "reply": "레스토랑이시군요! 예산과 기간을 고려하면 ★ 통합 패키지 B를 추천드립니다...",
  "recommendation": {
    "packageName": "통합 패키지 B",
    "months": 6,
    "addons": []
  }
}
```

> `recommendation` 필드는 챗봇이 패키지를 확정 추천할 때만 포함됩니다.

---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
