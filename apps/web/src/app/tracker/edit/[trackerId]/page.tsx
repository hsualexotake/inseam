import TrackerBuilder from "@/components/tracker/TrackerBuilder";

export default async function EditTrackerPage({
  params,
}: {
  params: Promise<{ trackerId: string }>;
}) {
  const { trackerId } = await params;

  return (
    <div className="container mx-auto px-4 py-8">
      <TrackerBuilder trackerId={trackerId} />
    </div>
  );
}