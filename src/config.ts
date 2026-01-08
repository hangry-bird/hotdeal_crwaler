// FM 코리아 메인 URL (쿠키 획득용)
export const FM_KOREA_MAIN_URL = "https://www.fmkorea.com/";
export const FM_KOREA_HOTDEAL_URL = "https://www.fmkorea.com/hotdeal";

export const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";

// 상태 파일 경로
export const STATE_FILE_PATH = "./state.json";

// 크롤링 관련 설정
export const CRAWLER_CONFIG = {
  // User-Agent 설정
  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  // 요청 타임아웃 (밀리초)
  TIMEOUT_MS: 10000,
  // 최대 재시도 횟수
  MAX_RETRIES: 3,
  // 재시도 간격 (밀리초)
  RETRY_DELAY_MS: 2000,
  // Puppeteer 사용 여부 (클라우드플레어 우회용)
  USE_PUPPETEER: true,
  // Puppeteer 페이지 로딩 대기 시간 (밀리초)
  PUPPETEER_WAIT_MS: 3000,
} as const;

// 슬랙 메시지 설정
export const SLACK_CONFIG = {
  // 메시지 색상
  COLOR: "#36a64f",
  // 메시지 제목
  TITLE: "🔥 핫딜 새 글 알림",
} as const;
