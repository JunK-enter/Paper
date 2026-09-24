"use client";

import { useParams } from "next/navigation";
import { BookEditor } from "@/components/book-wizard";

export default function EditBookPage() {
  const params = useParams<{ bookId: string }>();
  return <BookEditor bookId={params.bookId} />;
}
