"use client";

import { useParams } from "next/navigation";
import { ChapterEditor } from "@/components/chapter-editor";

export default function EditChapterPage() {
  const params = useParams<{ bookId: string; chapterId: string }>();
  return <ChapterEditor bookId={params.bookId} chapterId={params.chapterId} />;
}
