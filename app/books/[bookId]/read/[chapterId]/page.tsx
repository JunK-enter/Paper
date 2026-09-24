"use client";

import { useParams } from "next/navigation";
import { ReaderScreen } from "@/components/reader";

export default function ReadPage() {
  const params = useParams<{ bookId: string; chapterId: string }>();
  return <ReaderScreen bookId={params.bookId} chapterId={params.chapterId} />;
}
