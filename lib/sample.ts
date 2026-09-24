import { uid } from "@/lib/utils";
import type { Book, Chapter } from "@/types/models";
import { saveBook, saveChapter } from "@/lib/storage/repo";

const story = `비가 그친 뒤, 골목은 종이보다 조용했다.

「늦었네.」 노인이 우산 손잡이를 탁자에 내려놓았다.

그녀는 대답 대신 창에 남은 물기를 손끝으로 그었다. 물기는 이미 식어 있었고, 식어 버린 것들만 오래 남았다.

편지는 세 장으로 접혀 있었다. 펼치지 않아도 알 수 있는 무게였다. 마지막 문장은 늘 가장 짧은 법이라, 그녀는 가운데부터 읽기 시작했다.

그리고 창밖에서는, 누군가 그녀의 이름을 부르지 않은 채로 지나갔다.`;

export async function seedSample(userId: string) {
  const now = Date.now();
  const bookId = uid();
  const chapterId = uid();
  const book: Book = {
    id: bookId,
    userId,
    title: "마지막 문장",
    author: "PAPER",
    genre: "짧은 소설",
    description: "읽기 화면을 둘러보기 위한 짧은 샘플입니다.",
    cover: { kind: "preset", presetId: "ink" },
    status: "unread",
    archived: false,
    chapterCount: 1,
    publishedCount: 1,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
  };
  const chapter: Chapter = {
    id: chapterId,
    bookId,
    userId,
    title: "골목",
    content: story,
    order: 0,
    status: "published",
    createdAt: now,
    updatedAt: now,
  };
  await saveBook(book);
  await saveChapter(chapter);
}
