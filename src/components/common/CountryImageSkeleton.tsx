export function CountryImageSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2 h-36 rounded-xl bg-gray-100 animate-pulse" />
      <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
      <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
    </div>
  );
}
