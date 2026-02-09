import { crawlWithRetry } from "./crawler";
import { loadState, saveState } from "./state";
import { sendSlackNotifications } from "./slack";

/**
 * 메인 워크플로우 실행
 */
async function runWorkflow(): Promise<void> {
  console.log("=== 워크플로우 시작 ===");
  console.log(`시작 시간: ${new Date().toISOString()}`);

  try {
    // 1. 현재 상태 로드
    const state = loadState();
    const lastPostNumber = state?.lastPostNumber || 0;
    console.log(`마지막 확인한 게시글 번호: ${lastPostNumber}`);

    // 2. 크롤링
    const posts = await crawlWithRetry();

    if (posts.length === 0) {
      console.log("게시글이 없습니다.");
      return;
    }

    // 3. 최신 게시글 번호 확인
    const latestPost = posts[0];
    const latestPostNumber = latestPost.number;
    console.log(`최신 게시글 번호: ${latestPostNumber}`);

    // 4. lastPostNumber가 비정상적으로 클 때 자동 복구
    if (lastPostNumber > latestPostNumber) {
      console.warn(
        `상태 파일의 lastPostNumber(${lastPostNumber})가 최신 글 번호(${latestPostNumber})보다 커서 최신 글 번호로 상태를 초기화합니다.`
      );
      // 이번 실행에서는 알림을 보내지 않고 상태만 정상값으로 맞춘다.
      saveState(latestPostNumber);
      console.log(
        "상태를 최신 게시글 번호로 초기화했으므로 이번 실행에서는 알림을 건너뜁니다."
      );
      return;
    }

    // 5. 새 글 확인
    if (latestPostNumber > lastPostNumber) {
      // 새 글 필터링 (마지막 확인 번호보다 큰 게시글들)
      const newPosts = posts.filter((post) => post.number > lastPostNumber);
      // 오래된 글부터 알림을 보내기 위해 게시글 번호 오름차순 정렬
      newPosts.sort((a, b) => a.number - b.number);
      console.log(`새 글 ${newPosts.length}개 발견!`);

      // 6. 슬랙 알림 전송
      if (newPosts.length > 0) {
        await sendSlackNotifications(newPosts);
      }

      // 7. 상태 저장 (최신 게시글 번호로 업데이트)
      saveState(latestPostNumber);
    } else {
      console.log("새 글이 없습니다.");
      // 상태는 업데이트하지 않음 (이미 최신 상태)
    }

    console.log("=== 워크플로우 완료 ===");
  } catch (error) {
    console.error("워크플로우 실행 중 오류:", error);
    throw error;
  }
}

// 메인 실행 (GitHub Actions용 - 한 번 실행 후 종료)
if (require.main === module) {
  runWorkflow()
    .then(() => {
      console.log("워크플로우가 성공적으로 완료되었습니다.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("워크플로우 실행 실패:", error);
      process.exit(1);
    });
}
