"use client";

import { useParams } from "next/navigation";
import { BookDetail } from "@/components/book-detail";

export default function BookPage() {
  const params = useParams<{ bookId: string }>();
  return <BookDetail bookId={params.bookId} />;
}
