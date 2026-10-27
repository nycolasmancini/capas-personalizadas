import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div aria-busy aria-label="Carregando pedido">
      <Skeleton className="mb-4 h-4 w-28" />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <Skeleton className="mx-auto aspect-[4/5] w-full max-w-xl" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
