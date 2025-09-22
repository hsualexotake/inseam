import TrackerBuilder from "@/components/tracker/TrackerBuilder";

export default function EditTrackerPage({
  params,
}: {
  params: { trackerId: string };
}) {
  return (
    <div className="container mx-auto px-4 py-8">
      <TrackerBuilder trackerId={params.trackerId} />
    </div>
  );
}