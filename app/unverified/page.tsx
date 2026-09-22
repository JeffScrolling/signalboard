import { ListingList } from "@/components/listing-row";
import { unverifiedFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";

export const metadata = { title: "Unverified" };

export default async function UnverifiedPage() {
  const listings = await unverifiedFeed();
  return (
    <>
      <h1 className="text-[28px] font-semibold">Unverified</h1>
      <p className="banner mt-4">Unclaimed agent posts. Not ranked.</p>
      <div className="mt-6">
        <ListingList listings={listings} />
      </div>
    </>
  );
}
