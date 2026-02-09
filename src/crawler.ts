import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer, { Browser, Page } from "puppeteer";
import {
  FM_KOREA_MAIN_URL,
  FM_KOREA_HOTDEAL_URL,
  CRAWLER_CONFIG,
} from "./config";

/**
 * 게시글 정보 인터페이스
 */
export interface Post {
  number: number;
  title: string;
  url: string;
  author: string;
  date: string;
  shop: string; // 쇼핑몰
  price: string; // 가격
  delivery: string; // 배송
  category: string; // 카테고리
  thumbnail: string; // 썸네일 이미지 URL
}

/**
 * Puppeteer를 사용한 크롤링
 */
async function crawlWithPuppeteer(): Promise<Post[]> {
  let browser: Browser | null = null;

  try {
    console.log("Puppeteer 브라우저 시작 중...");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // User-Agent 설정
    await page.setUserAgent(CRAWLER_CONFIG.USER_AGENT);

    // 뷰포트 설정
    await page.setViewport({ width: 1920, height: 1080 });

    // 추가 헤더 설정
    await page.setExtraHTTPHeaders({
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    });

    console.log("핫딜 게시판 페이지 로딩 중...");
    await page.goto(FM_KOREA_HOTDEAL_URL, {
      waitUntil: "networkidle2",
      timeout: CRAWLER_CONFIG.TIMEOUT_MS,
    });

    // 페이지 로딩 대기
    await new Promise((resolve) =>
      setTimeout(resolve, CRAWLER_CONFIG.PUPPETEER_WAIT_MS)
    );

    // HTML 가져오기
    const html = await page.content();
    await browser.close();
    browser = null;

    // HTML 파싱
    const $ = cheerio.load(html);
    const posts: Post[] = [];

    // 예전에는 .fm_best_widget 안에 리스트가 있었는데,
    // 현재는 컨테이너 클래스가 바뀐 상태라 li.li만 기준으로 잡는다.
    $("li.li").each((_, element) => {
      try {
        const $element = $(element);

        // 제목과 URL 추출 (h3.title > a)
        const $titleLink = $element.find("h3.title a");
        const title =
          $titleLink.find(".ellipsis-target").text().trim() ||
          $titleLink.text().trim();

        // URL 추출 (상대 경로인 경우 절대 경로로 변환)
        let url = $titleLink.attr("href") || "";
        if (!url) {
          return;
        }

        // 게시글 번호 추출 (URL에서: /9361540085 -> 9361540085)
        const urlMatch = url.match(/\/(\d+)/);
        if (!urlMatch) {
          return;
        }
        const number = parseInt(urlMatch[1], 10);

        if (isNaN(number)) {
          return;
        }

        if (url && !url.startsWith("http")) {
          url = `https://www.fmkorea.com${url}`;
        }

        // 추천수 추출 (.count) - 비추천(-1 이하)은 제외
        const recommendText = $element.find(".count").first().text().trim();
        const recommendMatch = recommendText.match(/-?\d+/);
        const recommend = recommendMatch
          ? parseInt(recommendMatch[0], 10)
          : 0;
        if (recommend <= -1) {
          return;
        }

        // 작성자 추출 (.author에서 " / " 제거)
        let author = $element.find(".author").text().trim();
        author = author.replace(/^\s*\/\s*/, "").trim(); // 앞의 " / " 제거

        // 날짜 추출 (.regdate)
        const date = $element.find(".regdate").text().trim();

        // 쇼핑몰, 가격, 배송 추출 (.hotdeal_info)
        const $hotdealInfo = $element.find(".hotdeal_info");
        let shop = "";
        let price = "";
        let delivery = "";

        $hotdealInfo.find("span").each((idx, span) => {
          const text = $(span).text().trim();
          if (text.includes("쇼핑몰:")) {
            shop = $(span).find("a.strong").text().trim();
          } else if (text.includes("가격:")) {
            price = $(span).find("a.strong").text().trim();
          } else if (text.includes("배송:")) {
            delivery = $(span).find("a.strong").text().trim();
          }
        });

        // 카테고리 추출 (.category > a)
        const category = $element
          .find(".category a")
          .text()
          .trim()
          .replace(/\s*\/\s*$/, "");

        // 썸네일 이미지 추출 (.thumb)
        let thumbnail = $element.find("img.thumb").attr("src") || "";
        if (thumbnail && !thumbnail.startsWith("http")) {
          thumbnail = thumbnail.startsWith("//")
            ? `https:${thumbnail}`
            : `https://www.fmkorea.com${thumbnail}`;
        }

        if (title && url && number) {
          posts.push({
            number,
            title,
            url,
            author,
            date,
            shop: shop || "알 수 없음",
            price: price || "알 수 없음",
            delivery: delivery || "알 수 없음",
            category: category || "알 수 없음",
            thumbnail: thumbnail || "",
          });
        }
      } catch (error) {
        console.error("게시글 파싱 오류:", error);
      }
    });

    // 게시글 번호 기준 내림차순 정렬 (최신순)
    posts.sort((a, b) => b.number - a.number);

    console.log(`크롤링 완료: ${posts.length}개 게시글 발견`);
    return posts;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
}

/**
 * Set-Cookie 헤더에서 쿠키 문자열 추출
 */
function extractCookies(setCookieHeaders: string[] | undefined): string {
  if (!setCookieHeaders) return "";

  return setCookieHeaders
    .map((cookie) => {
      // Set-Cookie: name=value; path=/; domain=... 형식에서 name=value만 추출
      const match = cookie.match(/^([^=]+=[^;]+)/);
      return match ? match[1] : "";
    })
    .filter((cookie) => cookie.length > 0)
    .join("; ");
}

export async function crawlHotdealBoard(): Promise<Post[]> {
  // Puppeteer 사용 설정이 켜져 있으면 Puppeteer 사용
  if (CRAWLER_CONFIG.USE_PUPPETEER) {
    return await crawlWithPuppeteer();
  }

  // 기존 axios 방식
  const baseHeaders = {
    "User-Agent": CRAWLER_CONFIG.USER_AGENT,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Cache-Control": "max-age=0",
  };

  console.log("=== 크롤링 시작 ===");

  try {
    // 1단계: 메인 페이지 방문하여 쿠키 획득 (클라우드플레어 우회)
    console.log("1단계: 메인 페이지 방문 중...");
    const mainResponse = await axios.get(FM_KOREA_MAIN_URL, {
      headers: {
        ...baseHeaders,
        Referer: "https://www.google.com/",
      },
      timeout: CRAWLER_CONFIG.TIMEOUT_MS,
      validateStatus: (status) => true,
    });

    console.log(`메인 페이지 응답: ${mainResponse.status}`);

    // 쿠키 추출
    const cookies = extractCookies(mainResponse.headers["set-cookie"]);
    console.log(`획득한 쿠키: ${cookies ? "있음" : "없음"}`);

    // 메인 페이지 방문 후 짧은 대기 (클라우드플레어 챌린지 처리 시간)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 2단계: 핫딜 게시판 방문
    console.log("2단계: 핫딜 게시판 방문 중...");
    console.log(`URL: ${FM_KOREA_HOTDEAL_URL}`);

    const response = await axios.get(FM_KOREA_HOTDEAL_URL, {
      headers: {
        ...baseHeaders,
        Referer: FM_KOREA_MAIN_URL,
        ...(cookies && { Cookie: cookies }),
      },
      timeout: CRAWLER_CONFIG.TIMEOUT_MS,
      validateStatus: (status) => {
        // 모든 상태 코드를 허용하여 에러 응답도 확인 가능하게
        return true;
      },
    });

    console.log(`응답 상태 코드: ${response.status}`);
    console.log("응답 헤더:", JSON.stringify(response.headers, null, 2));

    if (response.status !== 200) {
      console.error(`HTTP 에러: ${response.status}`);
      console.error(
        "응답 본문 (처음 1000자):",
        response.data?.toString().substring(0, 1000)
      );
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const $ = cheerio.load(response.data);
    const posts: Post[] = [];

    // 예전에는 .fm_best_widget 안에 리스트가 있었는데,
    // 현재는 컨테이너 클래스가 바뀐 상태라 li.li만 기준으로 잡는다.
    $("li.li").each((_, element) => {
      try {
        const $element = $(element);

        // 제목과 URL 추출 (h3.title > a)
        const $titleLink = $element.find("h3.title a");
        const title =
          $titleLink.find(".ellipsis-target").text().trim() ||
          $titleLink.text().trim();

        // URL 추출 (상대 경로인 경우 절대 경로로 변환)
        let url = $titleLink.attr("href") || "";
        if (!url) {
          return;
        }

        // 게시글 번호 추출
        const urlMatch = url.match(/\/(\d+)/);
        if (!urlMatch) {
          return;
        }
        const number = parseInt(urlMatch[1], 10);

        if (isNaN(number)) {
          return;
        }

        if (url && !url.startsWith("http")) {
          url = `https://www.fmkorea.com${url}`;
        }

        // 추천수 추출 (.count) - 비추천(-1 이하)은 제외
        const recommendText = $element.find(".count").first().text().trim();
        const recommendMatch = recommendText.match(/-?\d+/);
        const recommend = recommendMatch
          ? parseInt(recommendMatch[0], 10)
          : 0;
        if (recommend <= -1) {
          return;
        }

        // 작성자 추출 (.author에서 " / " 제거)
        let author = $element.find(".author").text().trim();
        author = author.replace(/^\s*\/\s*/, "").trim(); // 앞의 " / " 제거

        // 날짜 추출 (.regdate)
        const date = $element.find(".regdate").text().trim();

        // 쇼핑몰, 가격, 배송 추출 (.hotdeal_info)
        const $hotdealInfo = $element.find(".hotdeal_info");
        let shop = "";
        let price = "";
        let delivery = "";

        $hotdealInfo.find("span").each((idx, span) => {
          const text = $(span).text().trim();
          if (text.includes("쇼핑몰:")) {
            shop = $(span).find("a.strong").text().trim();
          } else if (text.includes("가격:")) {
            price = $(span).find("a.strong").text().trim();
          } else if (text.includes("배송:")) {
            delivery = $(span).find("a.strong").text().trim();
          }
        });

        // 카테고리 추출 (.category > a)
        const category = $element
          .find(".category a")
          .text()
          .trim()
          .replace(/\s*\/\s*$/, "");

        // 썸네일 이미지 추출 (.thumb)
        let thumbnail = $element.find("img.thumb").attr("src") || "";
        if (thumbnail && !thumbnail.startsWith("http")) {
          thumbnail = thumbnail.startsWith("//")
            ? `https:${thumbnail}`
            : `https://www.fmkorea.com${thumbnail}`;
        }

        if (title && url && number) {
          posts.push({
            number,
            title,
            url,
            author,
            date,
            shop: shop || "알 수 없음",
            price: price || "알 수 없음",
            delivery: delivery || "알 수 없음",
            category: category || "알 수 없음",
            thumbnail: thumbnail || "",
          });
        }
      } catch (error) {
        console.error("게시글 파싱 오류:", error);
      }
    });

    // 게시글 번호 기준 내림차순 정렬 (최신순)
    posts.sort((a, b) => b.number - a.number);

    console.log(`크롤링 완료: ${posts.length}개 게시글 발견`);
    return posts;
  } catch (error) {
    console.error("=== 크롤링 에러 상세 정보 ===");

    if (axios.isAxiosError(error)) {
      console.error("에러 메시지:", error.message);
      console.error("에러 코드:", error.code);

      if (error.response) {
        // 서버가 응답을 보냈지만 에러 상태 코드
        console.error("응답 상태 코드:", error.response.status);
        console.error("응답 상태 텍스트:", error.response.statusText);
        console.error(
          "응답 헤더:",
          JSON.stringify(error.response.headers, null, 2)
        );
        console.error(
          "응답 본문 (처음 2000자):",
          error.response.data?.toString().substring(0, 2000)
        );
      } else if (error.request) {
        // 요청은 보냈지만 응답을 받지 못함
        console.error("요청은 전송되었지만 응답을 받지 못했습니다.");
        console.error("요청 정보:", JSON.stringify(error.request, null, 2));
      } else {
        // 요청 설정 중 에러 발생
        console.error("요청 설정 오류:", error.message);
      }

      console.error("에러 스택:", error.stack);
      throw new Error(`크롤링 실패: ${error.message}`);
    }

    console.error("예상치 못한 에러:", error);
    throw error;
  }
}

/**
 * 재시도 로직을 포함한 크롤링
 */
export async function crawlWithRetry(): Promise<Post[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= CRAWLER_CONFIG.MAX_RETRIES; attempt++) {
    try {
      return await crawlHotdealBoard();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `크롤링 시도 ${attempt}/${CRAWLER_CONFIG.MAX_RETRIES} 실패:`,
        lastError.message
      );

      if (attempt < CRAWLER_CONFIG.MAX_RETRIES) {
        console.log(`${CRAWLER_CONFIG.RETRY_DELAY_MS}ms 후 재시도...`);
        await new Promise((resolve) =>
          setTimeout(resolve, CRAWLER_CONFIG.RETRY_DELAY_MS)
        );
      }
    }
  }

  throw lastError || new Error("크롤링 실패");
}
