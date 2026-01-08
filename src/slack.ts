import axios from "axios";
import { SLACK_WEBHOOK_URL, SLACK_CONFIG } from "./config";
import { Post } from "./crawler";

/**
 * 슬랙으로 메시지 전송
 */
export async function sendSlackNotification(post: Post): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn(
      "SLACK_WEBHOOK_URL이 설정되지 않았습니다. 슬랙 알림을 건너뜁니다."
    );
    return;
  }

  const message: any = {
    attachments: [
      {
        color: SLACK_CONFIG.COLOR,
        title: post.title,
        title_link: post.url,
        fields: [
          {
            title: "쇼핑몰",
            value: post.shop || "알 수 없음",
            short: true,
          },
          {
            title: "가격",
            value: post.price || "알 수 없음",
            short: true,
          },
          {
            title: "배송",
            value: post.delivery || "알 수 없음",
            short: true,
          },
          {
            title: "카테고리",
            value: post.category || "알 수 없음",
            short: true,
          },
          {
            title: "시간",
            value: post.date || "알 수 없음",
            short: true,
          },
        ],
        actions: [
          {
            type: "button",
            text: "게시글 보기",
            url: post.url,
          },
        ],
        footer: "핫딜 알림",
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  // 썸네일 이미지가 있으면 추가
  if (post.thumbnail) {
    message.attachments[0].image_url = post.thumbnail;
  }

  try {
    await axios.post(SLACK_WEBHOOK_URL, message, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log(`슬랙 알림 전송 완료: ${post.title}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("슬랙 알림 전송 실패:", error.message);
      throw new Error(`슬랙 알림 실패: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 여러 게시글에 대한 슬랙 알림 전송
 */
export async function sendSlackNotifications(posts: Post[]): Promise<void> {
  for (const post of posts) {
    try {
      await sendSlackNotification(post);
      // 슬랙 API 레이트 리밋 방지를 위한 짧은 딜레이
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`게시글 ${post.number} 알림 전송 실패:`, error);
    }
  }
}
