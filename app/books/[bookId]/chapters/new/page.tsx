"use client";

import { useParams } from "next/navigation";
import { ChapterEditor } from "@/components/chapter-editor";

export default function NewChapterPage() {
  const params = useParams<{ bookId: string }>();
  return <ChapterEditor bookId={params.bookId} />;
}
