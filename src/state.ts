import * as fs from 'fs';
import * as path from 'path';
import { STATE_FILE_PATH } from './config';

/**
 * 상태 관리 인터페이스
 */
export interface State {
  lastPostNumber: number;
  lastCheckTime: string;
}

/**
 * 상태 파일에서 마지막 게시글 번호를 로드
 */
export function loadState(): State | null {
  try {
    const statePath = path.resolve(STATE_FILE_PATH);
    if (!fs.existsSync(statePath)) {
      return null;
    }
    const data = fs.readFileSync(statePath, 'utf-8');
    return JSON.parse(data) as State;
  } catch (error) {
    console.error('상태 파일 로드 실패:', error);
    return null;
  }
}

/**
 * 상태 파일에 마지막 게시글 번호를 저장
 */
export function saveState(postNumber: number): void {
  try {
    const state: State = {
      lastPostNumber: postNumber,
      lastCheckTime: new Date().toISOString(),
    };
    const statePath = path.resolve(STATE_FILE_PATH);
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    console.log(`상태 저장 완료: 마지막 게시글 번호 = ${postNumber}`);
  } catch (error) {
    console.error('상태 파일 저장 실패:', error);
    throw error;
  }
}

